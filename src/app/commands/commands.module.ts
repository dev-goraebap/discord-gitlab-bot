import { Module } from '@nestjs/common';
import { CommandsService } from './commands.service';
import { DiscordModule } from 'src/shared/discord';
import { GitlabModule } from 'src/shared/gitlab';

@Module({
  imports: [DiscordModule, GitlabModule],
  providers: [CommandsService],
})
export class CommandsModule {}
