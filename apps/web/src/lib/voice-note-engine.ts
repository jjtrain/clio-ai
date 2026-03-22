import { db } from "@/lib/db";
import * as aiRouter from "@/lib/ai-router";

export async function transcribeWithWhisper(
  audioBase64: string,
  format: string
): Promise<{ text: string; confidence: number }> {
  // In production, would call OpenAI Whisper API with audioBase64 and format
  void audioBase64;
  void format;
  return { text: "Whisper transcription not configured", confidence: 0 };
}

export async function transcribeWithAnthropic(
  roughText: string
): Promise<string> {
  const result = await aiRouter.complete({ feature: "voice_note", systemPrompt: "You are a legal assistant processing attorney voice notes.",
    userPrompt: `Clean up the following rough voice transcription. Fix grammar, punctuation, and formatting while preserving the original meaning:\n\n${roughText}`,
  });
  return result.content;
}

export async function summarizeNote(
  transcription: string,
  matterContext?: string
): Promise<string> {
  const contextLine = matterContext
    ? `\nMatter context: ${matterContext}`
    : "";
  const result = await aiRouter.complete({ feature: "voice_note", systemPrompt: "You are a legal assistant processing attorney voice notes.",
    userPrompt: `You are a legal assistant. Summarize the following voice note in 1-2 sentences.${contextLine}\n\nTranscription: ${transcription}`,
  });
  return result.content;
}

export async function categorizeNote(
  transcription: string
): Promise<{ category: string; tags: string[] }> {
  const result = await aiRouter.complete({ feature: "voice_note", systemPrompt: "You are a legal assistant processing attorney voice notes.",
    userPrompt: `Classify the following legal voice note into a category (e.g. "client-meeting", "court-hearing", "research", "case-update", "internal", "billing") and extract relevant tags. Respond with JSON only: { "category": "...", "tags": ["..."] }\n\nTranscription: ${transcription}`,
  });
  return JSON.parse(result.content);
}

export async function extractEntities(
  transcription: string
): Promise<Record<string, any>> {
  const result = await aiRouter.complete({ feature: "voice_note", systemPrompt: "You are a legal assistant processing attorney voice notes.",
    userPrompt: `Extract the following entities from this legal voice note. Respond with JSON only: { "dates": [], "amounts": [], "people": [], "courts": [], "deadlines": [], "actionItems": [] }\n\nTranscription: ${transcription}`,
  });
  return JSON.parse(result.content);
}

export async function suggestTimeEntry(
  transcription: string,
  category: string,
  audioDuration: number
): Promise<{ suggestedMinutes: number; activity: string; description: string; isBillable: boolean }> {
  const result = await aiRouter.complete({ feature: "voice_note", systemPrompt: "You are a legal assistant processing attorney voice notes.",
    userPrompt: `Based on this legal voice note, suggest a billable time entry. Category: ${category}. Audio duration: ${audioDuration} seconds. Respond with JSON only: { "suggestedMinutes": number, "activity": "...", "description": "...", "isBillable": true/false }\n\nTranscription: ${transcription}`,
  });
  return JSON.parse(result.content);
}

export async function suggestDocketEntry(
  transcription: string,
  entities: any
): Promise<Record<string, any> | null> {
  if (!entities.dates?.length && !entities.deadlines?.length) {
    return null;
  }
  const result = await aiRouter.complete({ feature: "voice_note", systemPrompt: "You are a legal assistant processing attorney voice notes.",
    userPrompt: `Based on this legal voice note and extracted entities, suggest a docket/calendar entry. Entities: ${JSON.stringify(entities)}. Respond with JSON only: { "title": "...", "date": "...", "description": "...", "priority": "high"|"medium"|"low" }\n\nTranscription: ${transcription}`,
  });
  return JSON.parse(result.content);
}

export async function suggestTasks(
  transcription: string,
  entities: any
): Promise<Array<{ title: string; description: string; dueDate?: string; priority: string }>> {
  const result = await aiRouter.complete({ feature: "voice_note", systemPrompt: "You are a legal assistant processing attorney voice notes.",
    userPrompt: `Extract action items from this legal voice note as tasks. Action items found: ${JSON.stringify(entities.actionItems || [])}. Respond with JSON array: [{ "title": "...", "description": "...", "dueDate": "YYYY-MM-DD" or null, "priority": "high"|"medium"|"low" }]\n\nTranscription: ${transcription}`,
  });
  return JSON.parse(result.content);
}

export async function processVoiceNote(voiceNoteId: string) {
  const note = await db.voiceNote.findUniqueOrThrow({
    where: { id: voiceNoteId },
    include: { matter: true },
  });

  const matterContext = note.matter?.name || undefined;
  const text = (note as any).transcription || note.editedTranscription || "";
  if (!text) { await db.voiceNote.update({ where: { id: voiceNoteId }, data: { transcriptionStatus: "TS_FAILED" as any } }); return note; }
  const summary = await summarizeNote(text, matterContext);
  const { category, tags } = await categorizeNote(text);
  const entities = await extractEntities(text);

  const updateData: Record<string, any> = {
    summary,
    category,
    tags: JSON.stringify(tags),
    entities: JSON.stringify(entities),
    transcriptionStatus: "TS_COMPLETED" as any,
  };

  const settings = await db.voiceNoteSettings.findFirst();

  if (settings?.autoSuggestTimeEntry && note.audioDuration) {
    const timeEntry = await suggestTimeEntry(text, category, note.audioDuration);
    updateData.suggestedDuration = timeEntry.suggestedMinutes;
    updateData.suggestedActivity = timeEntry.activity;
    updateData.suggestedDescription = timeEntry.description;
    updateData.suggestedBillable = timeEntry.isBillable;
  }

  if (settings?.autoSuggestDocket) {
    const docket = await suggestDocketEntry(text, entities);
    updateData.suggestedDocketEntry = docket ? JSON.stringify(docket) : null;
  }

  if (settings?.autoSuggestTasks) {
    const tasks = await suggestTasks(text, entities);
    updateData.suggestedTasks = JSON.stringify(tasks);
  }

  return db.voiceNote.update({
    where: { id: voiceNoteId },
    data: updateData as any,
  });
}

export async function searchNotes(query: string, matterId?: string) {
  const where: any = {
    transcription: { contains: query, mode: "insensitive" },
  };
  if (matterId) where.matterId = matterId;

  const notes = await db.voiceNote.findMany({ where, orderBy: { recordedAt: "desc" } });

  return notes.map((n: any) => {
    const t = n.transcription || "";
    const idx = t.toLowerCase().indexOf(query.toLowerCase());
    const start = Math.max(0, idx - 40);
    const end = Math.min(t.length, idx + query.length + 40);
    const excerpt = (start > 0 ? "..." : "") + t.slice(start, end) + (end < t.length ? "..." : "");
    return { ...n, excerpt };
  });
}
