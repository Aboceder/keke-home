import { prisma } from "@/lib/prisma";
import { validateFeeding } from "@/lib/validators";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await validateFeeding(body ?? {});
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  const feeding = await prisma.feeding.create({ data: result.data! });
  return Response.json(feeding, { status: 201 });
}
