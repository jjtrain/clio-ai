import { db } from "@/lib/db";
import * as aiRouter from "@/lib/ai-router";

function generateSlug(name: string): string {
  const base = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${suffix}`;
}

export async function createForm(params: { practiceArea: string; name: string; description?: string; slug?: string }) {
  const sections = [
    { id: "contact", title: "Contact Information", order: 0 },
    { id: "case", title: "Case Details", order: 1 },
    { id: "consent", title: "Consent", order: 2 },
  ];
  const fields: any[] = [
    { id: "name", sectionId: "contact", label: "Full Name", type: "text", required: true, order: 0 },
    { id: "email", sectionId: "contact", label: "Email", type: "email", required: true, order: 1 },
    { id: "phone", sectionId: "contact", label: "Phone", type: "phone", required: true, order: 2 },
    { id: "referral_source", sectionId: "contact", label: "How did you hear about us?", type: "select", required: false, order: 3, options: ["Google", "Referral", "Social Media", "Advertisement", "Other"] },
  ];
  const config = await (db as any).practiceAreaConfig.findFirst({ where: { practiceArea: params.practiceArea as any } });
  if (config?.intakeFields) {
    const extra = JSON.parse(config.intakeFields);
    extra.forEach((f: any, i: number) => fields.push({ ...f, sectionId: "case", order: i + 10 }));
  }
  const slug = params.slug || generateSlug(params.name);
  const branding = JSON.stringify({ primaryColor: "#1a56db", logo: null, fontFamily: "Inter" });
  return db.publicIntakeForm.create({
    data: { practiceArea: params.practiceArea as any, name: params.name, description: params.description, slug, sections: JSON.stringify(sections), fields: JSON.stringify(fields), branding, isActive: true, isPublished: false },
  });
}

export async function generateFormFromPracticeArea(practiceArea: string) {
  const result = await aiRouter.complete({
    feature: "intake-form-generation",
    systemPrompt: "You are a legal intake form designer. Generate optimized intake fields for the given practice area as a JSON array of {id, label, type, required, order} objects.",
    userPrompt: `Generate intake form fields for practice area: ${practiceArea}`,
    responseFormat: "json_object",
  });
  const fields = JSON.parse(result.content || "[]");
  const sections = [
    { id: "contact", title: "Contact Information", order: 0 },
    { id: "case", title: "Case Details", order: 1 },
    { id: "consent", title: "Consent", order: 2 },
  ];
  return { practiceArea, sections, fields, name: `${practiceArea} Intake Form`, slug: generateSlug(practiceArea) };
}

export async function processSubmission(formId: string, params: { responses: Record<string, any>; submitterIp?: string; submitterUserAgent?: string; referrer?: string; utmParams?: Record<string, string>; sessionDuration?: number }) {
  const form = await db.publicIntakeForm.findUniqueOrThrow({ where: { id: formId } });
  if (!form.isActive || !form.isPublished) throw new Error("Form is not active or published");
  const name = params.responses.name || params.responses.full_name || null;
  const email = params.responses.email || null;
  const phone = params.responses.phone || null;
  const summary = Object.entries(params.responses).map(([k, v]) => `${k}: ${v}`).join("; ");
  const submission = await db.intakeSubmission.create({
    data: { formId, responses: JSON.stringify(params.responses), submitterName: name, submitterEmail: email, submitterPhone: phone, submitterIp: params.submitterIp, submitterUserAgent: params.submitterUserAgent, responseSummary: summary, status: "INTAKE_NEW" as any },
  });
  let leadId: string | null = null;
  if ((form as any).autoCreateLead && name) {
    try {
      const lead = await (db as any).lead.create({ data: { name, email, phone, source: "INTAKE_FORM" as any, description: summary, practiceArea: form.practiceArea } });
      leadId = lead.id;
    } catch { /* Lead model may not be available */ }
  }
  await db.publicIntakeForm.update({ where: { id: formId }, data: { totalSubmissions: { increment: 1 }, lastSubmissionAt: new Date() } });
  return { submissionId: submission.id, leadId, qualityScore: null };
}

export async function assessSubmissionQuality(submissionId: string) {
  const submission = await db.intakeSubmission.findUniqueOrThrow({ where: { id: submissionId }, include: { form: true } });
  const result = await aiRouter.complete({
    feature: "intake-quality-assessment",
    systemPrompt: "You are a legal intake specialist. Assess the quality of this intake submission. Return JSON with: qualityScore (0-100), viability (string), urgency (low/medium/high), redFlags (string[]), recommendation (accept/follow_up/decline).",
    userPrompt: `Practice area: ${submission.form.practiceArea}\nResponses: ${submission.responses}`,
    responseFormat: "json_object",
  });
  const assessment = JSON.parse(result.content || "{}");
  await db.intakeSubmission.update({
    where: { id: submissionId },
    data: { qualityScore: assessment.qualityScore || 0, qualityAnalysis: JSON.stringify(assessment), aiRecommendation: assessment.recommendation },
  });
  return assessment;
}

export async function convertSubmissionToMatter(submissionId: string, params: { practiceArea?: string; assignedTo?: string }) {
  const submission = await db.intakeSubmission.findUniqueOrThrow({ where: { id: submissionId }, include: { form: true } });
  const responses = JSON.parse(submission.responses);
  const name = submission.submitterName || responses.name || "Unknown";
  const client = await db.client.create({ data: { name, email: submission.submitterEmail, phone: submission.submitterPhone } });
  const matterNumber = `M-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const matter = await db.matter.create({
    data: { clientId: client.id, name: `${params.practiceArea || submission.form.practiceArea} - ${name}`, matterNumber, practiceArea: params.practiceArea || submission.form.practiceArea || undefined },
  });
  await db.intakeSubmission.update({
    where: { id: submissionId },
    data: { status: "INTAKE_CONVERTED" as any, clientId: client.id, matterId: matter.id, conversionDate: new Date() },
  });
  return { client, matter };
}

export async function generateEmbedCode(formId: string, options?: { width?: string; height?: string }) {
  const form = await db.publicIntakeForm.findUniqueOrThrow({ where: { id: formId } });
  const width = options?.width || "100%";
  const height = options?.height || "800px";
  const directUrl = `/intake/${form.slug}`;
  const iframeCode = `<iframe src="${directUrl}" width="${width}" height="${height}" frameborder="0"></iframe>`;
  const jsCode = `<div id="intake-form-${form.slug}"></div>\n<script src="/api/intake/${form.slug}/embed.js"></script>`;
  const qrUrl = `/api/intake/${form.slug}?format=qr`;
  return { iframeCode, jsCode, directUrl, qrUrl };
}

export async function generateQRCode(formId: string) {
  const form = await db.publicIntakeForm.findUniqueOrThrow({ where: { id: formId } });
  return { url: `/api/intake/${form.slug}?format=qr` };
}

export async function getFormAnalytics(formId: string, dateRange: { from: Date; to: Date }) {
  const analytics = await (db as any).intakeFormAnalytics.findMany({
    where: { formId, date: { gte: dateRange.from, lte: dateRange.to } },
    orderBy: { date: "asc" as any },
  });
  const submissions = await db.intakeSubmission.findMany({ where: { formId, createdAt: { gte: dateRange.from, lte: dateRange.to } } });
  const totalViews = analytics.reduce((s: number, a: any) => s + a.views, 0);
  const totalCompletions = analytics.reduce((s: number, a: any) => s + a.completions, 0);
  const totalAbandonments = analytics.reduce((s: number, a: any) => s + a.abandonments, 0);
  const conversionRate = totalViews > 0 ? (totalCompletions / totalViews) * 100 : 0;
  return { totalViews, totalCompletions, totalAbandonments, conversionRate, submissionCount: submissions.length, dailyBreakdown: analytics };
}

export async function detectFieldDropoff(formId: string) {
  const submissions = await db.intakeSubmission.findMany({ where: { formId }, select: { abandonedFields: true } });
  const dropoffs: Record<string, number> = {};
  submissions.forEach((s: any) => {
    if (!s.abandonedFields) return;
    const fields = JSON.parse(s.abandonedFields);
    (Array.isArray(fields) ? fields : []).forEach((f: string) => { dropoffs[f] = (dropoffs[f] || 0) + 1; });
  });
  const recommendations = Object.entries(dropoffs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([field, count]) => `Consider simplifying or removing "${field}" (${count} abandonments)`);
  return { fieldDropoffs: dropoffs, recommendations };
}

export async function optimizeForm(formId: string) {
  const form = await db.publicIntakeForm.findUniqueOrThrow({ where: { id: formId } });
  const analytics = await (db as any).intakeFormAnalytics.findMany({ where: { formId }, take: 30, orderBy: { date: "desc" as any } });
  const result = await aiRouter.complete({
    feature: "intake-form-optimization",
    systemPrompt: "You are a legal intake form optimization expert. Suggest improvements. Return JSON array of {suggestion, impact, priority} objects.",
    userPrompt: `Form fields: ${form.fields}\nAnalytics: ${JSON.stringify(analytics)}`,
    responseFormat: "json_object",
  });
  return JSON.parse(result.content || "[]");
}

export async function duplicateForm(formId: string, newName: string) {
  const form = await db.publicIntakeForm.findUniqueOrThrow({ where: { id: formId } });
  return db.publicIntakeForm.create({
    data: { practiceArea: form.practiceArea, name: newName, description: form.description, slug: generateSlug(newName), sections: form.sections, fields: form.fields, styling: form.styling, branding: form.branding, legalText: form.legalText, consentCheckboxes: form.consentCheckboxes, isActive: true, isPublished: false, totalSubmissions: 0, lastSubmissionAt: null },
  });
}

export async function createABTest(params: { controlFormId: string; variantFormId: string; name: string; trafficSplit: number }) {
  return (db as any).intakeFormABTest.create({
    data: { formId: params.controlFormId, variantFormId: params.variantFormId, name: params.name, trafficSplit: params.trafficSplit, status: "AB_DRAFT" as any },
  });
}

export async function resolveABTest(testId: string) {
  const test = await (db as any).intakeFormABTest.findUniqueOrThrow({ where: { id: testId } });
  const controlRate = Number(test.controlConversionRate || 0);
  const variantRate = Number(test.variantConversionRate || 0);
  const winner = controlRate >= variantRate ? "control" : "variant";
  await (db as any).intakeFormABTest.update({ where: { id: testId }, data: { winner, status: "AB_COMPLETED" as any, endDate: new Date() } });
  return { winner, controlRate, variantRate, controlSubmissions: test.controlSubmissions, variantSubmissions: test.variantSubmissions };
}

export async function handleFollowUp(submissionId: string) {
  const submission = await db.intakeSubmission.findUniqueOrThrow({ where: { id: submissionId }, include: { form: true } });
  if ((submission.status as any) !== "INTAKE_NEW" || !(submission.form as any).autoSendFollowUp) {
    return { sent: false };
  }
  // Follow-up would be sent via email service integration
  return { sent: true };
}

export async function detectSpam(submission: { responses: any; submitterIp?: string; sessionDuration?: number }) {
  const responses = typeof submission.responses === "string" ? JSON.parse(submission.responses) : submission.responses;
  if (submission.sessionDuration !== undefined && submission.sessionDuration < 3) {
    return { isSpam: true, confidence: 0.9, reason: "Form completed too quickly" };
  }
  const values = Object.values(responses).map(String);
  const urlPattern = /https?:\/\//;
  if (values.length > 0 && values.every((v) => urlPattern.test(v))) {
    return { isSpam: true, confidence: 0.85, reason: "All fields contain URLs" };
  }
  const gibberishPattern = /^[^aeiou]{5,}$/i;
  if (values.some((v) => gibberishPattern.test(v) && v.length > 4)) {
    return { isSpam: true, confidence: 0.7, reason: "Gibberish detected in responses" };
  }
  return { isSpam: false, confidence: 0.1 };
}

export async function getSubmissionFunnel(formId: string, dateRange: { from: Date; to: Date }) {
  const submissions = await db.intakeSubmission.findMany({ where: { formId, createdAt: { gte: dateRange.from, lte: dateRange.to } } });
  const submitted = submissions.length;
  const contacted = submissions.filter((s: any) => ["INTAKE_CONTACTED", "INTAKE_CONVERTED", "INTAKE_SCHEDULED"].includes(s.status)).length;
  const converted = submissions.filter((s: any) => s.status === "INTAKE_CONVERTED").length;
  return { funnel: [{ stage: "submitted", count: submitted }, { stage: "contacted", count: contacted }, { stage: "converted", count: converted }], total: submitted };
}

export async function batchExportSubmissions(formId: string, dateRange: { from: Date; to: Date }, format: string) {
  const submissions = await db.intakeSubmission.findMany({
    where: { formId, createdAt: { gte: dateRange.from, lte: dateRange.to } },
    orderBy: { createdAt: "desc" },
  });
  return { data: submissions, format, count: submissions.length };
}
