import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

// ==========================================
// CORE TRANSLATION
// ==========================================

export async function translateText(params: {
  text: string;
  targetLanguage: string;
  context?: string;
  practiceArea?: string;
  glossary?: Array<{ english: string; translated: string }>;
}): Promise<{ translated: string; qualityScore: number }> {
  const { text, targetLanguage, context, practiceArea, glossary } = params;

  // Check cache first
  // (In production, check ContentTranslation table)

  // Load glossary terms for this language
  const dbGlossary = glossary || await loadGlossary(targetLanguage, practiceArea);

  // Detect do-not-translate terms
  const dntTerms = detectDoNotTranslateTerms(text);

  // Build translation prompt
  const glossaryText = dbGlossary.length > 0
    ? `\nUse these specific translations for legal terms:\n${dbGlossary.map((g) => `- "${g.english}" → "${g.translated}"`).join("\n")}`
    : "";

  const dntText = dntTerms.length > 0
    ? `\nDo NOT translate these terms (keep them exactly as-is): ${dntTerms.join(", ")}`
    : "";

  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: `You are a professional legal translator. Translate the following text from English to ${targetLanguage}.

Rules:
- Use formal/polite register appropriate for attorney-client communication
- Maintain the warm, supportive tone of the original
- Legal terms must be translated accurately using standard legal terminology in the target language
- Keep proper nouns, case numbers, form numbers, and dollar amounts in English
- Keep the same paragraph structure
- Do not add or remove information${glossaryText}${dntText}

${context ? `Context: ${context}` : ""}
${practiceArea ? `Practice Area: ${practiceArea}` : ""}

Return ONLY the translated text, nothing else.`,
      messages: [{ role: "user", content: text }],
    });

    const translated = response.content[0]?.type === "text" ? response.content[0].text : text;

    // Quick quality assessment
    const qualityScore = assessBasicQuality(text, translated);

    return { translated, qualityScore };
  } catch {
    return { translated: text, qualityScore: 0 };
  }
}

export async function translateBatch(items: Array<{ id: string; text: string }>, targetLanguage: string, practiceArea?: string): Promise<Array<{ id: string; translated: string }>> {
  const results: Array<{ id: string; translated: string }> = [];
  const glossary = await loadGlossary(targetLanguage, practiceArea);

  for (const item of items) {
    const { translated } = await translateText({
      text: item.text,
      targetLanguage,
      practiceArea,
      glossary,
    });
    results.push({ id: item.id, translated });
  }

  return results;
}

// ==========================================
// CONTENT TRANSLATION MANAGEMENT
// ==========================================

export async function translateAndCacheContent(params: {
  sourceType: string;
  sourceId: string;
  sourceField: string;
  text: string;
  targetLanguage: string;
  practiceArea?: string;
  firmId: string;
}): Promise<string> {
  // Check cache
  const cached = await db.contentTranslation.findUnique({
    where: {
      sourceType_sourceId_sourceField_languageCode: {
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        sourceField: params.sourceField,
        languageCode: params.targetLanguage,
      },
    },
  });

  if (cached && cached.originalText === params.text) {
    return cached.translatedText;
  }

  // Translate
  const { translated, qualityScore } = await translateText({
    text: params.text,
    targetLanguage: params.targetLanguage,
    practiceArea: params.practiceArea,
  });

  // Cache
  await db.contentTranslation.upsert({
    where: {
      sourceType_sourceId_sourceField_languageCode: {
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        sourceField: params.sourceField,
        languageCode: params.targetLanguage,
      },
    },
    create: {
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      sourceField: params.sourceField,
      languageCode: params.targetLanguage,
      originalText: params.text,
      translatedText: translated,
      practiceArea: params.practiceArea,
      qualityScore,
      needsReview: qualityScore < 0.7,
      translationModel: "claude-sonnet-4-20250514",
      firmId: params.firmId,
    },
    update: {
      originalText: params.text,
      translatedText: translated,
      qualityScore,
      needsReview: qualityScore < 0.7,
      isVerified: false,
    },
  });

  return translated;
}

export async function warmTranslationCache(matterId: string, languageCode: string, firmId: string): Promise<number> {
  let count = 0;

  // Translate timeline events
  const events = await db.clientTimelineEvent.findMany({
    where: { matterId, isVisibleToClient: true },
    select: { id: true, clientDescription: true, title: true },
  });

  for (const event of events) {
    if (event.clientDescription) {
      await translateAndCacheContent({
        sourceType: "timeline_event",
        sourceId: event.id,
        sourceField: "clientDescription",
        text: event.clientDescription,
        targetLanguage: languageCode,
        firmId,
      });
      count++;
    }
  }

  // Translate status updates
  const updates = await db.portalStatusUpdate.findMany({
    where: { matterId, isPublished: true },
    select: { id: true, title: true, body: true },
  });

  for (const update of updates) {
    await translateAndCacheContent({
      sourceType: "status_update",
      sourceId: update.id,
      sourceField: "body",
      text: update.body,
      targetLanguage: languageCode,
      firmId,
    });
    count++;
  }

  // Translate checklist items
  const checklists = await db.portalChecklist.findMany({
    where: { matterId },
    select: { id: true, items: true },
  });

  for (const checklist of checklists) {
    const items = checklist.items as any[];
    for (const item of items) {
      await translateAndCacheContent({
        sourceType: "checklist_item",
        sourceId: `${checklist.id}-${item.id}`,
        sourceField: "label",
        text: item.label,
        targetLanguage: languageCode,
        firmId,
      });
      count++;
    }
  }

  return count;
}

// ==========================================
// GLOSSARY
// ==========================================

async function loadGlossary(languageCode: string, practiceArea?: string): Promise<Array<{ english: string; translated: string }>> {
  const where: any = { languageCode, doNotTranslate: false };
  if (practiceArea) {
    where.OR = [{ practiceArea }, { practiceArea: null }];
  }

  const terms = await db.translationGlossary.findMany({
    where,
    select: { englishTerm: true, translatedTerm: true },
  });

  return terms.map((t) => ({ english: t.englishTerm, translated: t.translatedTerm }));
}

// ==========================================
// DO NOT TRANSLATE DETECTION
// ==========================================

export function detectDoNotTranslateTerms(text: string): string[] {
  const terms: string[] = [];

  // Case numbers: 24-CV-12345
  const caseNumbers = text.match(/\d{2}-[A-Z]{2,}-\d+/g);
  if (caseNumbers) terms.push(...caseNumbers);

  // USCIS form numbers: I-485, I-130A
  const uscis = text.match(/I-\d{3}[A-Z]?/g);
  if (uscis) terms.push(...uscis);

  // Receipt numbers: EAC2190123456
  const receipts = text.match(/[A-Z]{3}\d{10,}/g);
  if (receipts) terms.push(...receipts);

  // Dollar amounts
  const dollars = text.match(/\$[\d,.]+/g);
  if (dollars) terms.push(...dollars);

  return Array.from(new Set(terms));
}

// ==========================================
// LANGUAGE DETECTION
// ==========================================

export function detectClientLanguage(params: {
  browserLanguage?: string;
  ipGeoCountry?: string;
  portalAccountLanguage?: string;
}): { detected: string; confidence: number } {
  // Portal account language is highest priority
  if (params.portalAccountLanguage && params.portalAccountLanguage !== "en") {
    return { detected: params.portalAccountLanguage, confidence: 1.0 };
  }

  // Browser language
  if (params.browserLanguage) {
    const lang = params.browserLanguage.split("-")[0].toLowerCase();
    if (lang !== "en") {
      return { detected: lang, confidence: 0.8 };
    }
  }

  return { detected: "en", confidence: 1.0 };
}

// ==========================================
// QUALITY ASSESSMENT
// ==========================================

function assessBasicQuality(original: string, translated: string): number {
  if (!translated || translated === original) return 0;

  let score = 0.8; // base score for AI translation

  // Length check: translated should be 50-200% of original
  const ratio = translated.length / original.length;
  if (ratio < 0.5 || ratio > 2.0) score -= 0.2;

  // Check for untranslated English passages (rough heuristic)
  const englishWords = translated.match(/\b[a-zA-Z]{4,}\b/g) || [];
  const totalWords = translated.split(/\s+/).length;
  const englishRatio = totalWords > 0 ? englishWords.length / totalWords : 0;
  if (englishRatio > 0.5) score -= 0.3;

  return Math.max(0, Math.min(1, score));
}

// ==========================================
// BIDIRECTIONAL MESSAGE TRANSLATION
// ==========================================

export async function translateMessage(params: {
  text: string;
  fromLanguage: string;
  toLanguage: string;
  practiceArea?: string;
}): Promise<{ translated: string; confidence: number }> {
  if (params.fromLanguage === params.toLanguage) {
    return { translated: params.text, confidence: 1.0 };
  }

  const { translated, qualityScore } = await translateText({
    text: params.text,
    targetLanguage: params.toLanguage,
    context: "This is a message between an attorney and their client. Maintain the original tone and meaning.",
    practiceArea: params.practiceArea,
  });

  return { translated, confidence: qualityScore };
}
