import { Injectable, Logger } from '@nestjs/common';
import { EmbedBuilder } from 'discord.js';
import { DiscordService } from 'src/shared/discord';
import { IssueMappingEntity } from 'src/domain/issue';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private discordService: DiscordService) {}

  async handleGitlabEvent(event: any) {
    // 이슈 이벤트만 처리
    if (event.object_kind !== 'issue') {
      return { message: 'Not an issue event' };
    }

    const action = event.object_attributes.action;

    // 디버그: 들어온 이벤트 전체 확인
    this.logger.debug('🔍 수신된 이벤트 전체:', JSON.stringify(event, null, 2));

    // action별 분기 처리
    if (action === 'open') {
      return await this.handleIssueCreate(event);
    } else if (action === 'update') {
      return await this.handleIssueUpdate(event);
    } else if (action === 'close') {
      return await this.handleIssueClose(event);
    } else if (action === 'reopen') {
      return await this.handleIssueReopen(event);
    } else {
      return { message: `Unsupported action: ${action}` };
    }
  }

  private async handleIssueCreate(event: any) {
    this.logger.log(
      `📥 이슈 생성 이벤트 수신: ${event.object_attributes.title}`,
    );

    try {
      // 이슈 정보 추출
      const issue = event.object_attributes;
      const project = event.project;
      const user = event.user;

      // 포럼 포스트 제목
      const threadTitle = `[${project.name}] ${issue.title}`;

      // 포럼 포스트 본문
      const threadContent = `
📦 **레포**: ${project.name}
👤 **담당**: ${user.name} (@${user.username})
${issue.labels && issue.labels.length > 0 ? `🏷️ **라벨**: ${issue.labels.map((l) => l.title).join(', ')}` : ''}
📅 **마감일자**: ${issue.due_date || '지정되지 않음'}
${issue.description || '*(설명 없음)*'}

[깃렙에서 이슈 보기](${issue.url})
`.trim();

      // 포럼 스레드 생성
      const threadId = await this.discordService.createForumPost(
        threadTitle,
        threadContent,
      );

      // 디버그: threadId 확인
      this.logger.debug('✅ 생성된 threadId:', threadId);

      // DB에 매핑 저장
      const mapping = IssueMappingEntity.create({
        gitlabProjectId: project.id,
        gitlabIssueId: issue.iid,
        discordThreadId: threadId,
        gitlabAuthorId: user.id,
        gitlabAuthorName: user.name,
      });

      await mapping.save();

      this.logger.log(
        `✅ DB 매핑 저장 완료: GitLab(${project.id}/${issue.iid}) → Discord(${threadId})`,
      );

      return {
        message: 'Issue posted to forum successfully',
        threadId: threadId,
      };
    } catch (error) {
      this.logger.error('❌ Webhook 처리 중 오류:', error);
      throw error;
    }
  }

  private async handleIssueUpdate(event: any) {
    this.logger.log(
      `📝 이슈 업데이트 이벤트 수신: ${event.object_attributes.title}`,
    );

    try {
      const issue = event.object_attributes;
      const project = event.project;
      const user = event.user;

      // DB에서 매핑 조회
      const mapping = await IssueMappingEntity.findByGitlabIssue(
        project.id,
        issue.iid,
      );

      if (!mapping) {
        this.logger.warn(
          `⚠️ 매핑 정보 없음: GitLab(${project.id}/${issue.iid})`,
        );
        return { message: 'No mapping found for this issue' };
      }

      // 현재 이슈 상태 전체를 포맷팅 (생성 시와 동일)
      const threadTitle = `[${project.name}] ${issue.title}`;

      const threadContent = `
📦 **레포**: ${project.name}
👤 **담당**: ${user.name} (@${user.username})
${issue.labels && issue.labels.length > 0 ? `🏷️ **라벨**: ${issue.labels.map((l) => l.title).join(', ')}` : ''}
📅 **마감일자**: ${issue.due_date || '지정되지 않음'}
${issue.description || '*(설명 없음)*'}

[깃렙에서 이슈 보기](${issue.url})
`.trim();

      // Discord 포럼 포스트 업데이트 (제목 + 내용)
      await this.discordService.updateForumPost(
        mapping.discordThreadId,
        threadTitle,
        threadContent,
      );

      this.logger.log(
        `✅ 포럼 포스트 업데이트 완료: GitLab(${project.id}/${issue.iid}) → Discord(${mapping.discordThreadId})`,
      );

      return {
        message: 'Forum post updated successfully',
        threadId: mapping.discordThreadId,
      };
    } catch (error) {
      this.logger.error('❌ 이슈 업데이트 처리 중 오류:', error);
      throw error;
    }
  }

  private async handleIssueClose(event: any) {
    this.logger.log(
      `🔒 이슈 종료 이벤트 수신: ${event.object_attributes.title}`,
    );

    try {
      const issue = event.object_attributes;
      const project = event.project;

      // DB에서 매핑 조회
      const mapping = await IssueMappingEntity.findByGitlabIssue(
        project.id,
        issue.iid,
      );

      if (!mapping) {
        this.logger.warn(
          `⚠️ 매핑 정보 없음: GitLab(${project.id}/${issue.iid})`,
        );
        return { message: 'No mapping found for this issue' };
      }

      // DB 상태 업데이트
      await mapping.updateState('closed');

      // Discord Embed 생성
      const embed = new EmbedBuilder()
        .setColor(0xff0000) // 빨간색
        .setTitle('🔒 이슈 종료')
        .setDescription('이슈가 종료되었습니다.')
        .addFields({
          name: '링크',
          value: `[깃렙에서 이슈 보기](${issue.url})`,
        })
        .setTimestamp();

      // Discord 스레드에 Embed 전송
      await this.discordService.sendThreadEmbed(
        mapping.discordThreadId,
        embed,
      );

      this.logger.log(
        `✅ 이슈 종료 알림 전송 완료: GitLab(${project.id}/${issue.iid})`,
      );

      return {
        message: 'Issue closed notification sent successfully',
        threadId: mapping.discordThreadId,
      };
    } catch (error) {
      this.logger.error('❌ 이슈 종료 처리 중 오류:', error);
      throw error;
    }
  }

  private async handleIssueReopen(event: any) {
    this.logger.log(
      `🔓 이슈 재오픈 이벤트 수신: ${event.object_attributes.title}`,
    );

    try {
      const issue = event.object_attributes;
      const project = event.project;

      // DB에서 매핑 조회
      const mapping = await IssueMappingEntity.findByGitlabIssue(
        project.id,
        issue.iid,
      );

      if (!mapping) {
        this.logger.warn(
          `⚠️ 매핑 정보 없음: GitLab(${project.id}/${issue.iid})`,
        );
        return { message: 'No mapping found for this issue' };
      }

      // DB 상태 업데이트
      await mapping.updateState('opened');

      // Discord Embed 생성
      const embed = new EmbedBuilder()
        .setColor(0x00ff00) // 초록색
        .setTitle('🔓 이슈 재오픈')
        .setDescription('이슈가 다시 열렸습니다.')
        .addFields({
          name: '링크',
          value: `[깃렙에서 이슈 보기](${issue.url})`,
        })
        .setTimestamp();

      // Discord 스레드에 Embed 전송
      await this.discordService.sendThreadEmbed(
        mapping.discordThreadId,
        embed,
      );

      this.logger.log(
        `✅ 이슈 재오픈 알림 전송 완료: GitLab(${project.id}/${issue.iid})`,
      );

      return {
        message: 'Issue reopened notification sent successfully',
        threadId: mapping.discordThreadId,
      };
    } catch (error) {
      this.logger.error('❌ 이슈 재오픈 처리 중 오류:', error);
      throw error;
    }
  }
}
