import { db } from "@/lib/db";
import { getProviderAdapter } from "./providers";

const BATCH_SIZE = 50;

export async function runMigration(jobId: string): Promise<void> {
  const job = await db.migrationJob.findUniqueOrThrow({ where: { id: jobId } });
  if (job.status === "CANCELLED") return;

  const adapter = getProviderAdapter(job.provider);
  const token = job.accessToken || "";
  const selectedTypes = (job.selectedTypes as string[]) || ["contacts", "matters", "documents", "billing"];
  const isDryRun = job.isDryRun;
  let imported = 0, skipped = 0, failed = 0;
  const errors: Array<{ sourceId: string; entityType: string; reason: string }> = [];

  await db.migrationJob.update({ where: { id: jobId }, data: { status: "RUNNING", startedAt: new Date() } });

  async function processRecords(entityType: string, records: any[]) {
    await db.migrationJob.update({ where: { id: jobId }, data: { currentType: entityType } });

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      // Check for cancellation
      const current = await db.migrationJob.findUnique({ where: { id: jobId }, select: { status: true } });
      if (current?.status === "CANCELLED") return;

      const batch = records.slice(i, i + BATCH_SIZE);
      for (const record of batch) {
        try {
          // Idempotency check
          const existing = await db.migrationRecord.findUnique({
            where: { provider_sourceId_entityType: { provider: job.provider, sourceId: record.id, entityType } },
          });
          if (existing && existing.status === "IMPORTED") { skipped++; continue; }

          if (!isDryRun) {
            // Import based on type
            let destId: string | undefined;
            if (entityType === "CONTACT") {
              const name = `${record.firstName || ""} ${record.lastName || ""}`.trim() || "Imported Contact";
              const client = await db.client.create({ data: { name, email: record.email, phone: record.phone } });
              destId = client.id;
            } else if (entityType === "MATTER") {
              const matterCount = await db.matter.count();
              let clientId = record.clientId;
              if (clientId) {
                const mapped = await db.migrationRecord.findFirst({ where: { provider: job.provider, sourceId: clientId, entityType: "CONTACT", status: "IMPORTED" } });
                clientId = mapped?.destinationId;
              }
              if (!clientId) {
                const defaultClient = await db.client.findFirst();
                clientId = defaultClient?.id;
              }
              if (clientId) {
                const matter = await db.matter.create({
                  data: { name: record.name || "Imported Matter", matterNumber: `MIG-${String(matterCount + 1).padStart(5, "0")}`, clientId, practiceArea: record.practiceArea, status: "OPEN", openDate: record.openDate ? new Date(record.openDate) : new Date() },
                });
                destId = matter.id;
              }
            } else if (entityType === "INVOICE") {
              // Simplified — create invoice record
              const mapped = record.matterId ? await db.migrationRecord.findFirst({ where: { provider: job.provider, sourceId: record.matterId, entityType: "MATTER", status: "IMPORTED" } }) : null;
              if (mapped?.destinationId) {
                const invCount = await db.invoice.count();
                const inv = await db.invoice.create({
                  data: { matterId: mapped.destinationId, invoiceNumber: `MIG-INV-${String(invCount + 1).padStart(5, "0")}`, total: record.amount || 0, subtotal: record.amount || 0, status: record.status === "paid" ? "PAID" : "DRAFT", issueDate: record.issuedAt ? new Date(record.issuedAt) : new Date(), dueDate: record.dueDate ? new Date(record.dueDate) : new Date(Date.now() + 30 * 86400000) },
                });
                destId = inv.id;
              }
            }

            await db.migrationRecord.upsert({
              where: { provider_sourceId_entityType: { provider: job.provider, sourceId: record.id, entityType } },
              create: { jobId, provider: job.provider, sourceId: record.id, entityType, sourceData: record as any, destinationId: destId, status: "IMPORTED" },
              update: { destinationId: destId, status: "IMPORTED" },
            });
          }
          imported++;
        } catch (err: any) {
          failed++;
          errors.push({ sourceId: record.id, entityType, reason: err.message });
          await db.migrationRecord.upsert({
            where: { provider_sourceId_entityType: { provider: job.provider, sourceId: record.id, entityType } },
            create: { jobId, provider: job.provider, sourceId: record.id, entityType, sourceData: record as any, status: "FAILED", errorMessage: err.message },
            update: { status: "FAILED", errorMessage: err.message },
          });
        }
      }

      // Update progress
      const total = job.totalRecords || 1;
      const processed = imported + skipped + failed;
      await db.migrationJob.update({ where: { id: jobId }, data: { importedCount: imported, skippedCount: skipped, failedCount: failed, progressPct: Math.round((processed / total) * 100), errorLog: errors as any } });
    }
  }

  try {
    if (selectedTypes.includes("contacts")) {
      const contacts = await adapter.fetchContacts(token);
      await processRecords("CONTACT", contacts);
    }
    if (selectedTypes.includes("matters")) {
      const matters = await adapter.fetchMatters(token);
      await processRecords("MATTER", matters);
    }
    if (selectedTypes.includes("documents")) {
      const docs = await adapter.fetchDocuments(token);
      await processRecords("DOCUMENT", docs);
    }
    if (selectedTypes.includes("billing")) {
      const invoices = await adapter.fetchInvoices(token);
      await processRecords("INVOICE", invoices);
    }

    await db.migrationJob.update({ where: { id: jobId }, data: { status: "COMPLETED", completedAt: new Date(), progressPct: 100, importedCount: imported, skippedCount: skipped, failedCount: failed, errorLog: errors as any } });
  } catch (err: any) {
    await db.migrationJob.update({ where: { id: jobId }, data: { status: "FAILED", errorLog: [...errors, { sourceId: "SYSTEM", entityType: "SYSTEM", reason: err.message }] as any } });
  }
}
