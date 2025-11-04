import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { DrizzleOrm, DrizzleTransaction } from './drizzle.module';

@Injectable()
export class TransactionContext {
  private als = new AsyncLocalStorage<DrizzleTransaction>();

  // DRIZZLE 의존성 제거 - 순환 의존성 방지
  constructor() {}

  async runInTransaction<T>(db: DrizzleOrm, callback: () => Promise<T>): Promise<T> {
    return await db.transaction(async (tx) => {
      return await this.als.run(tx, callback);
    });
  }

  getCurrentTransaction(): DrizzleTransaction | undefined {
    return this.als.getStore();
  }
}