import { db } from "@/lib/db";

export async function initializeMatterFolder(matterId: string, provider: string) {
  const matter = await db.matter.findUniqueOrThrow({ where: { id: matterId }, include: { client: true } });
  const integration = await db.storageIntegration.findUnique({ where: { provider } });
  if (!integration?.isEnabled) return { success: false, error: `${provider} not enabled` };

  const clientName = matter.client.name.replace(/[^a-zA-Z0-9\s]/g, "");
  const matterName = matter.name.replace(/[^a-zA-Z0-9\s]/g, "");
  const rootPath = integration.rootFolderPath || "/Clio AI";

  let folderPath: string;
  if (integration.folderStructure === "CLIENT_MATTER") folderPath = `${rootPath}/${clientName}/${matterName}`;
  else if (integration.folderStructure === "MATTER_ONLY") folderPath = `${rootPath}/${matterName}`;
  else folderPath = rootPath;

  // Check for practice-area-specific template
  const template = await db.matterFolderTemplate.findFirst({
    where: { OR: [{ practiceArea: matter.practiceArea }, { isDefault: true }], isActive: true },
    orderBy: { isDefault: "asc" },
  });

  const subfolders = template ? JSON.parse(template.subfolders) : [
    { name: "Pleadings" }, { name: "Correspondence" }, { name: "Discovery" }, { name: "Research" }, { name: "Billing" },
  ];

  const created: string[] = [];
  const rootFolder = await db.storageFolder.create({
    data: { provider, externalFolderId: `local_${Date.now()}`, externalPath: folderPath, name: matterName, matterId, clientId: matter.clientId, folderType: "MATTER", isAutoCreated: true },
  });
  created.push(rootFolder.name);

  for (const sf of subfolders) {
    await db.storageFolder.create({
      data: { provider, externalFolderId: `local_${Date.now()}_${sf.name}`, externalPath: `${folderPath}/${sf.name}`, name: sf.name, parentFolderId: rootFolder.id, matterId, folderType: "SUBFOLDER", isAutoCreated: true },
    });
    created.push(sf.name);
    if (sf.subfolders) {
      for (const ssf of sf.subfolders) {
        await db.storageFolder.create({
          data: { provider, externalFolderId: `local_${Date.now()}_${ssf.name}`, externalPath: `${folderPath}/${sf.name}/${ssf.name}`, name: ssf.name, matterId, folderType: "SUBFOLDER", isAutoCreated: true },
        });
        created.push(`  ${ssf.name}`);
      }
    }
  }

  return { success: true, foldersCreated: created.length, folders: created };
}

export async function getMatterDocumentIndex(matterId: string) {
  const storageFolders = await db.storageFolder.findMany({ where: { matterId }, orderBy: { name: "asc" } });
  const storageFiles = await db.storageFile.findMany({ where: { matterId }, orderBy: { name: "asc" } });
  const builtInDocs = await db.document.findMany({ where: { matterId }, orderBy: { name: "asc" } });

  const byFolder: Record<string, any[]> = { "Uncategorized": [] };
  for (const f of storageFolders) byFolder[f.name] = [];
  for (const file of storageFiles) {
    const folder = storageFolders.find((f) => f.id === file.folderId);
    const key = folder?.name || "Uncategorized";
    if (!byFolder[key]) byFolder[key] = [];
    byFolder[key].push({ ...file, source: "storage" });
  }
  for (const doc of builtInDocs) {
    byFolder["Uncategorized"].push({ id: doc.id, name: doc.name, extension: doc.filename?.split(".").pop(), sizeBytes: doc.size, source: "builtin" });
  }

  const totalFiles = storageFiles.length + builtInDocs.length;
  const totalSize = storageFiles.reduce((s, f) => s + Number(f.sizeBytes), 0) + builtInDocs.reduce((s, d) => s + d.size, 0);

  return { byFolder, totalFiles, totalSize, folderCount: storageFolders.length, providers: Array.from(new Set(storageFiles.map((f) => f.provider))) };
}

export async function getStorageStats() {
  const integrations = await db.storageIntegration.findMany({ where: { isEnabled: true } });
  const filesByProvider: Record<string, { count: number; size: number }> = {};

  for (const int of integrations) {
    const files = await db.storageFile.findMany({ where: { provider: int.provider } });
    filesByProvider[int.provider] = { count: files.length, size: files.reduce((s, f) => s + Number(f.sizeBytes), 0) };
  }

  const totalFiles = Object.values(filesByProvider).reduce((s, p) => s + p.count, 0);
  const totalSize = Object.values(filesByProvider).reduce((s, p) => s + p.size, 0);
  const conflicts = await db.storageFile.count({ where: { syncStatus: "CONFLICT" } });
  const activeShares = await db.shareLink.count({ where: { isActive: true } });

  return { totalFiles, totalSize, conflicts, activeShares, byProvider: filesByProvider, providerCount: integrations.length };
}

export async function searchAcrossProviders(query: string, matterId?: string) {
  const where: any = { name: { contains: query, mode: "insensitive" } };
  if (matterId) where.matterId = matterId;
  return db.storageFile.findMany({ where, orderBy: { lastModifiedAt: "desc" }, take: 50 });
}
