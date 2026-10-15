-- CreateEnum
CREATE TYPE "difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "plan_status" AS ENUM ('PLANNED', 'DONE', 'SKIPPED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" SERIAL NOT NULL,
    "chapter_id" INTEGER NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problems" (
    "id" SERIAL NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "difficulty" "difficulty" NOT NULL,
    "youtube_url" VARCHAR(500),
    "practice_url" VARCHAR(500),
    "article_url" VARCHAR(500),
    "position" INTEGER NOT NULL,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_progress" (
    "user_id" UUID NOT NULL,
    "problem_id" INTEGER NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_progress_pkey" PRIMARY KEY ("user_id","problem_id")
);

-- CreateTable
CREATE TABLE "study_plans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "problem_id" INTEGER NOT NULL,
    "planned_date" DATE NOT NULL,
    "status" "plan_status" NOT NULL DEFAULT 'PLANNED',
    "note" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_slug_key" ON "chapters"("slug");

-- CreateIndex
CREATE INDEX "topics_chapter_id_position_idx" ON "topics"("chapter_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "topics_chapter_id_title_key" ON "topics"("chapter_id", "title");

-- CreateIndex
CREATE INDEX "problems_topic_id_position_idx" ON "problems"("topic_id", "position");

-- CreateIndex
CREATE INDEX "problems_difficulty_idx" ON "problems"("difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "problems_topic_id_title_key" ON "problems"("topic_id", "title");

-- CreateIndex
CREATE INDEX "user_progress_problem_id_idx" ON "user_progress"("problem_id");

-- CreateIndex
CREATE INDEX "study_plans_user_id_planned_date_idx" ON "study_plans"("user_id", "planned_date");

-- CreateIndex
CREATE INDEX "study_plans_problem_id_idx" ON "study_plans"("problem_id");

-- CreateIndex
CREATE UNIQUE INDEX "study_plans_user_id_problem_id_planned_date_key" ON "study_plans"("user_id", "problem_id", "planned_date");

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_plans" ADD CONSTRAINT "study_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_plans" ADD CONSTRAINT "study_plans_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Emails are always stored lowercase (Prisma can't express CHECK constraints, so it's added by hand).
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = LOWER("email"));
