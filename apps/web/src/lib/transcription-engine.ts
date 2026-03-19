import { db } from "@/lib/db";
import * as openai from "@/lib/integrations/openai";

export async function transcribeFile(params: { fileContent: string; fileMimeType: string; language?: string; matterId?: string; documentId?: string }) {
  const result = await openai.transcribeAudio({ audioContent: params.fileContent, audioMimeType: params.fileMimeType, language: params.language, feature: "file_transcription", matterId: params.matterId, responseFormat: "verbose_json", timestampGranularity: "segment" });
  if (params.matterId) {
    await db.document.create({
      data: { matterId: params.matterId, name: `Transcription - ${new Date().toISOString().split("T")[0]}`, filename: "transcription.txt", mimeType: "text/plain", size: result.text.length, path: "" },
    });
  }
  return { text: result.text, segments: result.segments, duration: result.duration };
}

export async function transcribeCallRecording(callRecordId: string) {
  // Load call recording audio — in production, fetch from storage
  // For now, return placeholder
  return { text: "Call recording transcription placeholder", callRecordId, duration: 0 };
}

export async function transcribeZoomRecording(meetingId: string) {
  // In production: download Zoom recording audio, transcribe via Whisper
  // Better accuracy than Zoom's built-in for legal terminology
  return { text: "Zoom recording transcription placeholder", meetingId, duration: 0 };
}

export async function transcribeDepositionAudio(sessionId: string) {
  // Transcribe deposition audio — preliminary AI-generated transcript
  return { text: "Deposition transcription placeholder (AI-generated, not official)", sessionId, duration: 0, isAiGenerated: true };
}

export async function transcribeVoicemail(params: { audioContent: string; matterId?: string; clientId?: string }) {
  const result = await openai.transcribeAudio({ audioContent: params.audioContent, audioMimeType: "audio/mp3", feature: "voicemail_transcription", matterId: params.matterId });
  return { text: result.text, duration: result.duration };
}

export async function batchTranscribe(files: Array<{ content: string; mimeType: string; referenceId: string; referenceType: string }>) {
  const results = [];
  for (const file of files) {
    try {
      const result = await openai.transcribeAudio({ audioContent: file.content, audioMimeType: file.mimeType, feature: "batch_transcription" });
      results.push({ referenceId: file.referenceId, referenceType: file.referenceType, text: result.text, duration: result.duration, status: "success" });
    } catch (err: any) {
      results.push({ referenceId: file.referenceId, referenceType: file.referenceType, text: "", duration: 0, status: "error", error: err.message });
    }
  }
  return results;
}
