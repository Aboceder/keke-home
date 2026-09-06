import { prisma } from "@/lib/prisma";
import { validateStool } from "@/lib/validators";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await validateStool(body ?? {});
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  const stool = await prisma.stool.create({ data: result.data! });
  return Response.json(stool, { status: 201 });
}
