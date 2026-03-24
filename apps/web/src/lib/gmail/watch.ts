import { db } from "@/lib/db";
import { getAuthorizedClient } from "./oauth";

const PUBSUB_TOPIC = process.env.GOOGLE_PUBSUB_TOPIC || "";

export async function setupGmailWatch(userId: string): Promise<string | null> {
  if (!PUBSUB_TOPIC) {
    console.log("[Gmail Watch] GOOGLE_PUBSUB_TOPIC not configured, skipping watch setup");
    return null;
  }

  const { gmail } = await getAuthorizedClient(userId);

  const res = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName: PUBSUB_TOPIC,
      labelIds: ["INBOX", "SENT"],
    },
  });

  const historyId = res.data.historyId || null;
  const expiration = res.data.expiration ? new Date(parseInt(res.data.expiration)) : new Date(Date.now() + 7 * 86400000);

  await db.gmailConnection.update({
    where: { userId },
    data: {
      historyId,
      watchExpiry: expiration,
    },
  });

  return historyId;
}

export async function renewGmailWatch(userId: string): Promise<void> {
  await setupGmailWatch(userId);
}

export async function stopGmailWatch(userId: string): Promise<void> {
  try {
    const { gmail } = await getAuthorizedClient(userId);
    await gmail.users.stop({ userId: "me" });
  } catch {
    // Ignore errors on stop
  }

  await db.gmailConnection.update({
    where: { userId },
    data: { watchExpiry: null, watchResourceId: null },
  });
}
