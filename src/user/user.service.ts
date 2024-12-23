import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { MarginBalance } from '../margin/entities/margin-balance.entity';
import { MarginLock } from '../entities/margin-lock.entity';
import { TokenType } from '../margin/types/token.types';
import { MathService } from '../utils/math.service';
import { InsufficientMarginError } from '../common/errors';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(MarginBalance)
    private readonly marginBalanceRepository: Repository<MarginBalance>,
    @InjectRepository(MarginLock)
    private readonly marginLockRepository: Repository<MarginLock>,
    private readonly mathService: MathService,
  ) {}

  async createUser(publicKey: string): Promise<User> {
    const user = this.userRepository.create({
      publicKey,
    });

    return this.userRepository.save(user);
  }

  async getUserByPublicKey(publicKey: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { publicKey },
    });

    if (!user) {
      throw new NotFoundException(
        `User with public key ${publicKey} not found`,
      );
    }

    return user;
  }

  async getMarginBalance(
    publicKey: string,
    token: TokenType,
  ): Promise<MarginBalance> {
    const marginBalance = await this.marginBalanceRepository.findOne({
      where: { userId: publicKey, token },
    });

    if (!marginBalance) {
      return this.marginBalanceRepository.create({
        userId: publicKey,
        token,
        availableBalance: '0',
        lockedBalance: '0',
        unrealizedPnl: '0',
      });
    }

    return marginBalance;
  }

  async updateMarginBalance(
    publicKey: string,
    token: TokenType,
    availableBalance: string,
    lockedBalance: string,
    unrealizedPnl: string,
  ): Promise<void> {
    let marginBalance = await this.marginBalanceRepository.findOne({
      where: { userId: publicKey, token },
    });

    if (!marginBalance) {
      marginBalance = this.marginBalanceRepository.create({
        userId: publicKey,
        token,
        availableBalance: '0',
        lockedBalance: '0',
        unrealizedPnl: '0',
      });
    }

    marginBalance.availableBalance = availableBalance;
    marginBalance.lockedBalance = lockedBalance;
    marginBalance.unrealizedPnl = unrealizedPnl;

    await this.marginBalanceRepository.save(marginBalance);
  }

  async createMarginLock(
    publicKey: string,
    tradeId: string,
    token: TokenType,
    amount: string,
  ): Promise<MarginLock> {
    const marginLock = this.marginLockRepository.create({
      userId: publicKey,
      tradeId,
      token,
      amount,
    });

    return this.marginLockRepository.save(marginLock);
  }

  async getMarginLock(tradeId: string): Promise<MarginLock> {
    const marginLock = await this.marginLockRepository.findOne({
      where: { tradeId },
    });

    if (!marginLock) {
      throw new NotFoundException(`Margin lock for trade ${tradeId} not found`);
    }

    return marginLock;
  }

  async lockMargin(
    publicKey: string,
    token: TokenType,
    amount: string,
    tradeId: string,
  ): Promise<void> {
    const marginBalance = await this.getMarginBalance(publicKey, token);

    if (this.mathService.compare(marginBalance.availableBalance, amount) < 0) {
      throw new InsufficientMarginError('Insufficient available balance');
    }

    // Create margin lock
    await this.createMarginLock(publicKey, tradeId, token, amount);

    // Update balances
    await this.updateMarginBalance(
      publicKey,
      token,
      this.mathService.subtract(marginBalance.availableBalance, amount),
      this.mathService.add(marginBalance.lockedBalance, amount),
      marginBalance.unrealizedPnl,
    );
  }

  async releaseMargin(
    userId: string,
    token: TokenType,
    tradeId: string,
    pnl: string = '0',
  ): Promise<void> {
    const [marginLock, marginBalance] = await Promise.all([
      this.getMarginLock(tradeId),
      this.getMarginBalance(userId, token),
    ]);

    // Calculate final amount to return (original margin + PnL)
    const returnAmount = this.mathService.add(marginLock.amount, pnl);

    // Update balances
    await this.updateMarginBalance(
      userId,
      token,
      this.mathService.add(marginBalance.availableBalance, returnAmount),
      this.mathService.subtract(marginBalance.lockedBalance, marginLock.amount),
      marginBalance.unrealizedPnl,
    );

    // Remove margin lock
    await this.marginLockRepository.delete({ tradeId });
  }
}
