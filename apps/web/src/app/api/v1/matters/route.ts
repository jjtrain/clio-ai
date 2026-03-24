import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest } from "@/lib/api/auth-middleware";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, "MATTERS_READ");
  if ("error" in auth) return auth.error;
  const url = req.nextUrl;
  const page = Number(url.searchParams.get("page") || "1");
  const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 100);
  const status = url.searchParams.get("status");
  const practiceArea = url.searchParams.get("practiceArea");

  const where: any = {};
  if (status) where.status = status;
  if (practiceArea) where.practiceArea = practiceArea;

  const [data, total] = await Promise.all([
    db.matter.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" }, include: { client: { select: { name: true, email: true } } } }),
    db.matter.count({ where }),
  ]);
  return NextResponse.json({ data, meta: { total, page, limit } });
}
