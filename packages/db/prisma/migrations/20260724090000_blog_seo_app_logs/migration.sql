-- Blog SEO + AI fields
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "thumbnailImage" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "countryCode" TEXT NOT NULL DEFAULT 'GLOBAL';
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "metaTitle" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "focusKeyword" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "canonicalUrl" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "ogTitle" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "ogDescription" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "structuredData" JSONB;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "aiGenerated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "aiModel" TEXT;

-- content as text (Postgres TEXT if not already)
ALTER TABLE "BlogPost" ALTER COLUMN "content" TYPE TEXT;

CREATE INDEX IF NOT EXISTS "BlogPost_published_publishedAt_idx" ON "BlogPost"("published", "publishedAt");
CREATE INDEX IF NOT EXISTS "BlogPost_countryCode_published_idx" ON "BlogPost"("countryCode", "published");
CREATE INDEX IF NOT EXISTS "BlogPost_category_idx" ON "BlogPost"("category");

-- App logs
DO $$ BEGIN
  CREATE TYPE "AppLogCategory" AS ENUM ('SALES', 'PAYMENT', 'FULFILLMENT', 'AUTH', 'SECURITY', 'BLOG', 'ADMIN', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AppLogLevel" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "AppLog" (
    "id" TEXT NOT NULL,
    "category" "AppLogCategory" NOT NULL,
    "level" "AppLogLevel" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "message" TEXT,
    "actor" TEXT,
    "route" TEXT,
    "orderId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AppLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AppLog_category_createdAt_idx" ON "AppLog"("category", "createdAt");
CREATE INDEX IF NOT EXISTS "AppLog_level_createdAt_idx" ON "AppLog"("level", "createdAt");
CREATE INDEX IF NOT EXISTS "AppLog_createdAt_idx" ON "AppLog"("createdAt");
