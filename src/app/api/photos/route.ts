import { prisma } from "@/lib/prisma";
import { isFutureDate, normalizeDate } from "@/lib/time";
import { saveUpload } from "@/lib/uploads";
import type { NextRequest } from "next/server";
import sharp from "sharp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp", "heic", "heif"];

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "上传内容无效" }, { status: 400 });
  }

  const date = normalizeDate(form.get("date"));
  if (!date) return Response.json({ error: "照片日期格式不正确" }, { status: 400 });
  if (isFutureDate(date)) return Response.json({ error: "照片日期不能是未来的日期" }, { status: 400 });

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return Response.json({ error: "请选择至少一张照片" }, { status: 400 });

  const notes = form.getAll("notes").map((n) => (typeof n === "string" ? n : ""));

  const created: { id: number }[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return Response.json(
        { error: `不支持的格式：${file.name}（仅支持 JPEG、PNG、WebP、HEIC）` },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: `照片过大：${file.name}（最大 50MB）` }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());

    let thumb: Buffer;
    try {
      thumb = await sharp(buf)
        .rotate() // 按 EXIF 自动转正
        .resize(400, 400, { fit: "inside" })
        .webp({ quality: 78 })
        .toBuffer();
    } catch {
      return Response.json({ error: `无法处理照片：${file.name}` }, { status: 400 });
    }

    const note = (notes[i] ?? "").trim().slice(0, 500) || null;
    const saved = await prisma.photo.create({
      data: {
        date,
        note,
        file: saveUpload(buf, ext),
        thumb: saveUpload(thumb, "webp"),
        mime: MIME_BY_EXT[ext] ?? "application/octet-stream",
      },
    });
    created.push({ id: saved.id });
  }

  return Response.json({ ok: true, created }, { status: 201 });
}
