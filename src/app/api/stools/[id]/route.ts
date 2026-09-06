import { prisma } from "@/lib/prisma";
import { badId, notFound, validateStool } from "@/lib/validators";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/stools/[id]">) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) return badId();
  const existing = await prisma.stool.findUnique({ where: { id: numId } });
  if (!existing) return notFound();

  const body = await request.json().catch(() => null);
  const result = await validateStool(body ?? {});
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  const stool = await prisma.stool.update({ where: { id: numId }, data: result.data! });
  return Response.json(stool);
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/stools/[id]">) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) return badId();
  const existing = await prisma.stool.findUnique({ where: { id: numId } });
  if (!existing) return notFound();
  await prisma.stool.delete({ where: { id: numId } });
  return Response.json({ ok: true });
}
