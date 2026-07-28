import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/clerk";
import { writeAppLog } from "@/lib/app-log";
import {
  BlogImageUploadError,
  isBlogImageKind,
  storeBlogImage,
} from "@/lib/blog-image-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getAbsoluteMediaUrl(path: string, requestUrl: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      return new URL(path, configured).toString();
    } catch {
      console.error(
        "[admin/blog/uploads POST] NEXT_PUBLIC_APP_URL is invalid; using request origin."
      );
    }
  }
  return new URL(path, requestUrl).toString();
}

export async function POST(request: Request) {
  let admin: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    admin = await requireAdminUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const kind = formData.get("kind");
    const file = formData.get("file");

    if (!isBlogImageKind(kind)) {
      return NextResponse.json(
        { error: "Image kind must be hero or thumbnail." },
        { status: 400 }
      );
    }
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Choose a JPG, JPEG, or PNG image." },
        { status: 400 }
      );
    }

    const stored = await storeBlogImage({
      bytes: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
      kind,
      originalName: file.name,
    });
    const absoluteUrl = getAbsoluteMediaUrl(stored.path, request.url);

    await writeAppLog({
      category: "BLOG",
      level: "SUCCESS",
      title: `Uploaded ${kind} image as WebP`,
      actor: admin.email || admin.dbUserId,
      route: "/api/admin/blog/uploads",
      metadata: {
        kind,
        path: stored.path,
        width: stored.width,
        height: stored.height,
        bytes: stored.bytes,
        sourceBytes: stored.sourceBytes,
      },
    }).catch((logError) => {
      console.error("[admin/blog/uploads POST] Failed to write audit log:", logError);
    });

    return NextResponse.json(
      {
        image: {
          path: stored.path,
          url: absoluteUrl,
          format: stored.format,
          width: stored.width,
          height: stored.height,
          bytes: stored.bytes,
          sourceBytes: stored.sourceBytes,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof BlogImageUploadError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error("[admin/blog/uploads POST]", error);
    return NextResponse.json(
      { error: "Image upload failed. Please try again." },
      { status: 500 }
    );
  }
}
