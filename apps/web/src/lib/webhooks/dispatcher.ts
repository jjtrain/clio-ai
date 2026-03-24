import crypto from "crypto";
import { db } from "@/lib/db";

export async function fireWebhook(event: string, firmId: string, payload: object) {
  const subscriptions = await db.webhookSubscription.findMany({
    where: { firmId, event, isActive: true },
  });

  for (const sub of subscriptions) {
    const envelope = { event, timestamp: new Date().toISOString(), firmId, data: payload };
    const body = JSON.stringify(envelope);
    const signature = crypto.createHmac("sha256", sub.secret).update(body).digest("hex");
    const deliveryId = crypto.randomUUID();

    const start = Date.now();
    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let success = false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(sub.targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Managal-Event": event,
          "X-Managal-Signature": `sha256=${signature}`,
          "X-Managal-Delivery": deliveryId,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      responseStatus = res.status;
      responseBody = (await res.text()).slice(0, 1000);
      success = res.ok;
    } catch (err: any) {
      responseBody = err.message;
    }

    const durationMs = Date.now() - start;

    await db.webhookDelivery.create({
      data: {
        subscriptionId: sub.id,
        event,
        payload: envelope as any,
        responseStatus,
        responseBody,
        durationMs,
        success,
      },
    });

    if (success) {
      await db.webhookSubscription.update({
        where: { id: sub.id },
        data: { lastFiredAt: new Date(), lastSuccessAt: new Date(), failureCount: 0 },
      });
    } else {
      const newCount = sub.failureCount + 1;
      await db.webhookSubscription.update({
        where: { id: sub.id },
        data: { lastFiredAt: new Date(), failureCount: newCount, isActive: newCount < 5 },
      });
    }
  }
}

export async function retryFailedDeliveries() {
  const cutoff = new Date(Date.now() - 24 * 3600000);
  const failed = await db.webhookDelivery.findMany({
    where: { success: false, attempt: { lt: 3 }, deliveredAt: { gt: cutoff } },
    include: { subscription: true },
    take: 50,
  });

  let retried = 0;
  for (const delivery of failed) {
    if (!delivery.subscription.isActive) continue;
    const body = JSON.stringify(delivery.payload);
    const signature = crypto.createHmac("sha256", delivery.subscription.secret).update(body).digest("hex");

    const start = Date.now();
    let success = false;
    let responseStatus: number | null = null;

    try {
      const res = await fetch(delivery.subscription.targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Managal-Event": delivery.event,
          "X-Managal-Signature": `sha256=${signature}`,
          "X-Managal-Delivery": `retry-${delivery.id}`,
        },
        body,
        signal: AbortSignal.timeout(10000),
      });
      responseStatus = res.status;
      success = res.ok;
    } catch { /* timeout or network error */ }

    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: { attempt: delivery.attempt + 1, success, responseStatus, durationMs: Date.now() - start },
    });

    if (success) {
      await db.webhookSubscription.update({ where: { id: delivery.subscriptionId }, data: { failureCount: 0, lastSuccessAt: new Date() } });
    }
    retried++;
  }

  return { retried };
}
