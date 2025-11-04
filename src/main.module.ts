import { Module } from '@nestjs/common';
import { AppModule } from './app/app.module';
import { DrizzleModule } from './shared/drizzle';

@Module({
  imports: [DrizzleModule, AppModule],
})
export class MainModule {}