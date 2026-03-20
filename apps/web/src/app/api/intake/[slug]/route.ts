import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as intakeEngine from "@/lib/intake-form-engine";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const form = await db.publicIntakeForm.findUnique({
      where: { slug: params.slug },
    });

    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    if (!form.isActive) {
      return NextResponse.json({ error: "Form is not active" }, { status: 410 });
    }

    if (!form.isPublished) {
      return NextResponse.json({ error: "Form is not published" }, { status: 404 });
    }

    if ((form as any).expiresAt && new Date((form as any).expiresAt) < new Date()) {
      return NextResponse.json({ error: "Form has expired" }, { status: 410 });
    }

    // Increment view count in background
    db.publicIntakeForm.update({
      where: { id: form.id },
      data: { totalViews: { increment: 1 } },
    }).catch(() => {});

    if ((form as any).requiresPassword) {
      return NextResponse.json({
        name: form.name,
        description: (form as any).description,
        requiresPassword: true,
      });
    }

    const config = form as any;
    return NextResponse.json({
      id: form.id,
      name: form.name,
      slug: form.slug,
      description: config.description,
      sections: config.sections,
      fields: config.fields,
      styling: config.styling,
      branding: config.branding,
      legalText: config.legalText,
      consentCheckboxes: config.consentCheckboxes,
      captchaEnabled: config.captchaEnabled,
      captchaSiteKey: config.captchaSiteKey,
      // Intentionally omit: captchaSecretKey, password, notificationEmails
    });
  } catch (error) {
    console.error("GET /api/intake/[slug] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const form = await db.publicIntakeForm.findUnique({
      where: { slug: params.slug },
    });

    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    if (!form.isActive || !form.isPublished) {
      return NextResponse.json({ error: "Form is not accepting submissions" }, { status: 403 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    // Rate limit: check recent submissions from same IP
    const recentCount = await db.intakeSubmission.count({
      where: {
        formId: form.id,
        submitterIp: ip,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });

    if (recentCount >= 5) {
      return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 });
    }

    const body = await req.json();
    const { responses, captchaToken, files } = body;

    const submission = await intakeEngine.processSubmission(form.id, {
      responses,
      submitterIp: ip,
      submitterUserAgent: req.headers.get("user-agent") || undefined,
    });

    // Assess quality in background (don't await)
    if (submission.submissionId) intakeEngine.assessSubmissionQuality(submission.submissionId).catch(() => {});

    const config = form as any;
    return NextResponse.json({
      success: true,
      ...(config.confirmationRedirectUrl
        ? { confirmationRedirectUrl: config.confirmationRedirectUrl }
        : { confirmationMessage: config.confirmationMessage ?? "Thank you for your submission." }),
    });
  } catch (error) {
    console.error("POST /api/intake/[slug] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
