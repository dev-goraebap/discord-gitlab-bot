import { Module } from '@nestjs/common';
import { DiscordBot } from './discord.bot';
import { DiscordService } from './discord.service';

@Module({
  providers: [DiscordBot, DiscordService],
  exports: [DiscordBot, DiscordService],
})
export class DiscordModule {}
