import { and, eq } from 'drizzle-orm';
import { DrizzleContext, issueMappingTable } from 'src/shared/drizzle';

export type CreateIssueMappingParam = {
  readonly gitlabProjectId: number;
  readonly gitlabIssueId: number;
  readonly discordThreadId: string;
  readonly gitlabAuthorId: number;
  readonly gitlabAuthorName: string;
};

export class IssueMappingEntity {
  readonly gitlabProjectId!: number;
  readonly gitlabIssueId!: number;
  readonly discordThreadId!: string;
  readonly gitlabAuthorId!: number | null;
  readonly gitlabAuthorName!: string | null;
  readonly state!: string;
  readonly createdAt!: Date | null;

  static create(param: CreateIssueMappingParam): IssueMappingEntity {
    return Object.assign(new IssueMappingEntity(), {
      gitlabProjectId: param.gitlabProjectId,
      gitlabIssueId: param.gitlabIssueId,
      discordThreadId: param.discordThreadId,
      gitlabAuthorId: param.gitlabAuthorId,
      gitlabAuthorName: param.gitlabAuthorName,
      state: 'opened',
      createdAt: new Date(),
    } satisfies Partial<IssueMappingEntity>);
  }

  static fromRaw(
    data: typeof issueMappingTable.$inferSelect,
  ): IssueMappingEntity {
    return Object.assign(new IssueMappingEntity(), {
      gitlabProjectId: data.gitlabProjectId,
      gitlabIssueId: data.gitlabIssueId,
      discordThreadId: data.discordThreadId,
      gitlabAuthorId: data.gitlabAuthorId,
      gitlabAuthorName: data.gitlabAuthorName,
      state: data.state,
      createdAt: data.createdAt,
    } satisfies Partial<IssueMappingEntity>);
  }

  static async findByGitlabIssue(
    projectId: number,
    issueId: number,
  ): Promise<IssueMappingEntity | null> {
    const result = await DrizzleContext.db().query.issueMappingTable.findFirst({
      where: and(
        eq(issueMappingTable.gitlabProjectId, projectId),
        eq(issueMappingTable.gitlabIssueId, issueId),
      ),
    });
    return result ? IssueMappingEntity.fromRaw(result) : null;
  }

  async save(): Promise<IssueMappingEntity> {
    const [raw] = await DrizzleContext.db()
      .insert(issueMappingTable)
      .values({
        gitlabProjectId: this.gitlabProjectId,
        gitlabIssueId: this.gitlabIssueId,
        discordThreadId: this.discordThreadId,
        gitlabAuthorId: this.gitlabAuthorId,
        gitlabAuthorName: this.gitlabAuthorName,
        state: this.state,
      })
      .returning();
    return IssueMappingEntity.fromRaw(raw);
  }

  async updateState(
    newState: 'opened' | 'closed',
  ): Promise<IssueMappingEntity> {
    const [raw] = await DrizzleContext.db()
      .update(issueMappingTable)
      .set({ state: newState })
      .where(
        and(
          eq(issueMappingTable.gitlabProjectId, this.gitlabProjectId),
          eq(issueMappingTable.gitlabIssueId, this.gitlabIssueId),
        ),
      )
      .returning();
    return IssueMappingEntity.fromRaw(raw);
  }

  async delete(): Promise<void> {
    await DrizzleContext.db()
      .delete(issueMappingTable)
      .where(
        and(
          eq(issueMappingTable.gitlabProjectId, this.gitlabProjectId),
          eq(issueMappingTable.gitlabIssueId, this.gitlabIssueId),
        ),
      );
  }
}
