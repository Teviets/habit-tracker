CREATE TABLE "habit_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(9) DEFAULT '#2E8067' NOT NULL,
	"icon" varchar(50) DEFAULT 'folder-outline' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "habit_group_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_premium" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "habit_groups" ADD CONSTRAINT "habit_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "habit_groups_user_idx" ON "habit_groups" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_habit_group_id_habit_groups_id_fk" FOREIGN KEY ("habit_group_id") REFERENCES "public"."habit_groups"("id") ON DELETE set null ON UPDATE no action;