import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscordBot } from './discord.bot';

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);

  constructor(
    private discordBot: DiscordBot,
    private configService: ConfigService,
  ) {}

  async createForumPost(title: string, content: string): Promise<string> {
    const client = this.discordBot.getClient();
    const forumChannelId = this.configService.getOrThrow<string>(
      'DISCORD_FORUM_CHANNEL_ID',
    );

    try {
      const forumChannel = await client.channels.fetch(forumChannelId);

      if (!forumChannel || !forumChannel.isThreadOnly()) {
        throw new Error('포럼 채널을 찾을 수 없거나 포럼 채널이 아닙니다.');
      }

      const thread = await forumChannel.threads.create({
        name: title.slice(0, 100), // 디스코드 제목 길이 제한
        message: {
          content: content,
        },
      });

      this.logger.log(`✅ 포럼 포스트 생성 완료: ${thread.name}`);
      return thread.id;
    } catch (error) {
      this.logger.error('❌ 포럼 포스트 생성 실패:', error);
      throw error;
    }
  }
}
