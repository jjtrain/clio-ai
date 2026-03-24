import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const raw = crypto.randomBytes(32).toString("base64url");
  const rawKey = `mng_live_${raw}`;
  const keyHash = bcrypt.hashSync(rawKey, 10);
  const keyPrefix = rawKey.slice(0, 12);
  return { rawKey, keyHash, keyPrefix };
}

export async function validateApiKey(rawKey: string): Promise<{
  valid: boolean;
  apiKey?: any;
  firmId?: string;
  scopes?: string[];
} | null> {
  if (!rawKey || !rawKey.startsWith("mng_")) return null;

  const prefix = rawKey.slice(0, 12);
  const candidates = await db.apiKey.findMany({
    where: { keyPrefix: prefix, isActive: true },
  });

  for (const candidate of candidates) {
    if (candidate.expiresAt && candidate.expiresAt < new Date()) continue;
    if (bcrypt.compareSync(rawKey, candidate.keyHash)) {
      // Update last used
      await db.apiKey.update({
        where: { id: candidate.id },
        data: { lastUsedAt: new Date() },
      });
      return {
        valid: true,
        apiKey: candidate,
        firmId: candidate.firmId,
        scopes: candidate.scopes.split(",").map((s) => s.trim()),
      };
    }
  }

  return null;
}

export function hasScope(scopes: string[], required: string): boolean {
  return scopes.includes(required);
}
