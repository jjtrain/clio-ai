import { NextRequest, NextResponse } from "next/server";
import { processWebhook } from "@/lib/integrations/outlook";

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const validationToken = url.searchParams.get("validationToken");

    if (validationToken) {
      return new NextResponse(validationToken, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const body = await req.json();
    const notifications = body?.value ?? [];

    for (const notification of notifications) {
      await processWebhook(notification);
    }

    return new NextResponse(null, { status: 202 });
  } catch (err: any) {
    console.error("[Outlook Webhook]", err);
    return new NextResponse(null, { status: 202 });
  }
}
