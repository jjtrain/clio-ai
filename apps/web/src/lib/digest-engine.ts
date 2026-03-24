import { db } from "@/lib/db";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.managal.com";

export interface DigestSection {
  key: string;
  title: string;
  items: any[];
  link: string;
}

export interface DigestPayload {
  userName: string;
  userEmail: string;
  firmName: string;
  date: string;
  sections: DigestSection[];
}

export async function buildDigestForUser(userId: string): Promise<DigestPayload> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, email: true, firmName: true },
  });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const dayAfterTomorrow = new Date(today.getTime() + 2 * 86400000);
  const yesterday = new Date(today.getTime() - 86400000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysOut = new Date(today.getTime() + 7 * 86400000);

  // Get user's digest preference for section filtering
  const pref = await db.digestPreference.findUnique({ where: { userId } });
  const enabledSections: Record<string, boolean> = pref?.sections
    ? (typeof pref.sections === "string" ? JSON.parse(pref.sections as string) : pref.sections as any)
    : { deadlines: true, tasks: true, unbilled: true, hearings: true, payments: true, stats: true };

  const sections: DigestSection[] = [];

  // 1. Today's deadlines
  if (enabledSections.deadlines !== false) {
    const deadlineMatters = await db.matter.findMany({
      where: {
        OR: [
          { tasks: { some: { dueDate: { gte: today, lt: dayAfterTomorrow }, status: { not: "COMPLETED" }, assigneeId: userId } } },
        ],
      },
      include: {
        tasks: {
          where: { dueDate: { gte: today, lt: dayAfterTomorrow }, status: { not: "COMPLETED" }, assigneeId: userId },
          select: { id: true, title: true, dueDate: true, priority: true },
          orderBy: { priority: "desc" },
        },
        client: { select: { name: true } },
      },
    });

    const deadlineItems = deadlineMatters.flatMap((m) =>
      m.tasks.map((t) => ({
        task: t.title,
        matter: m.name,
        client: m.client?.name || "—",
        priority: t.priority,
        dueDate: t.dueDate,
        link: `${APP_URL}/matters/${m.id}`,
      }))
    );

    // Also check tomorrow
    const tomorrowMatters = await db.matter.findMany({
      where: {
        tasks: { some: { dueDate: { gte: tomorrow, lt: dayAfterTomorrow }, status: { not: "COMPLETED" }, assigneeId: userId } },
      },
      include: {
        tasks: {
          where: { dueDate: { gte: tomorrow, lt: dayAfterTomorrow }, status: { not: "COMPLETED" }, assigneeId: userId },
          select: { id: true, title: true, dueDate: true, priority: true },
        },
        client: { select: { name: true } },
      },
    });

    const tomorrowItems = tomorrowMatters.flatMap((m) =>
      m.tasks.map((t) => ({
        task: t.title,
        matter: m.name,
        client: m.client?.name || "—",
        priority: t.priority,
        dueDate: t.dueDate,
        isTomorrow: true,
        link: `${APP_URL}/matters/${m.id}`,
      }))
    );

    const allDeadlines = [...deadlineItems, ...tomorrowItems];
    if (allDeadlines.length > 0) {
      sections.push({
        key: "deadlines",
        title: "Today's Deadlines",
        items: allDeadlines,
        link: `${APP_URL}/tasks`,
      });
    }
  }

  // 2. Overdue tasks
  if (enabledSections.tasks !== false) {
    const overdueTasks = await db.task.findMany({
      where: {
        assigneeId: userId,
        status: { not: "COMPLETED" },
        dueDate: { lt: today },
      },
      include: {
        matter: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 20,
    });

    if (overdueTasks.length > 0) {
      const grouped: Record<string, any[]> = {};
      for (const t of overdueTasks) {
        const mName = t.matter?.name || "No Matter";
        if (!grouped[mName]) grouped[mName] = [];
        grouped[mName].push({
          task: t.title,
          dueDate: t.dueDate,
          daysOverdue: Math.ceil((today.getTime() - (t.dueDate?.getTime() || 0)) / 86400000),
          link: t.matter ? `${APP_URL}/matters/${t.matter.id}` : `${APP_URL}/tasks`,
        });
      }
      sections.push({
        key: "tasks",
        title: "Overdue Tasks",
        items: Object.entries(grouped).map(([matter, tasks]) => ({ matter, tasks })),
        link: `${APP_URL}/tasks`,
      });
    }
  }

  // 3. Unbilled time from yesterday
  if (enabledSections.unbilled !== false) {
    const unbilledEntries = await db.timeEntry.findMany({
      where: {
        userId,
        date: { gte: yesterday, lt: today },
        invoiceId: null,
      },
      include: {
        matter: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    });

    if (unbilledEntries.length > 0) {
      const totalHours = unbilledEntries.reduce((s, e) => s + (e.hours || e.duration / 60), 0);
      const estimatedValue = unbilledEntries.reduce((s, e) => {
        const hours = e.hours || e.duration / 60;
        const rate = Number(e.rate || 0);
        return s + hours * rate;
      }, 0);

      sections.push({
        key: "unbilled",
        title: "Unbilled Time (Yesterday)",
        items: unbilledEntries.map((e) => ({
          description: e.description,
          hours: Math.round((e.hours || e.duration / 60) * 10) / 10,
          matter: e.matter?.name || "—",
          matterId: e.matter?.id,
          rate: Number(e.rate || 0),
          link: e.matter ? `${APP_URL}/matters/${e.matter.id}` : `${APP_URL}/time`,
          invoiceLink: e.matter ? `${APP_URL}/invoices/new?matterId=${e.matter.id}` : null,
        })),
        link: `${APP_URL}/time`,
      });

      // Add summary as first item
      sections[sections.length - 1].items.unshift({
        _summary: true,
        totalHours: Math.round(totalHours * 10) / 10,
        estimatedValue: Math.round(estimatedValue),
        count: unbilledEntries.length,
      });
    }
  }

  // 4. Upcoming hearings (next 7 days)
  if (enabledSections.hearings !== false) {
    const hearings = await db.calendarEvent.findMany({
      where: {
        startTime: { gte: today, lt: sevenDaysOut },
        OR: [
          { eventType: { contains: "hearing", mode: "insensitive" } },
          { eventType: { contains: "court", mode: "insensitive" } },
          { title: { contains: "hearing", mode: "insensitive" } },
          { title: { contains: "court date", mode: "insensitive" } },
          { title: { contains: "trial", mode: "insensitive" } },
        ],
      },
      include: {
        matter: { select: { id: true, name: true, client: { select: { name: true } } } },
      },
      orderBy: { startTime: "asc" },
      take: 15,
    });

    if (hearings.length > 0) {
      sections.push({
        key: "hearings",
        title: "Upcoming Hearings",
        items: hearings.map((h) => ({
          title: h.title,
          date: h.startTime,
          location: h.location,
          matter: h.matter?.name || "—",
          client: h.matter?.client?.name || "—",
          link: h.matter ? `${APP_URL}/matters/${h.matter.id}` : `${APP_URL}/calendar`,
        })),
        link: `${APP_URL}/calendar`,
      });
    }
  }

  // 5. Payments received yesterday
  if (enabledSections.payments !== false) {
    const invoicePayments = await db.invoice.findMany({
      where: {
        paidAt: { gte: yesterday, lt: today },
      },
      include: {
        matter: { select: { name: true, client: { select: { name: true } } } },
      },
      orderBy: { paidAt: "desc" },
    });

    const trustDeposits = await db.trustTransaction.findMany({
      where: {
        type: "DEPOSIT",
        createdAt: { gte: yesterday, lt: today },
      },
      include: {
        trustAccount: { select: { clientName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const paymentItems: any[] = [];
    for (const inv of invoicePayments) {
      paymentItems.push({
        type: "Invoice Payment",
        client: inv.matter?.client?.name || "—",
        amount: Number(inv.amountPaid),
        date: inv.paidAt,
        link: `${APP_URL}/invoices/${inv.id}`,
      });
    }
    for (const dep of trustDeposits) {
      paymentItems.push({
        type: "Trust Deposit",
        client: dep.trustAccount?.clientName || "—",
        amount: Number(dep.amount),
        date: dep.createdAt,
        link: `${APP_URL}/trust`,
      });
    }

    if (paymentItems.length > 0) {
      sections.push({
        key: "payments",
        title: "Payments Received Yesterday",
        items: paymentItems,
        link: `${APP_URL}/billing`,
      });
    }
  }

  // 6. Quick stats
  if (enabledSections.stats !== false) {
    const openMatterCount = await db.matter.count({ where: { status: "OPEN" } });

    const unbilledThisMonth = await db.timeEntry.findMany({
      where: { date: { gte: startOfMonth }, invoiceId: null },
      select: { hours: true, duration: true, rate: true },
    });
    const totalUnbilled = unbilledThisMonth.reduce((s, e) => {
      const h = e.hours || e.duration / 60;
      return s + h * Number(e.rate || 0);
    }, 0);

    const mtdInvoices = await db.invoice.findMany({
      where: { issueDate: { gte: startOfMonth } },
      select: { total: true, amountPaid: true },
    });
    const mtdBilled = mtdInvoices.reduce((s, i) => s + Number(i.total), 0);
    const mtdCollected = mtdInvoices.reduce((s, i) => s + Number(i.amountPaid), 0);
    const collectionRate = mtdBilled > 0 ? Math.round((mtdCollected / mtdBilled) * 100) : 0;

    sections.push({
      key: "stats",
      title: "Quick Stats",
      items: [
        { label: "Open Matters", value: openMatterCount, link: `${APP_URL}/matters` },
        { label: "Unbilled This Month", value: `$${Math.round(totalUnbilled).toLocaleString()}`, link: `${APP_URL}/time` },
        { label: "Collection Rate (MTD)", value: `${collectionRate}%`, link: `${APP_URL}/analytics` },
        { label: "Billed MTD", value: `$${Math.round(mtdBilled).toLocaleString()}`, link: `${APP_URL}/invoices` },
        { label: "Collected MTD", value: `$${Math.round(mtdCollected).toLocaleString()}`, link: `${APP_URL}/invoices` },
      ],
      link: `${APP_URL}/analytics`,
    });
  }

  return {
    userName: user.name || "Attorney",
    userEmail: user.email,
    firmName: user.firmName || "Your Firm",
    date: now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    sections,
  };
}

// ─── Email Template ──────────────────────────────────────────────

export function renderDigestHtml(payload: DigestPayload): string {
  const { userName, firmName, date, sections } = payload;

  function sectionHtml(section: DigestSection): string {
    switch (section.key) {
      case "deadlines":
        return section.items.map((d) => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">
              <a href="${d.link}" style="color:#1E40AF;text-decoration:none;font-weight:600;">${d.task}</a>
              <div style="font-size:12px;color:#666;margin-top:2px;">${d.matter} · ${d.client}${d.isTomorrow ? ' · <span style="color:#d97706;">Tomorrow</span>' : ""}</div>
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">
              <span style="font-size:11px;padding:2px 8px;border-radius:9999px;background:${d.priority === "URGENT" ? "#fef2f2;color:#dc2626" : d.priority === "HIGH" ? "#fff7ed;color:#ea580c" : "#f0f9ff;color:#0369a1"};">${d.priority || "MEDIUM"}</span>
            </td>
          </tr>
        `).join("");

      case "tasks":
        return section.items.map((group) => `
          <tr><td colspan="2" style="padding:8px 12px;font-weight:600;color:#374151;border-bottom:1px solid #f0f0f0;">${group.matter}</td></tr>
          ${group.tasks.map((t: any) => `
            <tr>
              <td style="padding:4px 12px 4px 24px;border-bottom:1px solid #f8f8f8;">
                <a href="${t.link}" style="color:#1E40AF;text-decoration:none;">${t.task}</a>
              </td>
              <td style="padding:4px 12px;border-bottom:1px solid #f8f8f8;text-align:right;font-size:12px;color:#dc2626;">${t.daysOverdue}d overdue</td>
            </tr>
          `).join("")}
        `).join("");

      case "unbilled": {
        const summary = section.items.find((i) => i._summary);
        const entries = section.items.filter((i) => !i._summary);
        return `
          ${summary ? `<tr><td colspan="2" style="padding:12px;background:#f0f9ff;border-bottom:1px solid #e0f2fe;">
            <strong>${summary.totalHours}h</strong> unbilled · Est. value <strong>$${summary.estimatedValue.toLocaleString()}</strong> · ${summary.count} entries
          </td></tr>` : ""}
          ${entries.map((e) => `
            <tr>
              <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;">
                <div style="font-size:13px;">${e.description || "Time entry"}</div>
                <div style="font-size:11px;color:#666;">${e.matter} · ${e.hours}h</div>
              </td>
              <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">
                ${e.invoiceLink ? `<a href="${e.invoiceLink}" style="font-size:11px;color:#16a34a;text-decoration:none;background:#f0fdf4;padding:3px 8px;border-radius:4px;">Create Invoice</a>` : ""}
              </td>
            </tr>
          `).join("")}
        `;
      }

      case "hearings":
        return section.items.map((h) => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">
              <a href="${h.link}" style="color:#1E40AF;text-decoration:none;font-weight:600;">${h.title}</a>
              <div style="font-size:12px;color:#666;margin-top:2px;">${h.matter} · ${h.client}${h.location ? ` · ${h.location}` : ""}</div>
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:12px;color:#374151;">
              ${new Date(h.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </td>
          </tr>
        `).join("");

      case "payments":
        return section.items.map((p) => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">
              <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:${p.type === "Trust Deposit" ? "#f0fdf4;color:#16a34a" : "#eff6ff;color:#1d4ed8"}">${p.type}</span>
              <span style="margin-left:8px;">${p.client}</span>
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#16a34a;">
              +$${Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </td>
          </tr>
        `).join("");

      case "stats":
        return `<tr><td colspan="2" style="padding:0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${section.items.map((s, i) => `
              ${i % 2 === 0 ? "<tr>" : ""}
              <td style="padding:10px 12px;width:50%;${i < section.items.length - 1 ? "border-bottom:1px solid #f0f0f0;" : ""}">
                <div style="font-size:11px;color:#666;text-transform:uppercase;">${s.label}</div>
                <div style="font-size:20px;font-weight:700;color:#111;"><a href="${s.link}" style="color:#111;text-decoration:none;">${s.value}</a></div>
              </td>
              ${i % 2 === 1 || i === section.items.length - 1 ? "</tr>" : ""}
            `).join("")}
          </table>
        </td></tr>`;

      default:
        return "";
    }
  }

  const sectionIcons: Record<string, string> = {
    deadlines: "🎯",
    tasks: "⚠️",
    unbilled: "⏱️",
    hearings: "⚖️",
    payments: "💰",
    stats: "📊",
  };

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1E40AF,#3B82F6);border-radius:12px 12px 0 0;padding:28px 24px;">
          <div style="font-size:20px;font-weight:700;color:white;">${firmName}</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.8);margin-top:4px;">Good morning, ${userName}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:2px;">${date}</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:white;padding:0;">
          ${sections.map((section) => `
            <!-- ${section.title} -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:2px solid #f4f5f7;">
              <tr><td style="padding:16px 16px 8px 16px;">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                  <span style="font-size:14px;font-weight:700;color:#111;">${sectionIcons[section.key] || "📋"} ${section.title}</span>
                  <a href="${section.link}" style="font-size:11px;color:#3B82F6;text-decoration:none;">View all →</a>
                </div>
              </td></tr>
              <tr><td style="padding:0 4px 12px 4px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  ${sectionHtml(section)}
                </table>
              </td></tr>
            </table>
          `).join("")}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:20px 24px;text-align:center;">
          <div style="font-size:12px;color:#9ca3af;">
            <a href="${APP_URL}/settings/digest" style="color:#3B82F6;text-decoration:none;">Manage preferences</a>
            &nbsp;·&nbsp;
            <a href="${APP_URL}/settings/digest" style="color:#9ca3af;text-decoration:none;">Unsubscribe</a>
          </div>
          <div style="font-size:11px;color:#d1d5db;margin-top:8px;">${firmName} · Powered by Managal</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
