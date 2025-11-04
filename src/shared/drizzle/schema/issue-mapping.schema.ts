import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const issueMappingTable = pgTable(
  'issue_mapping',
  {
    gitlabProjectId: integer('gitlab_project_id').notNull(),
    gitlabIssueId: integer('gitlab_issue_id').notNull(),
    discordThreadId: text('discord_thread_id').notNull(),
    gitlabAuthorId: integer('gitlab_author_id'),
    gitlabAuthorName: text('gitlab_author_name'),
    state: text('state').notNull().default('opened'),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.gitlabProjectId, table.gitlabIssueId] }),
  }),
);
