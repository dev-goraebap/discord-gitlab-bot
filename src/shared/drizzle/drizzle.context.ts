import { AsyncLocalStorage } from 'async_hooks';
import { DrizzleOrm, DrizzleTransaction } from './drizzle.module';

export class DrizzleContext {
  private static instance: DrizzleOrm;
  private static als = new AsyncLocalStorage<DrizzleTransaction>();

  static initialize(database: DrizzleOrm) {
    this.instance = database;
  }

  static db() {
    if (!this.instance) {
      throw new Error('DB not initialized');
    }
    return this.als.getStore() || this.instance;
  }

  static async transaction<T>(callback: () => Promise<T>): Promise<T> {
    if (!this.instance) {
      throw new Error('DB not initialized');
    }
    return await this.instance.transaction(async (tx) => {
      return await this.als.run(tx, callback);
    });
  }
}
