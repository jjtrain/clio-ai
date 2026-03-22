import { db } from "@/lib/db";
import * as aiRouter from "@/lib/ai-router";

export async function processScannedDocument(scanId: string) {
  const scan = await db.scannedDocument.findUniqueOrThrow({ where: { id: scanId } });
  const ocr = await ocrDocument(scan.imageUrl);
  const classification = await classifyDocument(ocr.text);
  const matterSuggestion = await suggestMatter(ocr.text, classification.entities, scan.userId);
  const updated = await db.scannedDocument.update({
    where: { id: scanId },
    data: {
      ocrText: ocr.text, ocrConfidence: ocr.confidence,
      aiDocumentType: classification.documentType as any,
      aiSuggestedName: classification.suggestedName, aiSummary: classification.summary,
      aiSuggestedCategory: classification.category,
      aiExtractedEntities: JSON.stringify(classification.entities),
      aiSuggestedMatter: matterSuggestion?.matterId, aiMatterConfidence: matterSuggestion?.confidence,
      status: "SCN_OCR_COMPLETE" as any, processedAt: new Date(),
    } as any,
  });
  return updated;
}

export async function ocrDocument(imageBase64: string) {
  const prompt = `You are an OCR assistant. Extract ALL text from this document image. Preserve formatting, paragraphs, and structure. Return the extracted text exactly as it appears.

Document image description (MVP text-only mode): ${imageBase64.substring(0, 500)}`;
  const result = await aiRouter.complete({ feature: "document_scanner", systemPrompt: "You are a legal document OCR and classification assistant.", userPrompt: prompt });
  return { text: result.content, confidence: 0.85 };
}

export async function classifyDocument(ocrText: string) {
  const prompt = `Based on this OCR text from a legal document, classify it. Return JSON: {"documentType": "COURT_ORDER"|"PLEADING"|"CORRESPONDENCE"|"EVIDENCE"|"CONTRACT"|"ID_DOCUMENT"|"MEDICAL_RECORD"|"FINANCIAL"|"RECEIPT"|"HANDWRITTEN_NOTE"|"BUSINESS_CARD"|"OTHER", "suggestedName": string, "summary": string, "category": string, "entities": {"dates": string[], "names": string[], "caseNumbers": string[], "amounts": string[]}}

OCR Text:
${ocrText}`;
  const result = await aiRouter.complete({ feature: "document_scanner", systemPrompt: "You are a legal document OCR and classification assistant.", userPrompt: prompt });
  const parsed = JSON.parse(result.content);
  return parsed as {
    documentType: string;
    suggestedName: string;
    summary: string;
    category: string;
    entities: { dates: string[]; names: string[]; caseNumbers: string[]; amounts: string[] };
  };
}

export async function suggestMatter(ocrText: string, entities: any, userId: string) {
  const caseNumbers = entities?.caseNumbers ?? [];
  for (const cn of caseNumbers) {
    const matter = await db.matter.findFirst({
      where: { matterNumber: cn },
    });
    if (matter) return { matterId: matter.id, confidence: 0.95, method: "caseNumber" };
  }
  const names = entities?.names ?? [];
  for (const name of names) {
    const matter = await db.matter.findFirst({
      where: { client: { name: { contains: name, mode: "insensitive" as any } } },
    });
    if (matter) return { matterId: matter.id, confidence: 0.7, method: "clientName" };
  }
  return null;
}

export async function fileToMatter(scanId: string, matterId: string, fileName?: string) {
  const scan = await db.scannedDocument.findUniqueOrThrow({ where: { id: scanId } });
  const docName = fileName ?? scan.aiSuggestedName ?? "Scanned Document";
  const document = await db.document.create({
    data: {
      matterId,
      name: docName,
      filename: `${docName.replace(/[^a-zA-Z0-9]/g, "_")}.${scan.imageFormat}`,
      mimeType: `image/${scan.imageFormat}`,
      size: scan.imageSizeBytes ?? 0,
      path: scan.imageUrl,
    },
  });
  await db.scannedDocument.update({
    where: { id: scanId },
    data: {
      documentId: document.id,
      matterId,
      status: "SCN_FILED" as any,
      filedAt: new Date(),
    },
  });
  return document;
}

export async function getRecentScans(userId: string, limit?: number) {
  return db.scannedDocument.findMany({
    where: { userId },
    orderBy: { scannedAt: "desc" },
    take: limit ?? 20,
  });
}

export async function getScanStats(userId: string) {
  const byStatus = await db.scannedDocument.groupBy({
    by: ["status"],
    where: { userId },
    _count: true,
  });
  const byType = await db.scannedDocument.groupBy({
    by: ["aiDocumentType"],
    where: { userId },
    _count: true,
  });
  return { byStatus, byType };
}

export async function enhanceImage(imageBase64: string) {
  // Placeholder: in production would apply perspective correction,
  // contrast enhancement, and rotation correction
  return { enhanced: imageBase64, corrections: [] as string[] };
}

export async function mergeScanPages(scanIds: string[]) {
  const scans = await db.scannedDocument.findMany({
    where: { id: { in: scanIds } },
    orderBy: { scannedAt: "asc" },
  });
  const mergedOcrText = scans.map((s: any) => s.ocrText ?? "").join("\n\n--- PAGE BREAK ---\n\n");
  const merged = await db.scannedDocument.create({
    data: {
      userId: scans[0].userId,
      imageUrl: scans[0].imageUrl,
      ocrText: mergedOcrText,
      pageCount: scans.length,
      isMultiPage: true,
      relatedScanIds: JSON.stringify(scanIds),
      status: "SCN_UPLOADING" as any,
    },
  });
  for (const scan of scans) {
    await db.scannedDocument.update({
      where: { id: scan.id },
      data: { relatedScanIds: [merged.id] as any },
    });
  }
  return merged;
}

export async function extractBusinessCard(ocrText: string) {
  const prompt = `Parse this business card text into structured contact information. Return JSON: {"name": string, "title": string, "company": string, "phone": string, "email": string, "address": string, "website": string}

Business card text:
${ocrText}`;
  const result = await aiRouter.complete({ feature: "document_scanner", systemPrompt: "You are a legal document OCR and classification assistant.", userPrompt: prompt });
  return JSON.parse(result.content) as {
    name: string;
    title: string;
    company: string;
    phone: string;
    email: string;
    address: string;
    website: string;
  };
}
