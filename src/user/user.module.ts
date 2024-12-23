import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from '../entities/user.entity';
import { MarginLock } from '../entities/margin-lock.entity';
import { MathService } from '../utils/math.service';
import { MarginBalance } from '../margin/entities/margin-balance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, MarginLock, MarginBalance])],
  controllers: [UserController],
  providers: [UserService, MathService],
  exports: [UserService],
})
export class UserModule {}
