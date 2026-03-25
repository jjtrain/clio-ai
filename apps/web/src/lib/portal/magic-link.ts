import crypto from "crypto";
import { db } from "@/lib/db";
import { sendDigestEmail } from "@/lib/email";

const MAGIC_LINK_EXPIRY_MINUTES = 15;

export async function generateMagicLink(email: string, firmName?: string): Promise<{ sent: boolean; error?: string }> {
  // Find portal user
  const portalUser = await db.clientPortalUser.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (!portalUser) return { sent: false, error: "No portal account found for this email" };

  // Generate token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60000);

  // Store in portal user (reuse existing token field or store in session)
  await db.clientPortalUser.update({
    where: { id: portalUser.id },
    data: { magicLinkToken: token, magicLinkExpiresAt: expiresAt },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const magicUrl = `${appUrl}/portal?token=${token}`;

  // Send email
  await sendDigestEmail({
    to: email,
    subject: `Sign in to your client portal — ${firmName || "Your Attorney"}`,
    html: `<div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
      <h2 style="font-size:18px;font-weight:500;color:#1a1a1a;margin-bottom:8px;">Sign in to your portal</h2>
      <p style="font-size:14px;color:#666;margin-bottom:24px;">Click below to securely access your case information. This link expires in ${MAGIC_LINK_EXPIRY_MINUTES} minutes.</p>
      <a href="${magicUrl}" style="display:inline-block;background:#1AA8A0;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:500;font-size:14px;">Sign In to Portal</a>
      <p style="font-size:12px;color:#999;margin-top:24px;">If you didn't request this, you can safely ignore this email.</p>
      <p style="font-size:11px;color:#ccc;margin-top:16px;">${firmName || "Your Attorney"} · Powered by Managal</p>
    </div>`,
    fromEmail: "portal@managal.com",
  });

  return { sent: true };
}

export async function verifyMagicLink(token: string): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const user = await db.clientPortalUser.findFirst({
    where: { magicLinkToken: token, magicLinkExpiresAt: { gt: new Date() } },
  });

  if (!user) return { valid: false, error: "Invalid or expired link" };

  // Clear token (single use)
  await db.clientPortalUser.update({
    where: { id: user.id },
    data: { magicLinkToken: null, magicLinkExpiresAt: null },
  });

  return { valid: true, userId: user.id };
}
