// Google Calendar integration
// Requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and NEXTAUTH_URL environment variables

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const SCOPES = "https://www.googleapis.com/auth/calendar";

function getRedirectUri(): string {
  const base = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
  return `${base}/api/google/callback`;
}

export function getAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function handleCallback(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google OAuth failed: ${body}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function refreshTokenIfNeeded(syncConfig: {
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: Date | null;
}): Promise<string> {
  if (!syncConfig.accessToken || !syncConfig.refreshToken) {
    throw new Error("Google Calendar not connected");
  }

  // If token hasn't expired (with 5 min buffer), return it
  if (syncConfig.tokenExpiry && syncConfig.tokenExpiry.getTime() > Date.now() + 5 * 60 * 1000) {
    return syncConfig.accessToken;
  }

  // Refresh the token
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: syncConfig.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to refresh Google token");
  }

  const data = await res.json();
  return data.access_token;
}

interface GoogleEventData {
  summary: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  allDay?: boolean;
}

async function googleCalendarFetch(
  accessToken: string,
  calendarId: string,
  path: string,
  options: RequestInit = {}
) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Calendar API error: ${res.status} ${body}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

function formatEventBody(event: GoogleEventData) {
  if (event.allDay) {
    const startDate = event.startTime.toISOString().split("T")[0];
    const endDate = event.endTime.toISOString().split("T")[0];
    return {
      summary: event.summary,
      description: event.description || undefined,
      location: event.location || undefined,
      start: { date: startDate },
      end: { date: endDate },
    };
  }

  return {
    summary: event.summary,
    description: event.description || undefined,
    location: event.location || undefined,
    start: { dateTime: event.startTime.toISOString(), timeZone: "UTC" },
    end: { dateTime: event.endTime.toISOString(), timeZone: "UTC" },
  };
}

export async function createGoogleEvent(
  accessToken: string,
  calendarId: string,
  event: GoogleEventData
): Promise<string> {
  const body = formatEventBody(event);
  const result = await googleCalendarFetch(accessToken, calendarId, "/events", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return result.id;
}

export async function updateGoogleEvent(
  accessToken: string,
  calendarId: string,
  googleEventId: string,
  event: GoogleEventData
): Promise<void> {
  const body = formatEventBody(event);
  await googleCalendarFetch(accessToken, calendarId, `/events/${googleEventId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteGoogleEvent(
  accessToken: string,
  calendarId: string,
  googleEventId: string
): Promise<void> {
  await googleCalendarFetch(accessToken, calendarId, `/events/${googleEventId}`, {
    method: "DELETE",
  });
}

export async function listGoogleEvents(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<any[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const result = await googleCalendarFetch(
    accessToken,
    calendarId,
    `/events?${params.toString()}`
  );
  return result?.items || [];
}
