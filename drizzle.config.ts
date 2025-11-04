import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.development.local' });

export default defineConfig({
  schema: './src/shared/drizzle/schema/index.ts',
  out: './src/shared/drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME!,
    user: process.env.DB_USERNAME!,
    password: process.env.DB_PASSWORD!,
    ssl: false,
  },
});
