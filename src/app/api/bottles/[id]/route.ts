import { prisma } from "@/lib/prisma";
import { badId, notFound, validateBottle } from "@/lib/validators";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/bottles/[id]">) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) return badId();
  const existing = await prisma.bottle.findUnique({ where: { id: numId } });
  if (!existing) return notFound();

  const body = await request.json().catch(() => null);
  const result = await validateBottle(body ?? {});
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  const bottle = await prisma.bottle.update({ where: { id: numId }, data: result.data! });
  return Response.json(bottle);
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/bottles/[id]">) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) return badId();
  const existing = await prisma.bottle.findUnique({ where: { id: numId } });
  if (!existing) return notFound();
  await prisma.bottle.delete({ where: { id: numId } });
  return Response.json({ ok: true });
}
