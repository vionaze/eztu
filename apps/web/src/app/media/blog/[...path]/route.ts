import { readFile, stat } from "node:fs/promises";
import { NextResponse } from "next/server";
import {
  BlogImageUploadError,
  resolveBlogImagePath,
} from "@/lib/blog-image-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { path } = await context.params;
    const filePath = resolveBlogImagePath(path);
    const [file, fileStat] = await Promise.all([
      readFile(filePath),
      stat(filePath),
    ]);
    const etag = `"${fileStat.size.toString(16)}-${Math.trunc(
      fileStat.mtimeMs
    ).toString(16)}"`;

    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(file.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: etag,
      },
    });
  } catch (error) {
    if (
      !(error instanceof BlogImageUploadError) &&
      (error as NodeJS.ErrnoException).code !== "ENOENT"
    ) {
      console.error("[media/blog GET]", error);
    }
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}
