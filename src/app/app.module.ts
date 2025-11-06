import { Module } from '@nestjs/common';
import { WebhookModule } from './webhook/webhook.module';
import { CommandsModule } from './commands/commands.module';
import { ConfigModule } from '../shared/config';

@Module({
  imports: [ConfigModule, WebhookModule, CommandsModule],
})
export class AppModule {}
