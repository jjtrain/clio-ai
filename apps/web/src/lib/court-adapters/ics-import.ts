import type { CourtAdapter, CourtEventData } from "./types";

/**
 * Parses .ics (iCalendar) files from any court system (NYSCEF, local courts, etc).
 * Maps VEVENT blocks to CourtEvent schema.
 */
export const ICSImportAdapter: CourtAdapter = {
  name: "IMPORT",

  async fetchEvents(_caseNumber: string, credentials?: { icsContent: string }): Promise<CourtEventData[]> {
    if (!credentials?.icsContent) return [];
    return parseICS(credentials.icsContent);
  },

  async validateCredentials(credentials: any): Promise<boolean> {
    return typeof credentials?.icsContent === "string" && credentials.icsContent.includes("BEGIN:VCALENDAR");
  },
};

export function parseICS(icsContent: string): CourtEventData[] {
  const events: CourtEventData[] = [];
  const blocks = icsContent.split("BEGIN:VEVENT");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("END:VEVENT")[0];
    if (!block) continue;

    const get = (key: string): string => {
      // Handle folded lines (RFC 5545 line folding)
      const unfolded = block.replace(/\r?\n[ \t]/g, "");
      const regex = new RegExp(`^${key}[;:](.*)$`, "m");
      const match = unfolded.match(regex);
      if (!match) return "";
      // Remove any parameter before value (e.g., DTSTART;TZID=...:20260315T...)
      const val = match[1];
      const colonIdx = val.indexOf(":");
      // If there were params (indicated by key having ; after it), the value might be after another colon
      if (key === "DTSTART" || key === "DTEND") {
        // Could be DTSTART;TZID=America/New_York:20260315T090000
        return val.includes(":") ? val.split(":").pop()! : val;
      }
      return val;
    };

    const uid = get("UID");
    const summary = get("SUMMARY");
    const dtstart = get("DTSTART");
    const dtend = get("DTEND");
    const location = get("LOCATION");
    const description = get("DESCRIPTION");

    if (!dtstart || !summary) continue;

    const scheduledAt = parseICSDate(dtstart);
    if (!scheduledAt) continue;

    const endTime = dtend ? parseICSDate(dtend) : undefined;

    // Determine event type from summary
    const eventType = classifyEventType(summary, description);

    // Extract court name and judge from description
    const courtName = extractCourtName(description, location);
    const judgeAssigned = extractJudge(description);

    events.push({
      externalId: uid || `ics-${scheduledAt.getTime()}-${summary.slice(0, 20)}`,
      eventType,
      title: unescapeICS(summary),
      courtName: courtName ? unescapeICS(courtName) : undefined,
      judgeAssigned: judgeAssigned ? unescapeICS(judgeAssigned) : undefined,
      scheduledAt,
      endTime,
      location: location ? unescapeICS(location) : undefined,
      notes: description ? unescapeICS(description) : undefined,
    });
  }

  return events;
}

function parseICSDate(val: string): Date | null {
  // Formats: 20260315T090000Z, 20260315T090000, 20260315
  const clean = val.replace(/[^0-9TZ]/g, "");
  if (clean.length >= 8) {
    const y = parseInt(clean.slice(0, 4));
    const m = parseInt(clean.slice(4, 6)) - 1;
    const d = parseInt(clean.slice(6, 8));
    let h = 0, min = 0, s = 0;
    if (clean.length >= 15) {
      h = parseInt(clean.slice(9, 11));
      min = parseInt(clean.slice(11, 13));
      s = parseInt(clean.slice(13, 15));
    }
    if (clean.endsWith("Z")) {
      return new Date(Date.UTC(y, m, d, h, min, s));
    }
    return new Date(y, m, d, h, min, s);
  }
  return null;
}

function classifyEventType(summary: string, description: string): CourtEventData["eventType"] {
  const text = `${summary} ${description}`.toLowerCase();
  if (text.includes("trial")) return "TRIAL";
  if (text.includes("conference") || text.includes("status conf")) return "CONFERENCE";
  if (text.includes("motion") || text.includes("oral argument")) return "MOTION";
  if (text.includes("filing") || text.includes("deadline") || text.includes("due date")) return "FILING_DEADLINE";
  if (text.includes("judgment") || text.includes("decision") || text.includes("order")) return "JUDGMENT";
  if (text.includes("hearing") || text.includes("calendar call")) return "HEARING";
  return "HEARING";
}

function extractCourtName(description: string, location: string): string | null {
  const text = `${description} ${location}`;
  const match = text.match(/(?:court|courthouse|courtroom|div(?:ision)?)[:\s]+([^\n,;]+)/i);
  return match?.[1]?.trim() || null;
}

function extractJudge(description: string): string | null {
  const match = description.match(/(?:judge|hon\.|justice|magistrate)[:\s]+([^\n,;]+)/i);
  return match?.[1]?.trim() || null;
}

function unescapeICS(val: string): string {
  return val
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}
