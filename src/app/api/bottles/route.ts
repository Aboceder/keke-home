import { prisma } from "@/lib/prisma";
import { validateBottle } from "@/lib/validators";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await validateBottle(body ?? {});
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  const bottle = await prisma.bottle.create({ data: result.data! });
  return Response.json(bottle, { status: 201 });
}
