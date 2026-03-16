import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    let autoApproved = 0;
    let escalated = 0;

    // Process auto-approvals
    const pending = await db.approvalRequest.findMany({
      where: { status: "PENDING" },
      include: { workflow: true },
    });

    for (const req of pending) {
      const daysSince = Math.floor((Date.now() - new Date(req.submittedAt).getTime()) / (1000 * 60 * 60 * 24));

      // Auto-approve
      if (req.workflow.autoApproveEnabled && req.workflow.autoApproveAfterDays && daysSince >= req.workflow.autoApproveAfterDays) {
        await db.approvalAction.create({
          data: { requestId: req.id, stepNumber: req.currentStep, approverName: "System", action: "AUTO_APPROVED", comment: `Auto-approved after ${daysSince} days` },
        });
        await db.approvalRequest.update({
          where: { id: req.id },
          data: { status: "AUTO_APPROVED", completedAt: new Date() },
        });
        autoApproved++;
        continue;
      }

      // Escalate
      if (req.workflow.escalationEnabled && req.workflow.escalationAfterDays && daysSince >= req.workflow.escalationAfterDays) {
        const steps: any[] = JSON.parse(req.workflow.steps);
        const nextStep = steps.find((s: any) => s.stepNumber > req.currentStep);
        await db.approvalAction.create({
          data: { requestId: req.id, stepNumber: req.currentStep, approverName: "System", action: "ESCALATED", comment: `Escalated after ${daysSince} days` },
        });
        await db.approvalRequest.update({
          where: { id: req.id },
          data: { currentStep: nextStep ? nextStep.stepNumber : req.currentStep, status: nextStep ? "PENDING" : "ESCALATED" },
        });
        escalated++;
      }
    }

    return NextResponse.json({ autoApproved, escalated });
  } catch (err: any) {
    console.error("[Approvals Cron] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
