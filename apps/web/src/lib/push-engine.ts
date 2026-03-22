import { db } from "@/lib/db";

export async function subscribe(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  deviceInfo?: { userAgent?: string; platform?: string }
) {
  return db.pushSubscription.create({
    data: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      deviceType: (deviceInfo as any)?.deviceType,
      browserName: (deviceInfo as any)?.browserName,
      isActive: true,
    },
  });
}

export async function unsubscribe(subscriptionId: string) {
  return db.pushSubscription.update({
    where: { id: subscriptionId },
    data: { isActive: false },
  });
}

export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string; icon?: string; url?: string; tag?: string }
) {
  const subs = await db.pushSubscription.findMany({
    where: { userId, isActive: true },
  });
  for (const sub of subs) {
    // Placeholder: would call web-push sendNotification here
    await db.sentNotification.create({
      data: { userId, channel: "NC_PUSH" as any, category: "NCAT_SYSTEM" as any, severity: "NS_INFO" as any, title: payload.title, body: payload.body, icon: payload.icon, url: payload.url, delivered: true },
    });
  }
  return { sent: subs.length };
}

export async function sendEmailNotification(
  userId: string,
  payload: { subject: string; body: string; url?: string }
) {
  const pref = await db.notificationPreference.findFirst({ where: { userId } });
  if (!pref?.userEmail) return null;
  // Placeholder: would send email here
  return db.sentNotification.create({
    data: { userId, channel: "NC_EMAIL" as any, category: "NCAT_SYSTEM" as any, severity: "NS_INFO" as any, title: payload.subject, body: payload.body, url: payload.url, delivered: true },
  });
}

export async function sendSmsNotification(
  userId: string,
  payload: { body: string; url?: string }
) {
  const pref = await db.notificationPreference.findFirst({ where: { userId } });
  if (!pref?.smsPhone) return null;
  // Placeholder: would send SMS here
  return db.sentNotification.create({
    data: { userId, channel: "NC_SMS" as any, category: "NCAT_SYSTEM" as any, severity: "NS_INFO" as any, title: "SMS", body: payload.body, url: payload.url, delivered: true },
  });
}

export async function sendInAppNotification(
  userId: string,
  payload: { title: string; body: string; icon?: string; url?: string; severity: string; category: string; matterId?: string; entityType?: string; entityId?: string }
) {
  const notification = await db.sentNotification.create({
    data: {
      userId, channel: "NC_IN_APP" as any,
      category: (payload.category || "NCAT_SYSTEM") as any,
      severity: (payload.severity || "NS_INFO") as any,
      title: payload.title, body: payload.body,
      icon: payload.icon, url: payload.url, matterId: payload.matterId,
      entityType: payload.entityType, entityId: payload.entityId, delivered: true,
    } as any,
  });
  return notification;
}

export async function sendNotification(params: {
  userId: string; category: string; severity: string; title: string; body: string;
  icon?: string; url?: string; matterId?: string; entityType?: string; entityId?: string;
}) {
  const pref = await db.notificationPreference.findFirst({ where: { userId: params.userId } });
  if (pref && !(pref as any)[params.category]) return { skipped: true };
  if (await isQuietHours(params.userId)) return { quietHours: true };
  const results: any[] = [];
  results.push(await sendInAppNotification(params.userId, params));
  if (pref?.pushEnabled) results.push(await sendPushNotification(params.userId, params));
  if (pref?.userEmail) results.push(await sendEmailNotification(params.userId, { subject: params.title, body: params.body, url: params.url }));
  if (pref?.smsPhone) results.push(await sendSmsNotification(params.userId, { body: params.body, url: params.url }));
  return { sent: results.length, results };
}

export async function sendBulkNotification(
  userIds: string[],
  params: Omit<Parameters<typeof sendNotification>[0], "userId">
) {
  const results = [];
  for (const userId of userIds) {
    results.push(await sendNotification({ ...params, userId }));
  }
  return { total: userIds.length, results };
}

export async function checkDeadlineAlerts() {
  let alertsSent = 0;
  const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const entries = await db.deadline.findMany({
    where: { dueDate: { lte: sevenDaysOut, gte: new Date() } },
    include: { matter: true },
  });
  for (const entry of entries) {
    const daysLeft = Math.ceil((entry.dueDate!.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    const existing = await db.sentNotification.findFirst({
      where: { entityType: "docket", entityId: entry.id, body: { contains: `${daysLeft} day` } },
    });
    if (!existing && entry.matterId) {
      await sendNotification({ userId: "system", category: "deadlineAlerts", severity: "HIGH" as any, title: "Deadline Alert", body: `"${entry.title}" is due in ${daysLeft} day(s)`, entityType: "docket", entityId: entry.id, matterId: entry.matterId });
      alertsSent++;
    }
  }
  return { alertsSent };
}

export async function checkSOLAlerts() {
  let alertsSent = 0;
  const sols = await db.statuteOfLimitations.findMany({
    where: { status: "SOL_ACTIVE" as any, daysRemaining: { lte: 90 } },
    include: { matter: true },
  });
  for (const sol of sols) {
    const pref = await db.notificationPreference.findFirst({ where: { userId: sol.matterId ?? "system" } });
    const alertDays = (pref as any)?.solAlertDays ?? [90, 60, 30, 14, 7, 1];
    if (alertDays.includes(sol.daysRemaining) && "system") {
      await sendNotification({ userId: "system", category: "solAlerts", severity: "CRITICAL" as any, title: "SOL Warning", body: `SOL for "${sol.matter?.name ?? "Matter"}" expires in ${sol.daysRemaining} days`, entityType: "sol", entityId: sol.id, matterId: sol.matterId });
      alertsSent++;
    }
  }
  return { alertsSent };
}

export async function checkCourtDateAlerts() {
  let alertsSent = 0;
  const upcoming = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const events = await db.calendarEvent.findMany({
    where: { startTime: { lte: upcoming, gte: new Date() } },
    include: { matter: true },
  });
  for (const event of events) {
    await sendNotification({ userId: "system", category: "courtDateAlerts", severity: "HIGH" as any, title: "Court Date Reminder", body: `Court date "${event.title}" on ${event.startTime.toLocaleDateString()}`, entityType: "calendarEvent", entityId: event.id, matterId: event.matterId ?? undefined });
    alertsSent++;
  }
  return { alertsSent };
}

export async function checkTaskAlerts() {
  let alertsSent = 0;
  const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const tasks = await db.task.findMany({
    where: { dueDate: { lte: tomorrow, gte: new Date() }, status: { not: "COMPLETED" as any } },
  });
  for (const task of tasks) {
    if (task.assigneeId) {
      await sendNotification({ userId: task.assigneeId, category: "taskAlerts", severity: "MEDIUM" as any, title: "Task Due", body: `Task "${task.title}" is due soon`, entityType: "task", entityId: task.id, matterId: task.matterId ?? undefined });
      alertsSent++;
    }
  }
  return { alertsSent };
}

export async function checkAllAlerts() {
  const deadlines = await checkDeadlineAlerts();
  const sols = await checkSOLAlerts();
  const courtDates = await checkCourtDateAlerts();
  const tasks = await checkTaskAlerts();
  return { deadlines, sols, courtDates, tasks, totalAlerts: deadlines.alertsSent + sols.alertsSent + courtDates.alertsSent + tasks.alertsSent };
}

export async function generateDailyDigest(userId: string) {
  const today = new Date();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const deadlines = await db.deadline.findMany({ where: { dueDate: { gte: today, lte: tomorrow } } });
  const courtDates = await db.calendarEvent.findMany({ where: { startTime: { gte: today, lte: tomorrow } } });
  const overdueTasks = await db.task.findMany({ where: { assigneeId: userId, dueDate: { lt: today }, status: { not: "COMPLETED" as any } } });
  const solWarnings = await db.statuteOfLimitations.findMany({ where: { status: "SOL_ACTIVE" as any, daysRemaining: { lte: 30 } } });
  const lines = [`Daily Digest for ${today.toLocaleDateString()}`, `Deadlines today: ${deadlines.length}`, `Court dates: ${courtDates.length}`, `Overdue tasks: ${overdueTasks.length}`, `SOL warnings: ${solWarnings.length}`];
  const digest = lines.join("\n");
  await sendEmailNotification(userId, { subject: "Daily Digest", body: digest });
  return digest;
}

export async function isQuietHours(userId: string): Promise<boolean> {
  const pref = await db.notificationPreference.findFirst({ where: { userId } });
  if (!pref?.quietHoursStart || !pref?.quietHoursEnd) return false;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = parseInt(pref.quietHoursStart as string) || 0;
  const end = parseInt(pref.quietHoursEnd as string) || 0;
  return start <= end ? minutes >= start && minutes <= end : minutes >= start || minutes <= end;
}

export async function markRead(notificationId: string) {
  return db.sentNotification.update({
    where: { id: notificationId },
    data: { read: true, readAt: new Date() },
  });
}

export async function markClicked(notificationId: string) {
  return db.sentNotification.update({
    where: { id: notificationId },
    data: { clicked: true, clickedAt: new Date() },
  });
}

export async function markAllRead(userId: string) {
  const result = await db.sentNotification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() },
  });
  return result.count;
}

export async function getUnreadCount(userId: string) {
  return db.sentNotification.count({
    where: { userId, channel: "NC_IN_APP" as any, read: false },
  });
}

export async function cleanupOldNotifications() {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const result = await db.sentNotification.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
}
