CREATE TYPE "BlogImageGenerationStatus" AS ENUM (
  'SUBMITTING',
  'PROCESSING',
  'DOWNLOADING',
  'SUCCEEDED',
  'FAILED'
);

CREATE TABLE "BlogImageGeneration" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'kie',
  "model" TEXT NOT NULL DEFAULT 'z-image',
  "prompt" TEXT NOT NULL,
  "aspectRatio" TEXT NOT NULL,
  "taskId" TEXT,
  "status" "BlogImageGenerationStatus" NOT NULL DEFAULT 'SUBMITTING',
  "error" TEXT,
  "storedImagePath" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BlogImageGeneration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BlogImageGeneration_taskId_key"
ON "BlogImageGeneration"("taskId");

CREATE INDEX "BlogImageGeneration_postId_kind_createdAt_idx"
ON "BlogImageGeneration"("postId", "kind", "createdAt");

CREATE INDEX "BlogImageGeneration_status_createdAt_idx"
ON "BlogImageGeneration"("status", "createdAt");

ALTER TABLE "BlogImageGeneration"
ADD CONSTRAINT "BlogImageGeneration_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "BlogPost"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
