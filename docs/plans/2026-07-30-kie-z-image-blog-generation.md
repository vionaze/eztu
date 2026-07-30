# KIE Z-Image Blog Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate a distinct 16:9 hero and 4:3 thumbnail for every AI blog article through KIE Z-Image, then persist optimized WebP copies on the EZTopUp VPS.

**Architecture:** EZTopUp creates two asynchronous KIE tasks and records each task in PostgreSQL. KIE callbacks are authenticated with its HMAC key; the server then queries KIE for the canonical task result, downloads the generated image from an allowlisted HTTPS host, converts it through the existing Sharp storage pipeline, and updates the matching BlogPost image field. Admin polling and the hourly blog job reconcile pending tasks so a missed callback does not strand an image.

**Tech Stack:** Next.js 16 Route Handlers, React 19 admin UI, Prisma/PostgreSQL, KIE Market API, Node crypto, Sharp, node:test.

---

### Task 1: Persist image-generation jobs

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260730050000_kie_blog_image_generation/migration.sql`

**Steps:**
1. Add `BlogImageGeneration` with post relation, kind, prompt, aspect ratio, provider task ID, status, error, stored path, timestamps, and indexes.
2. Add a `BlogImageGenerationStatus` enum covering submitting, processing, succeeded, and failed.
3. Generate Prisma Client and validate the schema.

### Task 2: Implement and test the KIE protocol boundary

**Files:**
- Create: `apps/web/src/lib/kie-image.ts`
- Create: `apps/web/src/lib/kie-image.test.ts`

**Steps:**
1. Write failing tests for Z-Image request bodies, task-result parsing, HMAC verification, stale callbacks, and safe result-host validation.
2. Implement Bearer-authenticated task creation and task lookup against `https://api.kie.ai`.
3. Implement constant-time HMAC-SHA256 verification over `taskId.timestamp`.
4. Reject stale webhook timestamps, non-HTTPS downloads, private hosts, redirects, oversized responses, and unsupported image formats.
5. Run the focused node tests.

### Task 3: Orchestrate generation and local WebP persistence

**Files:**
- Modify: `apps/web/src/lib/blog-image-storage.ts`
- Modify: `apps/web/src/lib/blog-image-storage.test.ts`
- Create: `apps/web/src/lib/blog-image-generation.ts`

**Steps:**
1. Extend the internal storage path to accept provider WebP input without expanding the admin uploader's accepted file types.
2. Start hero and thumbnail KIE tasks independently and in parallel.
3. Mark replaced in-flight tasks as superseded so an older callback cannot overwrite a newer request.
4. Reconcile successful KIE tasks into immutable `/media/blog/...webp` paths and update only the matching BlogPost image field.
5. Log starts, successes, and failures without failing article publication.

### Task 4: Add authenticated admin and webhook endpoints

**Files:**
- Create: `apps/web/src/app/api/admin/blog/[id]/images/route.ts`
- Create: `apps/web/src/app/api/webhooks/kie/blog-images/route.ts`

**Steps:**
1. Add admin `POST` to save current prompts and start both task ratios.
2. Add admin `GET` to reconcile and return the latest status per image kind.
3. Add public KIE callback `POST`, require valid KIE HMAC headers, and finalize idempotently by task ID.
4. Return bounded, non-secret error messages.

### Task 5: Connect automatic publishing and admin controls

**Files:**
- Modify: `apps/web/src/lib/blog-ai-publish.ts`
- Modify: `apps/web/src/components/admin/BlogPostForm.tsx`
- Modify: `apps/web/src/app/(admin)/admin/blog/page.tsx`
- Modify: `apps/web/.env.example`

**Steps:**
1. After an AI post is persisted, start two image jobs when `KIE_IMAGE_GENERATION_ENABLED=true`.
2. Reconcile pending jobs during the hourly automatic blog run as a callback fallback.
3. Add a responsive “Generate both with KIE Z-Image” control, per-image status, retry behavior, and polling to the editor.
4. Update the blog list badges to distinguish processing and failed images from ordinary missing uploads.
5. Document `KIE_API_KEY`, `KIE_WEBHOOK_HMAC_KEY`, optional base URL/host allowlist, and callback requirements.

### Task 6: Verify the complete change

**Steps:**
1. Run focused `node:test` suites for KIE and image storage.
2. Run Prisma validation and generation.
3. Run web lint and monorepo typecheck.
4. Run the production build.
5. Inspect the final diff to ensure unrelated payment work remains untouched and no secret is committed.
