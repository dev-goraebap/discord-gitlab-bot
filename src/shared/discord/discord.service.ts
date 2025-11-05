import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbedBuilder } from 'discord.js';
import { DiscordBot } from './discord.bot';

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);

  constructor(
    private discordBot: DiscordBot,
    private configService: ConfigService,
  ) {}

  async createForumPost(
    title: string,
    content: string,
    appliedTags?: string[],
  ): Promise<string> {
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
        appliedTags: appliedTags || [],
      });

      this.logger.log(`✅ 포럼 포스트 생성 완료: ${thread.name}`);
      return thread.id;
    } catch (error) {
      this.logger.error('❌ 포럼 포스트 생성 실패:', error);
      throw error;
    }
  }

  async updateForumPost(
    threadId: string,
    title: string,
    content: string,
    appliedTags?: string[],
  ): Promise<void> {
    const client = this.discordBot.getClient();

    try {
      const thread = await client.channels.fetch(threadId);

      if (!thread || !thread.isThread()) {
        throw new Error('스레드를 찾을 수 없거나 스레드가 아닙니다.');
      }

      // 스레드의 첫 메시지(starter message) 가져오기
      const starterMessage = await thread.fetchStarterMessage();

      if (!starterMessage) {
        throw new Error('포럼 포스트의 첫 메시지를 찾을 수 없습니다.');
      }

      // 메시지 내용 수정
      await starterMessage.edit(content);

      // 스레드 제목 수정
      await thread.setName(title.slice(0, 100));

      // 태그 수정 (제공된 경우)
      if (appliedTags) {
        await thread.setAppliedTags(appliedTags);
      }

      this.logger.log(`✅ 포럼 포스트 수정 완료: ${thread.name}`);
    } catch (error) {
      this.logger.error('❌ 포럼 포스트 수정 실패:', error);
      throw error;
    }
  }

  async sendThreadEmbed(threadId: string, embed: EmbedBuilder): Promise<void> {
    const client = this.discordBot.getClient();

    try {
      const thread = await client.channels.fetch(threadId);

      if (!thread || !thread.isThread()) {
        throw new Error('스레드를 찾을 수 없거나 스레드가 아닙니다.');
      }

      await thread.send({ embeds: [embed] });
      this.logger.log(`✅ 스레드 Embed 메시지 전송 완료: ${threadId}`);
    } catch (error) {
      this.logger.error('❌ 스레드 Embed 메시지 전송 실패:', error);
      throw error;
    }
  }

  async deleteThread(threadId: string): Promise<void> {
    const client = this.discordBot.getClient();

    try {
      const thread = await client.channels.fetch(threadId);

      if (!thread || !thread.isThread()) {
        throw new Error('스레드를 찾을 수 없거나 스레드가 아닙니다.');
      }

      await thread.delete();
      this.logger.log(`✅ 스레드 삭제 완료: ${threadId}`);
    } catch (error) {
      this.logger.error('❌ 스레드 삭제 실패:', error);
      throw error;
    }
  }

  async getOrCreateTag(tagName: string): Promise<string> {
    const client = this.discordBot.getClient();
    const forumChannelId = this.configService.getOrThrow<string>(
      'DISCORD_FORUM_CHANNEL_ID',
    );

    try {
      const forumChannel = await client.channels.fetch(forumChannelId);

      if (!forumChannel || !forumChannel.isThreadOnly()) {
        throw new Error('포럼 채널을 찾을 수 없거나 포럼 채널이 아닙니다.');
      }

      // 기존 태그 조회
      const existingTag = forumChannel.availableTags.find(
        (tag) => tag.name === tagName,
      );

      if (existingTag) {
        return existingTag.id;
      }

      // 태그 생성
      await forumChannel.setAvailableTags([
        ...forumChannel.availableTags,
        { name: tagName, emoji: null },
      ]);

      // 생성된 태그 조회
      const updatedChannel = await client.channels.fetch(forumChannelId);
      if (!updatedChannel || !updatedChannel.isThreadOnly()) {
        throw new Error('포럼 채널을 찾을 수 없습니다.');
      }

      const newTag = updatedChannel.availableTags.find(
        (tag) => tag.name === tagName,
      );

      if (!newTag) {
        throw new Error(`태그 생성 실패: ${tagName}`);
      }

      this.logger.log(`✅ 포럼 태그 생성 완료: ${tagName}`);
      return newTag.id;
    } catch (error) {
      this.logger.error(`❌ 포럼 태그 처리 실패: ${tagName}`, error);
      throw error;
    }
  }
}
