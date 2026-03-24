import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api/auth-middleware";
export const dynamic = "force-dynamic";

const PRACTICE_AREAS = [
  "personal_injury", "family_law", "immigration", "corporate",
  "real_estate", "criminal_defense", "estate_planning", "litigation",
  "bankruptcy", "employment", "intellectual_property", "tax",
];

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  return NextResponse.json({ data: PRACTICE_AREAS.map((pa) => ({ id: pa, label: pa.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) })) });
}
