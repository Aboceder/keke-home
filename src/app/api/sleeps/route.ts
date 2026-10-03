import { prisma } from "@/lib/prisma";
import { validateSleep } from "@/lib/validators";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await validateSleep(body ?? {});
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  const sleep = await prisma.sleep.create({ data: result.data! });
  return Response.json(sleep, { status: 201 });
}