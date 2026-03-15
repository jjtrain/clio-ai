import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendCampaignEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

async function executeStep(execution: any, db: any) {
  try {
    const step = execution.step;
    const lead = execution.lead;

    const firmSettings = await db.settings.findUnique({ where: { id: "default" } });
    const firmName = firmSettings?.firmName || "Our Law Firm";

    const replacePlaceholders = (text: string) =>
      text
        .replace(/\{NAME\}/g, lead.name || "there")
        .replace(/\{FIRM_NAME\}/g, firmName)
        .replace(/\{PRACTICE_AREA\}/g, lead.practiceArea || "your legal matter")
        .replace(/\{EMAIL\}/g, lead.email || "");

    switch (step.actionType) {
      case "EMAIL": {
        if (!lead.email) {
          await db.followUpExecution.update({ where: { id: execution.id }, data: { status: "FAILED", executedAt: new Date(), errorMessage: "No email" } });
          return;
        }
        const subject = replacePlaceholders(step.emailSubject || "Follow-up");
        const html = replacePlaceholders(step.emailContent || "");
        await sendCampaignEmail({
          to: lead.email,
          name: lead.name,
          subject,
          htmlContent: html,
          fromEmail: firmSettings?.email || "noreply@example.com",
          firmName,
        });
        await db.leadActivity.create({
          data: { leadId: lead.id, type: "EMAIL_SENT", description: `Auto follow-up: ${subject}` },
        });
        break;
      }
      case "TASK": {
        await db.task.create({
          data: {
            title: replacePlaceholders(step.taskTitle || "Follow up"),
            description: replacePlaceholders(step.taskDescription || ""),
            status: "TODO",
            priority: "HIGH",
          },
        });
        break;
      }
      case "STATUS_CHANGE": {
        if (step.newStatus) {
          await db.lead.update({ where: { id: lead.id }, data: { status: step.newStatus } });
          await db.leadActivity.create({
            data: { leadId: lead.id, type: "STATUS_CHANGED", description: `Auto: status changed to ${step.newStatus}` },
          });
        }
        break;
      }
      case "NOTIFICATION": {
        console.log(`[Cron FollowUp] ${replacePlaceholders(step.notificationMessage || "")}`);
        break;
      }
    }

    await db.followUpExecution.update({
      where: { id: execution.id },
      data: { status: "COMPLETED", executedAt: new Date() },
    });
  } catch (err: any) {
    await db.followUpExecution.update({
      where: { id: execution.id },
      data: { status: "FAILED", executedAt: new Date(), errorMessage: err.message?.slice(0, 500) },
    });
  }
}

export async function GET() {
  try {
    // 1. Execute scheduled follow-ups that are due
    const dueExecutions = await db.followUpExecution.findMany({
      where: { status: "SCHEDULED", scheduledFor: { lte: new Date() } },
      include: { step: true, lead: true, sequence: true },
      take: 50,
    });

    let executed = 0;
    for (const exec of dueExecutions) {
      await executeStep(exec, db);
      executed++;
    }

    // 2. Check for no-response leads (3+ days without activity)
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
    const noResponseLeads = await db.lead.findMany({
      where: {
        status: { in: ["NEW", "CONTACTED"] },
        lastContactedAt: { lte: threeDaysAgo },
        followUpExecutions: { none: { sequence: { triggerEvent: "NO_RESPONSE" } } },
      },
      take: 10,
    });

    // Also check leads with no lastContactedAt but old createdAt
    const noContactLeads = await db.lead.findMany({
      where: {
        status: { in: ["NEW", "CONTACTED"] },
        lastContactedAt: null,
        createdAt: { lte: threeDaysAgo },
        followUpExecutions: { none: { sequence: { triggerEvent: "NO_RESPONSE" } } },
      },
      take: 10,
    });

    const allNoResponse = [...noResponseLeads, ...noContactLeads];
    let triggered = 0;

    const settings = await db.intakeScreeningSettings.findUnique({ where: { id: "default" } });
    if (settings?.followUpEnabled) {
      const noResponseSequences = await db.followUpSequence.findMany({
        where: { triggerEvent: "NO_RESPONSE", isActive: true },
        include: { steps: { where: { isActive: true }, orderBy: { stepNumber: "asc" } } },
      });

      for (const lead of allNoResponse) {
        for (const seq of noResponseSequences) {
          let scheduledFor = new Date();
          for (const step of seq.steps) {
            scheduledFor = new Date(scheduledFor.getTime() + step.delayDays * 86400000 + step.delayHours * 3600000);
            await db.followUpExecution.create({
              data: {
                sequenceId: seq.id,
                stepId: step.id,
                leadId: lead.id,
                status: "SCHEDULED",
                scheduledFor: new Date(scheduledFor),
              },
            });
          }
          triggered++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      executed,
      noResponseTriggered: triggered,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Cron FollowUp] Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
