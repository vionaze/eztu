CREATE TABLE "BlogPostDailyVisit" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "visitorHash" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BlogPostDailyVisit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BlogPostDailyVisit_postId_visitorHash_day_key"
ON "BlogPostDailyVisit"("postId", "visitorHash", "day");

CREATE INDEX "BlogPostDailyVisit_day_idx"
ON "BlogPostDailyVisit"("day");

CREATE INDEX "BlogPostDailyVisit_postId_day_idx"
ON "BlogPostDailyVisit"("postId", "day");

CREATE INDEX "BlogPostDailyVisit_visitorHash_day_idx"
ON "BlogPostDailyVisit"("visitorHash", "day");

ALTER TABLE "BlogPostDailyVisit"
ADD CONSTRAINT "BlogPostDailyVisit_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "BlogPost"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
