import { prisma } from "@/lib/prisma";
import { resolveUpload } from "@/lib/uploads";
import { readFile } from "fs/promises";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export async function GET(request: NextRequest, ctx: RouteContext<"/api/photos/[id]/image">) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) {
    return new Response("Bad Request", { status: 400 });
  }
  const photo = await prisma.photo.findUnique({ where: { id: numId } });
  if (!photo) return new Response("Not Found", { status: 404 });

  const wantThumb = request.nextUrl.searchParams.get("v") === "thumb";
  const filename = wantThumb ? photo.thumb : photo.file;
  const path = resolveUpload(filename);
  if (!path) return new Response("Not Found", { status: 404 });

  try {
    const buf = await readFile(path);
    const ext = (filename.split(".").pop() ?? "").toLowerCase();
    const mime =
      wantThumb
        ? "image/webp"
        : (MIME_BY_EXT[ext] ?? photo.mime ?? "application/octet-stream");
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}
