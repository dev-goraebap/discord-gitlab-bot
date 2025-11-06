import { eq } from 'drizzle-orm';
import { DrizzleContext, userMappingTable } from 'src/shared/drizzle';

export type CreateUserMappingParam = {
  readonly discordUserId: string;
  readonly gitlabUserId: number;
  readonly gitlabUsername: string;
};

export class UserMappingEntity {
  readonly discordUserId!: string;
  readonly gitlabUserId!: number;
  readonly gitlabUsername!: string;

  static create(param: CreateUserMappingParam): UserMappingEntity {
    return Object.assign(new UserMappingEntity(), {
      discordUserId: param.discordUserId,
      gitlabUserId: param.gitlabUserId,
      gitlabUsername: param.gitlabUsername,
    } satisfies Partial<UserMappingEntity>);
  }

  static fromRaw(
    data: typeof userMappingTable.$inferSelect,
  ): UserMappingEntity {
    return Object.assign(new UserMappingEntity(), {
      discordUserId: data.discordUserId,
      gitlabUserId: data.gitlabUserId,
      gitlabUsername: data.gitlabUsername,
    } satisfies Partial<UserMappingEntity>);
  }

  static async findByDiscordId(
    discordUserId: string,
  ): Promise<UserMappingEntity | null> {
    const result = await DrizzleContext.db().query.userMappingTable.findFirst({
      where: eq(userMappingTable.discordUserId, discordUserId),
    });
    return result ? UserMappingEntity.fromRaw(result) : null;
  }

  static async findByGitlabId(
    gitlabUserId: number,
  ): Promise<UserMappingEntity | null> {
    const result = await DrizzleContext.db().query.userMappingTable.findFirst({
      where: eq(userMappingTable.gitlabUserId, gitlabUserId),
    });
    return result ? UserMappingEntity.fromRaw(result) : null;
  }

  async save(): Promise<UserMappingEntity> {
    const [raw] = await DrizzleContext.db()
      .insert(userMappingTable)
      .values({
        discordUserId: this.discordUserId,
        gitlabUserId: this.gitlabUserId,
        gitlabUsername: this.gitlabUsername,
      })
      .returning();
    return UserMappingEntity.fromRaw(raw);
  }

  async delete(): Promise<void> {
    await DrizzleContext.db()
      .delete(userMappingTable)
      .where(eq(userMappingTable.discordUserId, this.discordUserId));
  }
}
