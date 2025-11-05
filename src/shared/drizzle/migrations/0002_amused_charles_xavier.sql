ALTER TABLE "issue_mapping" ADD COLUMN "gitlab_assignee_id" integer;--> statement-breakpoint
ALTER TABLE "issue_mapping" DROP COLUMN "gitlab_author_id";--> statement-breakpoint
ALTER TABLE "issue_mapping" DROP COLUMN "gitlab_author_name";