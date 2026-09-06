import { prisma } from "@/lib/prisma";
import { isFutureDate, normalizeDate } from "@/lib/time";
import { resolveUpload } from "@/lib/uploads";
import { unlink } from "fs/promises";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/photos/[id]">) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) {
    return Response.json({ error: "无效的记录 ID" }, { status: 400 });
  }
  const existing = await prisma.photo.findUnique({ where: { id: numId } });
  if (!existing) return Response.json({ error: "记录不存在" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as {
    date?: unknown;
    note?: unknown;
  } | null;
  const date = normalizeDate(body?.date);
  if (!date) return Response.json({ error: "照片日期格式不正确" }, { status: 400 });
  if (isFutureDate(date)) return Response.json({ error: "照片日期不能是未来的日期" }, { status: 400 });

  const note =
    typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;

  const photo = await prisma.photo.update({ where: { id: numId }, data: { date, note } });
  return Response.json({ ok: true, id: photo.id, date: photo.date, note: photo.note });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/photos/[id]">) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) {
    return Response.json({ error: "无效的记录 ID" }, { status: 400 });
  }
  const existing = await prisma.photo.findUnique({ where: { id: numId } });
  if (!existing) return Response.json({ error: "记录不存在" }, { status: 404 });

  await prisma.photo.delete({ where: { id: numId } });
  for (const name of [existing.file, existing.thumb]) {
    const p = resolveUpload(name);
    if (p) await unlink(p).catch(() => {});
  }
  return Response.json({ ok: true });
}
