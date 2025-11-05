import { Injectable, Logger } from '@nestjs/common';
import { EmbedBuilder } from 'discord.js';
import { DiscordService } from 'src/shared/discord';
import { IssueMappingEntity } from 'src/domain/issue';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private discordService: DiscordService) {}

  private parseProjectInfo(project: any): {
    koreanName: string;
  } {
    return {
      koreanName: project.description || project.name,
    };
  }

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
    } else if (action === 'destroy') {
      return await this.handleIssueDelete(event);
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

      // 프로젝트 정보 파싱
      const projectInfo = this.parseProjectInfo(project);

      // 포럼 포스트 제목 (한글 프로젝트명 우선)
      const threadTitle = `[${projectInfo.koreanName}] ${issue.title}`;

      // 담당자 정보 포맷팅 (첫 번째 assignee 우선, 없으면 이벤트 발생시킨 user)
      const assignees = issue.assignees || [];
      const assignee = assignees.length > 0 ? assignees[0] : user;
      const assigneeText = `${assignee.name} (@${assignee.username})`;

      // 디버그: 담당자 정보 확인
      this.logger.debug('🔍 담당자 정보:', {
        assignees: assignees,
        selectedAssignee: assignee,
        assigneeText: assigneeText,
      });

      // 포럼 포스트 본문
      const threadContent = `
👤 **담당**: ${assigneeText}
📅 **마감일자**: ${issue.due_date || '지정되지 않음'}
${issue.description || '*(설명 없음)*'}

[깃렙에서 이슈 보기](${issue.url})
`.trim();

      // Discord 태그 생성/조회 (labels + opened)
      const tagIds: string[] = [];
      if (issue.labels && Array.isArray(issue.labels)) {
        for (const label of issue.labels) {
          const tagId = await this.discordService.getOrCreateTag(label.title);
          tagIds.push(tagId);
        }
      }
      // "opened" 태그 추가
      const openedTagId = await this.discordService.getOrCreateTag('opened');
      tagIds.push(openedTagId);

      // 포럼 스레드 생성
      const threadId = await this.discordService.createForumPost(
        threadTitle,
        threadContent,
        tagIds,
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

      // 프로젝트 정보 파싱
      const projectInfo = this.parseProjectInfo(project);

      // 현재 이슈 상태 전체를 포맷팅 (한글 프로젝트명 우선)
      const threadTitle = `[${projectInfo.koreanName}] ${issue.title}`;

      // 담당자 정보 포맷팅 (첫 번째 assignee 우선, 없으면 이벤트 발생시킨 user)
      const assignees = issue.assignees || [];
      const assignee = assignees.length > 0 ? assignees[0] : user;
      const assigneeText = `${assignee.name} (@${assignee.username})`;

      // 디버그: 담당자 정보 확인
      this.logger.debug('🔍 담당자 정보 (UPDATE):', {
        assignees: assignees,
        selectedAssignee: assignee,
        assigneeText: assigneeText,
      });

      const threadContent = `
👤 **담당**: ${assigneeText}
📅 **마감일자**: ${issue.due_date || '지정되지 않음'}
${issue.description || '*(설명 없음)*'}

[깃렙에서 이슈 보기](${issue.url})
`.trim();

      // Discord 태그 생성/조회 (labels + state)
      const tagIds: string[] = [];
      if (issue.labels && Array.isArray(issue.labels)) {
        for (const label of issue.labels) {
          const tagId = await this.discordService.getOrCreateTag(label.title);
          tagIds.push(tagId);
        }
      }
      // DB state 기반 태그 추가
      const stateTagId = await this.discordService.getOrCreateTag(
        mapping.state,
      );
      tagIds.push(stateTagId);

      // Discord 포럼 포스트 업데이트 (제목 + 내용 + 태그)
      await this.discordService.updateForumPost(
        mapping.discordThreadId,
        threadTitle,
        threadContent,
        tagIds,
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

      // Discord 태그 생성/조회 (labels + closed)
      const tagIds: string[] = [];
      if (issue.labels && Array.isArray(issue.labels)) {
        for (const label of issue.labels) {
          const tagId = await this.discordService.getOrCreateTag(label.title);
          tagIds.push(tagId);
        }
      }
      // "closed" 태그 추가
      const closedTagId = await this.discordService.getOrCreateTag('closed');
      tagIds.push(closedTagId);

      // Discord 스레드 태그 업데이트
      const client = this.discordService['discordBot'].getClient();
      const thread = await client.channels.fetch(mapping.discordThreadId);
      if (thread && thread.isThread()) {
        await thread.setAppliedTags(tagIds);
      }

      // Discord Embed 생성
      const embed = new EmbedBuilder()
        .setColor(0xff0000) // 빨간색
        .setTitle('🔒 이슈 종료')
        .setDescription('이슈가 종료되었습니다.')
        .addFields({
          name: '링크',
          value: `[깃렙에서 이슈 보기](${issue.url})`,
        });

      // Discord 스레드에 Embed 전송
      await this.discordService.sendThreadEmbed(mapping.discordThreadId, embed);

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

      // Discord 태그 생성/조회 (labels + opened)
      const tagIds: string[] = [];
      if (issue.labels && Array.isArray(issue.labels)) {
        for (const label of issue.labels) {
          const tagId = await this.discordService.getOrCreateTag(label.title);
          tagIds.push(tagId);
        }
      }
      // "opened" 태그 추가
      const openedTagId = await this.discordService.getOrCreateTag('opened');
      tagIds.push(openedTagId);

      // Discord 스레드 태그 업데이트
      const client = this.discordService['discordBot'].getClient();
      const thread = await client.channels.fetch(mapping.discordThreadId);
      if (thread && thread.isThread()) {
        await thread.setAppliedTags(tagIds);
      }

      // Discord Embed 생성
      const embed = new EmbedBuilder()
        .setColor(0x00ff00) // 초록색
        .setTitle('🔓 이슈 재오픈')
        .setDescription('이슈가 다시 열렸습니다.')
        .addFields({
          name: '링크',
          value: `[깃렙에서 이슈 보기](${issue.url})`,
        });

      // Discord 스레드에 Embed 전송
      await this.discordService.sendThreadEmbed(mapping.discordThreadId, embed);

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

  private async handleIssueDelete(event: any) {
    this.logger.log(
      `🗑️ 이슈 삭제 이벤트 수신: ${event.object_attributes.title}`,
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

      // Discord 스레드 삭제
      await this.discordService.deleteThread(mapping.discordThreadId);

      // DB 매핑 삭제
      await mapping.delete();

      this.logger.log(
        `✅ 이슈 삭제 처리 완료: GitLab(${project.id}/${issue.iid}) → Discord(${mapping.discordThreadId})`,
      );

      return {
        message: 'Issue deleted successfully',
      };
    } catch (error) {
      this.logger.error('❌ 이슈 삭제 처리 중 오류:', error);
      throw error;
    }
  }
}
