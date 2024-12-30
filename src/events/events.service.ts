import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { TokenType } from 'src/types/token.types';

interface BorrowingFeeEvent {
  userId: string;
  positionId: string;
  marketId: string;
  feeUsd: string;
  feeToken: string;
  token: TokenType;
}

interface PositionUpdate {
  userId: string;
  timestamp: string;
}

@Injectable()
export class EventsService {
  private positionsSubject = new Subject<PositionUpdate>();

  getPositionsEventObservable(userId: string) {
    return this.positionsSubject
      .asObservable()
      .pipe(filter((update) => update.userId === userId));
  }

  emitPositionsUpdate(userId: string) {
    this.positionsSubject.next({
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  emitBorrowingFeeCharged(event: BorrowingFeeEvent): void {
    // In production, this would emit the event to a message queue or websocket
    console.log('Borrowing fee charged:', event);
  }
}
