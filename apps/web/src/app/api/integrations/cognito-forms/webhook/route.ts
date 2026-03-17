import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncInbound, syncFormSubmission } from "@/lib/crm-sync-engine";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const provider = payload.provider || "UNKNOWN";

    if (payload.type?.includes("form") || payload.event?.includes("form") || payload.event?.includes("entry")) {
      const fields = payload.fields || payload.data || payload;
      await syncFormSubmission(provider, {
        externalFormId: payload.form_id || payload.formId,
        formName: payload.form_name || payload.formName || "External Form",
        fields: typeof fields === "string" ? JSON.parse(fields) : fields,
        respondentName: payload.name || payload.respondent_name,
        respondentEmail: payload.email || payload.respondent_email,
        respondentPhone: payload.phone || payload.respondent_phone,
      });
    } else if (payload.type?.includes("contact") || payload.event?.includes("lead") || payload.event?.includes("contact")) {
      await syncInbound(provider, {
        externalId: payload.id || payload.contact_id || payload.lead_id || String(Date.now()),
        firstName: payload.firstName || payload.first_name || payload.properties?.firstname,
        lastName: payload.lastName || payload.last_name || payload.properties?.lastname,
        email: payload.email || payload.properties?.email,
        phone: payload.phone || payload.properties?.phone,
        source: payload.source || payload.lead_source,
      });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[CRM Webhook] Error:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
