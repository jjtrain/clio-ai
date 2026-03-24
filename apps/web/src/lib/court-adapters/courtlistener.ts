import type { CourtAdapter, CourtEventData } from "./types";

const API_BASE = "https://www.courtlistener.com/api/rest/v3";

/**
 * CourtListener adapter — free REST API covering all federal courts.
 * No auth required for public case data.
 * Supports: SDNY, EDNY, NDNY, all circuit courts, bankruptcy courts, etc.
 */
export const CourtListenerAdapter: CourtAdapter = {
  name: "COURTLISTENER",

  async fetchEvents(caseNumber: string): Promise<CourtEventData[]> {
    const events: CourtEventData[] = [];

    try {
      // Search for docket by case number
      const docket = await searchDocket(caseNumber);
      if (!docket) return [];

      // Fetch docket entries
      const entries = await fetchDocketEntries(docket.id);

      for (const entry of entries) {
        const eventType = classifyDocketEntry(entry.description || "");
        events.push({
          externalId: `cl-${entry.id}`,
          eventType,
          title: truncate(entry.description || `Docket Entry #${entry.entry_number}`, 200),
          courtName: docket.court_name || docket.court,
          judgeAssigned: docket.assigned_to_str || undefined,
          caseNumber: docket.case_name ? `${caseNumber} - ${docket.case_name}` : caseNumber,
          scheduledAt: new Date(entry.date_filed || entry.date_created),
          notes: entry.description,
        });
      }
    } catch (err: any) {
      console.error(`[CourtListener] Error fetching ${caseNumber}:`, err.message);
    }

    return events;
  },

  async validateCredentials(): Promise<boolean> {
    // No credentials needed — free API
    try {
      const res = await fetch(`${API_BASE}/courts/?format=json&page_size=1`);
      return res.ok;
    } catch {
      return false;
    }
  },
};

async function searchDocket(caseNumber: string): Promise<any | null> {
  // Try docket number search first
  const encoded = encodeURIComponent(caseNumber);
  const url = `${API_BASE}/dockets/?format=json&docket_number=${encoded}&page_size=1`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Managal/1.0 (legal practice management)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results?.length > 0) return data.results[0];

    // Fallback: search by case name
    const nameUrl = `${API_BASE}/dockets/?format=json&case_name=${encoded}&page_size=1`;
    const nameRes = await fetch(nameUrl, {
      headers: { "User-Agent": "Managal/1.0 (legal practice management)" },
    });
    if (!nameRes.ok) return null;
    const nameData = await nameRes.json();
    return nameData.results?.[0] || null;
  } catch {
    return null;
  }
}

async function fetchDocketEntries(docketId: number): Promise<any[]> {
  const url = `${API_BASE}/docket-entries/?format=json&docket=${docketId}&page_size=50&order_by=-date_filed`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Managal/1.0 (legal practice management)" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

function classifyDocketEntry(description: string): CourtEventData["eventType"] {
  const text = description.toLowerCase();
  if (text.includes("hearing") || text.includes("calendar call") || text.includes("oral argument")) return "HEARING";
  if (text.includes("trial") || text.includes("jury selection")) return "TRIAL";
  if (text.includes("conference") || text.includes("pretrial") || text.includes("status")) return "CONFERENCE";
  if (text.includes("motion") || text.includes("brief")) return "MOTION";
  if (text.includes("judgment") || text.includes("verdict") || text.includes("sentence")) return "JUDGMENT";
  if (text.includes("order") || text.includes("ruling") || text.includes("decision")) return "ORDER";
  if (text.includes("deadline") || text.includes("due") || text.includes("respond")) return "FILING_DEADLINE";
  return "FILING_DEADLINE"; // Default for docket entries
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 3) + "..." : str;
}
