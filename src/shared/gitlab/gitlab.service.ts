import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GitlabIssue {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string;
  state: string;
  web_url: string;
  labels: string[];
  assignees: Array<{
    id: number;
    username: string;
    name: string;
  }>;
}

@Injectable()
export class GitlabService {
  private readonly logger = new Logger(GitlabService.name);
  private readonly gitlabUrl: string;
  private readonly gitlabToken: string;

  constructor(private configService: ConfigService) {
    this.gitlabUrl = this.configService.getOrThrow<string>('GITLAB_URL');
    this.gitlabToken = this.configService.getOrThrow<string>('GITLAB_TOKEN');
  }

  async getIssue(
    projectId: number,
    issueIid: number,
  ): Promise<GitlabIssue | null> {
    try {
      const response = await fetch(
        `${this.gitlabUrl}/api/v4/projects/${projectId}/issues/${issueIid}`,
        {
          headers: {
            'PRIVATE-TOKEN': this.gitlabToken,
          },
        },
      );

      if (!response.ok) {
        this.logger.error(
          `GitLab API 오류: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      const data = await response.json();
      return data as GitlabIssue;
    } catch (error) {
      this.logger.error('GitLab 이슈 조회 실패:', error);
      return null;
    }
  }
}
