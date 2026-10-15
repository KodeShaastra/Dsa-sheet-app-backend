-- CreateEnum
CREATE TYPE "difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "scheduled_problem_status" AS ENUM ('PENDING', 'DONE', 'SKIPPED');

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
CREATE TABLE "solved_problems" (
    "user_id" UUID NOT NULL,
    "problem_id" INTEGER NOT NULL,
    "solved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solved_problems_pkey" PRIMARY KEY ("user_id","problem_id")
);

-- CreateTable
CREATE TABLE "scheduled_problems" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "problem_id" INTEGER NOT NULL,
    "scheduled_for" DATE NOT NULL,
    "status" "scheduled_problem_status" NOT NULL DEFAULT 'PENDING',
    "note" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_problems_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "solved_problems_problem_id_idx" ON "solved_problems"("problem_id");

-- CreateIndex
CREATE INDEX "scheduled_problems_user_id_scheduled_for_idx" ON "scheduled_problems"("user_id", "scheduled_for");

-- CreateIndex
CREATE INDEX "scheduled_problems_problem_id_idx" ON "scheduled_problems"("problem_id");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_problems_user_id_problem_id_scheduled_for_key" ON "scheduled_problems"("user_id", "problem_id", "scheduled_for");

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solved_problems" ADD CONSTRAINT "solved_problems_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solved_problems" ADD CONSTRAINT "solved_problems_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_problems" ADD CONSTRAINT "scheduled_problems_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_problems" ADD CONSTRAINT "scheduled_problems_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Emails are always stored lowercase (Prisma can't express CHECK constraints, so it's added by hand).
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = LOWER("email"));
