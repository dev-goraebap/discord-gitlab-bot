import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, GatewayIntentBits } from 'discord.js';

@Injectable()
export class DiscordBot implements OnModuleInit {
  private readonly logger = new Logger(DiscordBot.name);
  private client: Client;

  constructor(private configService: ConfigService) {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    });
  }

  async onModuleInit() {
    const token = this.configService.getOrThrow<string>('DISCORD_BOT_TOKEN');

    this.client.once('clientReady', () => {
      this.logger.log(`✅ 봇 로그인 성공: ${this.client.user?.tag}`);
    });

    try {
      await this.client.login(token);
    } catch (error) {
      this.logger.error('❌ 봇 로그인 실패:', error);
      process.exit(1);
    }
  }

  getClient(): Client {
    return this.client;
  }
}
