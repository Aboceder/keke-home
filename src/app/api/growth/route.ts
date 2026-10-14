import { birthDate } from "@/lib/age";
import { prisma } from "@/lib/prisma";
import { validateGrowth } from "@/lib/validators";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 成长记录全量返回（一年几十条，不做分页）：日期倒序，同一天后录入的在前。
 * 一并返回出生日期，页面据此显示每条记录的月龄（未配置时为 null）。
 */
export async function GET() {
  const rows = await prisma.growth.findMany({
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
  return Response.json({ birthDate: birthDate(), rows });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await validateGrowth(body ?? {});
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  const growth = await prisma.growth.create({ data: result.data! });
  return Response.json(growth, { status: 201 });
}
