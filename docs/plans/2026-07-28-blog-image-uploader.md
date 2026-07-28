# Blog Image Uploader Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a secure admin uploader that converts JPG, JPEG, and PNG hero/thumbnail images to WebP, stores only the WebP on persistent VPS disk, and fills the resulting URL into blog articles.

**Architecture:** The admin editor sends multipart uploads to an authenticated Node.js Route Handler. A server-only storage module validates the file size and decoded image format, rotates and resizes it with Sharp, writes only a randomized `.webp` file beneath `BLOG_UPLOAD_DIR`, and returns a portable `/media/blog/...` path plus an absolute copy URL. A public read-only route serves only validated WebP paths with immutable cache headers.

**Tech Stack:** Next.js 16 Route Handlers, React 19, TypeScript, Sharp, Node filesystem/crypto, Clerk admin authorization.

---

## Design

The uploader lives inside the existing Images card in `BlogPostForm`, keeping the article workflow in one place. Hero and thumbnail use separate dropzones with clear aspect-ratio guidance, progress/error states, preview, and a copy-URL control. A successful upload immediately fills `coverImage` or `thumbnailImage`; the operator still controls when the article itself is saved or published.

Original JPG/PNG bytes are held in memory only. They are decoded by Sharp, auto-rotated using metadata, resized without enlargement, converted to WebP, and then the output is written atomically. Hero images are bounded for wide editorial use, while thumbnails use a smaller bound for cards and mobile. The API rejects unauthenticated users, unsupported MIME/decoded formats, empty files, oversized files, and invalid upload kinds.

Storage defaults to an ignored `.data/blog-images` directory beneath the web process working directory for local development. Production should set `BLOG_UPLOAD_DIR` to an absolute persistent directory owned by the PM2 application user, for example `/var/lib/eztopup/blog-images`. Public reads never accept arbitrary filesystem paths: the media route validates every segment, resolves beneath the configured root, and serves only `.webp` files.

### Task 1: Add tested WebP storage primitives

**Files:**
- Create: `apps/web/src/lib/blog-image-storage.ts`
- Create: `apps/web/src/lib/blog-image-storage.test.ts`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.gitignore`

1. Add Sharp as a direct web-app dependency.
2. Write tests for PNG/JPEG conversion, output metadata, size limits, upload-kind limits, and safe media path resolution.
3. Run the tests and confirm they fail before implementation.
4. Implement validation, conversion, atomic WebP-only storage, URL path creation, and safe path resolution.
5. Run the focused tests and confirm they pass.

### Task 2: Add authenticated upload and public media routes

**Files:**
- Create: `apps/web/src/app/api/admin/blog/uploads/route.ts`
- Create: `apps/web/src/app/media/blog/[...path]/route.ts`

1. Add an authenticated `POST` Route Handler using `request.formData()`.
2. Validate `kind` and `file`, pass bytes to the storage module, and log successful admin uploads without storing secrets.
3. Return the relative article path, absolute copy URL, dimensions, and output size.
4. Add a dynamic public `GET` handler that resolves only safe WebP paths.
5. Return immutable caching, content type, content length, ETag, and safe 404 responses.

### Task 3: Build the responsive uploader UI

**Files:**
- Create: `apps/web/src/components/admin/BlogImageUploader.tsx`
- Modify: `apps/web/src/components/admin/BlogPostForm.tsx`

1. Add accessible click/drag-and-drop file selection for JPG/JPEG/PNG.
2. Show the accepted format, maximum size, target dimensions, upload progress, inline errors, and converted file metadata.
3. On success, fill the appropriate blog image field and show a WebP preview.
4. Add copy-URL and replace-image actions with responsive spacing.
5. Retain editable URL inputs for external CDN URLs and manual correction.

### Task 4: Document and verify deployment

**Files:**
- Modify: `apps/web/.env.example`

1. Document `BLOG_UPLOAD_DIR` and the required VPS ownership/persistence.
2. Run focused storage tests.
3. Run targeted ESLint.
4. Run the monorepo typecheck.
5. Run a production build.
6. Smoke-test upload and public media retrieval locally without retaining test artifacts.
7. Inspect Git diff and confirm unrelated ClinkBill/payment work is not staged or overwritten.
