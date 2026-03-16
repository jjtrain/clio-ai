import { db } from "@/lib/db";
import { refreshQBToken } from "@/lib/quickbooks";
import { refreshXeroToken } from "@/lib/xero";

export async function refreshIfExpired(integration: {
  id: string;
  provider: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
}): Promise<string> {
  if (!integration.accessToken || !integration.refreshToken) {
    throw new Error("No tokens available");
  }

  // Check if token expires within 5 minutes
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);
  if (integration.tokenExpiresAt && integration.tokenExpiresAt > fiveMinFromNow) {
    return integration.accessToken;
  }

  // Token expired or expiring soon — refresh
  let result: { accessToken: string; refreshToken: string; expiresIn: number };

  if (integration.provider === "QUICKBOOKS") {
    result = await refreshQBToken(integration.refreshToken);
  } else if (integration.provider === "XERO") {
    result = await refreshXeroToken(integration.refreshToken);
  } else {
    throw new Error(`Unknown provider: ${integration.provider}`);
  }

  // Update database
  await db.accountingIntegration.update({
    where: { id: integration.id },
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      tokenExpiresAt: new Date(Date.now() + result.expiresIn * 1000),
    },
  });

  return result.accessToken;
}
