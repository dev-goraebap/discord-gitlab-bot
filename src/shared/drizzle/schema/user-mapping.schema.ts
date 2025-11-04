import { integer, pgTable, text } from 'drizzle-orm/pg-core';

export const userMappingTable = pgTable('user_mapping', {
  discordUserId: text('discord_user_id').primaryKey(),
  gitlabUserId: integer('gitlab_user_id'),
  gitlabUsername: text('gitlab_username'),
});
