import { prisma } from "@/lib/prisma";
import { badId, notFound, validateGrowth } from "@/lib/validators";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/growth/[id]">) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) return badId();
  const existing = await prisma.growth.findUnique({ where: { id: numId } });
  if (!existing) return notFound();

  const body = await request.json().catch(() => null);
  const result = await validateGrowth(body ?? {});
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  const growth = await prisma.growth.update({ where: { id: numId }, data: result.data! });
  return Response.json(growth);
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/growth/[id]">) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) return badId();
  const existing = await prisma.growth.findUnique({ where: { id: numId } });
  if (!existing) return notFound();
  await prisma.growth.delete({ where: { id: numId } });
  return Response.json({ ok: true });
}
