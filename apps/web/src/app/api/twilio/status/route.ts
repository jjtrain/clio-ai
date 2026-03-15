import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Twilio message status callback
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const messageSid = formData.get("MessageSid") as string;
    const messageStatus = formData.get("MessageStatus") as string;
    const errorCode = formData.get("ErrorCode") as string;

    if (!messageSid || !messageStatus) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Find message by external ID
    const message = await db.textMessage.findFirst({
      where: { externalId: messageSid },
    });

    if (!message) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Map Twilio status to our status
    const statusMap: Record<string, string> = {
      queued: "QUEUED",
      sent: "SENT",
      delivered: "DELIVERED",
      failed: "FAILED",
      undelivered: "FAILED",
    };

    const newStatus = statusMap[messageStatus] || message.status;
    const data: any = { status: newStatus };

    if (messageStatus === "delivered") {
      data.deliveredAt = new Date();
    }
    if (messageStatus === "failed" || messageStatus === "undelivered") {
      data.errorMessage = errorCode ? `Error code: ${errorCode}` : "Message delivery failed";
    }

    await db.textMessage.update({
      where: { id: message.id },
      data,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[Twilio Status] Error:", error);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
