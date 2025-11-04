CREATE TABLE "issue_mapping" (
	"gitlab_project_id" integer NOT NULL,
	"gitlab_issue_id" integer NOT NULL,
	"discord_thread_id" text NOT NULL,
	"gitlab_author_id" integer,
	"gitlab_author_name" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "issue_mapping_gitlab_project_id_gitlab_issue_id_pk" PRIMARY KEY("gitlab_project_id","gitlab_issue_id")
);
--> statement-breakpoint
CREATE TABLE "user_mapping" (
	"discord_user_id" text PRIMARY KEY NOT NULL,
	"gitlab_user_id" integer,
	"gitlab_username" text
);
