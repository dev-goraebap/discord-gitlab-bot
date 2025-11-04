import { Injectable, Logger } from '@nestjs/common';
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
      const changes = event.changes;

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

      // 변경사항 포맷팅
      const changeMessages: string[] = [];

      if (changes.title) {
        changeMessages.push(
          `📝 **제목**: ~~${changes.title.previous}~~ → **${changes.title.current}**`,
        );
      }

      if (changes.description) {
        changeMessages.push(`📋 **설명**: 내용이 변경되었습니다`);
      }

      if (changes.labels) {
        const prevLabels = changes.labels.previous || [];
        const currLabels = changes.labels.current || [];
        const added = currLabels.filter((l: any) => !prevLabels.includes(l));
        const removed = prevLabels.filter((l: any) => !currLabels.includes(l));

        if (added.length > 0) {
          changeMessages.push(
            `🏷️ **라벨 추가**: ${added.map((l: any) => l.title).join(', ')}`,
          );
        }
        if (removed.length > 0) {
          changeMessages.push(
            `🏷️ **라벨 제거**: ${removed.map((l: any) => l.title).join(', ')}`,
          );
        }
      }

      if (changes.due_date) {
        const prevDate = changes.due_date.previous || '지정 안됨';
        const currDate = changes.due_date.current || '지정 안됨';
        changeMessages.push(`📅 **마감일**: ${prevDate} → ${currDate}`);
      }

      if (changes.assignee_ids) {
        changeMessages.push(`👤 **담당자**: 변경됨`);
      }

      // 변경사항이 없으면 무시
      if (changeMessages.length === 0) {
        return { message: 'No significant changes' };
      }

      // Discord 스레드에 업데이트 메시지 전송
      const updateMessage = `
🔄 **이슈 업데이트**

${changeMessages.join('\n')}

[깃렙에서 이슈 보기](${issue.url})
`.trim();

      await this.discordService.sendThreadMessage(
        mapping.discordThreadId,
        updateMessage,
      );

      this.logger.log(
        `✅ 이슈 업데이트 알림 전송 완료: GitLab(${project.id}/${issue.iid})`,
      );

      return {
        message: 'Issue update posted to thread successfully',
        threadId: mapping.discordThreadId,
      };
    } catch (error) {
      this.logger.error('❌ 이슈 업데이트 처리 중 오류:', error);
      throw error;
    }
  }
}
