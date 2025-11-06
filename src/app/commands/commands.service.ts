import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscordBot } from 'src/shared/discord';
import { GitlabService } from 'src/shared/gitlab';
import { IssueMappingEntity } from 'src/domain/issue';
import { UserMappingEntity } from 'src/domain/user/user.model';
import { EmbedBuilder, REST, Routes } from 'discord.js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CommandsService implements OnModuleInit {
  private readonly logger = new Logger(CommandsService.name);

  constructor(
    private discordBot: DiscordBot,
    private gitlabService: GitlabService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.registerCommands();
    this.setupCommandHandlers();
  }

  private async registerCommands() {
    const commands = [
      {
        name: '내이슈',
        description: '자신에게 할당된 열린 이슈 목록을 조회합니다.',
      },
    ];

    const rest = new REST({ version: '10' }).setToken(
      this.configService.getOrThrow<string>('DISCORD_BOT_TOKEN'),
    );

    try {
      this.logger.log('슬래시 커맨드 등록 중...');
      await rest.put(
        Routes.applicationCommands(
          this.configService.getOrThrow<string>('DISCORD_CLIENT_ID'),
        ),
        { body: commands },
      );
      this.logger.log('✅ 슬래시 커맨드 등록 완료');
    } catch (error) {
      this.logger.error('❌ 슬래시 커맨드 등록 실패:', error);
    }
  }

  private setupCommandHandlers() {
    const client = this.discordBot.getClient();

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      if (interaction.commandName === '내이슈') {
        await this.handleMyIssues(interaction);
      }
    });
  }

  private async handleMyIssues(interaction: any) {
    try {
      await interaction.deferReply({ ephemeral: true });

      // Discord 사용자 ID로 GitLab 사용자 ID 조회
      const userMapping = await UserMappingEntity.findByDiscordId(
        interaction.user.id,
      );

      if (!userMapping) {
        await interaction.editReply({
          content: '❌ GitLab 계정이 연동되지 않았습니다.',
        });
        return;
      }

      // 할당된 열린 이슈 조회
      const issues = await IssueMappingEntity.findOpenIssuesByAssignee(
        userMapping.gitlabUserId,
      );

      if (issues.length === 0) {
        await interaction.editReply({
          content: '📭 할당된 열린 이슈가 없습니다.',
        });
        return;
      }

      // GitLab API로 각 이슈 상세 정보 조회
      const issueDetails = await Promise.all(
        issues.map(async (issue) => {
          const detail = await this.gitlabService.getIssue(
            issue.gitlabProjectId,
            issue.gitlabIssueId,
          );
          return detail;
        }),
      );

      // Embed 생성
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📋 내 이슈 목록 (${issues.length}개)`)
        .setDescription(
          issueDetails
            .filter((detail) => detail !== null)
            .map(
              (detail, index) =>
                `**${index + 1}. [${detail.title}](${detail.web_url})**\n` +
                `   🏷️ ${detail.labels.join(', ') || '라벨 없음'}`,
            )
            .join('\n\n'),
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.logger.error('❌ /내이슈 명령어 처리 실패:', error);
      await interaction.editReply({
        content: '❌ 이슈 목록 조회 중 오류가 발생했습니다.',
      });
    }
  }
}
