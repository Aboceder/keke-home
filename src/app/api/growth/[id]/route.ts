import { Prisma } from "@prisma/client";
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
  try {
    const growth = await prisma.growth.update({ where: { id: numId }, data: result.data! });
    return Response.json(growth);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return notFound();
    }
    throw error;
  }
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/growth/[id]">) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) return badId();
  try {
    await prisma.growth.delete({ where: { id: numId } });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return notFound();
    }
    throw error;
  }
}
