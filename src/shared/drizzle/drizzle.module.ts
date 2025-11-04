import { Global, Inject, Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ExtractTablesWithRelations } from 'drizzle-orm';
import {
  drizzle,
  NodePgDatabase,
  NodePgQueryResultHKT,
} from 'drizzle-orm/node-postgres';
import { PgTransaction } from 'drizzle-orm/pg-core';
import { Pool, PoolConfig } from 'pg';

import { DrizzleContext } from './drizzle.context';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');
export type DrizzleOrm = NodePgDatabase<typeof schema>;
export type DrizzleTransaction = PgTransaction<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DRIZZLE,
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('DB_HOST');
        const port = Number(configService.get<string>('DB_PORT'));
        const database = configService.get<string>('DB_NAME');
        const user = configService.get<string>('DB_USERNAME');
        const password = configService.get<string>('DB_PASSWORD');
        const config: PoolConfig = {
          host,
          port,
          database,
          user,
          password,
          max: 20,
          idleTimeoutMillis: 30000,
        };
        const pool = new Pool(config);
        return drizzle(pool, { schema, logger: false });
      },
      inject: [ConfigService],
    },
  ],
  exports: [],
})
export class DrizzleModule implements OnModuleInit {
  constructor(@Inject(DRIZZLE) private database: DrizzleOrm) {}

  onModuleInit() {
    DrizzleContext.initialize(this.database);
  }
}
