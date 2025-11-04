import {Injectable, Logger} from '@nestjs/common';
import {DiscordService} from 'src/shared/discord';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private discordService: DiscordService) {}

  async handleGitlabEvent(event: any) {
    // 이슈 생성 이벤트만 처리
    if (event.object_kind !== 'issue') {
      return { message: 'Not an issue event' };
    }

    // 이슈 생성이 아닌 경우 (update, close 등) 무시
    if (event.object_attributes.action !== 'open') {
      return { message: 'Not an issue creation event' };
    }

    this.logger.log(
      `📥 이슈 생성 이벤트 수신: ${event.object_attributes.title}`,
    );

    try {
      // 이슈 정보 추출
      const issue = event.object_attributes;
      const repository = event.repository || event.project;
      const user = event.user;

      // 포럼 포스트 제목
      const threadTitle = `[${repository.name}] ${issue.title}`;

      // 포럼 포스트 본문
      const threadContent = `
        📦 **레포**: ${repository.name}
        👤 **담당**: ${user.name} (@${user.username})
        ${issue.labels && issue.labels.length > 0 ? `🏷️ **라벨**: ${issue.labels.map((l) => l.title).join(', ')}` : ''}
        📅 **마감일자**: ${issue.due_date || '지정되지 않음'}
        ${issue.description || '*(설명 없음)*'}
        
        [깃렙에서 이슈 보기](${issue.url})
        `.trim();

      // 포럼 스레드 생성
      const threadId =
        await this.discordService.createForumPost(threadTitle, threadContent);

      return {
        message: 'Issue posted to forum successfully',
        threadId: threadId,
      };
    } catch (error) {
      this.logger.error('❌ Webhook 처리 중 오류:', error);
      throw error;
    }
  }
}
