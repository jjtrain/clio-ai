import { db } from "@/lib/db";
import { getTemplates } from "./meta-client";

export async function syncTemplates(firmId: string) {
  const connection = await db.whatsAppConnection.findUnique({ where: { firmId } });
  if (!connection) return { synced: 0 };

  const metaTemplates = await getTemplates(firmId);
  const metaIds = new Set<string>();
  let synced = 0;

  for (const t of metaTemplates) {
    metaIds.add(t.id);
    await db.whatsAppTemplate.upsert({
      where: { waTemplateId: t.id },
      create: {
        connectionId: connection.id,
        firmId,
        waTemplateId: t.id,
        name: t.name,
        category: (t.category || "UTILITY") as any,
        language: t.language || "en_US",
        status: (t.status || "PENDING") as any,
        components: t.components || [],
      },
      update: {
        name: t.name,
        status: (t.status || "PENDING") as any,
        components: t.components || [],
      },
    });
    synced++;
  }

  // Deactivate templates not in Meta
  const localTemplates = await db.whatsAppTemplate.findMany({
    where: { connectionId: connection.id },
    select: { id: true, waTemplateId: true },
  });
  for (const local of localTemplates) {
    if (!metaIds.has(local.waTemplateId)) {
      await db.whatsAppTemplate.update({ where: { id: local.id }, data: { isActive: false } });
    }
  }

  await db.whatsAppConnection.update({ where: { firmId }, data: { lastSyncAt: new Date() } });
  return { synced };
}
