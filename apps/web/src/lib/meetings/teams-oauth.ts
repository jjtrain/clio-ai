import axios from "axios";
import { db } from "@/lib/db";

const MS_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || "";
const MS_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || "";
const MS_TENANT = process.env.MICROSOFT_TENANT_ID || "common";
const REDIRECT_URI = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/meetings/teams/callback`;

const SCOPES = "OnlineMeetings.ReadWrite Calendars.ReadWrite User.Read offline_access";

export function getTeamsAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state: userId,
    response_mode: "query",
  });
  return `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeTeamsCode(code: string) {
  const res = await axios.post(
    `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
      scope: SCOPES,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );
  return {
    accessToken: res.data.access_token,
    refreshToken: res.data.refresh_token,
    expiresAt: new Date(Date.now() + res.data.expires_in * 1000),
  };
}

export async function refreshTeamsToken(connectionId: string) {
  const conn = await db.videoConnection.findUniqueOrThrow({ where: { id: connectionId } });
  const res = await axios.post(
    `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      refresh_token: conn.refreshToken,
      grant_type: "refresh_token",
      scope: SCOPES,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );
  await db.videoConnection.update({
    where: { id: connectionId },
    data: {
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
      tokenExpiry: new Date(Date.now() + res.data.expires_in * 1000),
    },
  });
  return res.data.access_token;
}

export async function getTeamsClient(userId: string) {
  const conn = await db.videoConnection.findFirst({ where: { userId, provider: "TEAMS", isActive: true } });
  if (!conn) throw new Error("Teams not connected");

  let token = conn.accessToken;
  if (conn.tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000) {
    token = await refreshTeamsToken(conn.id);
  }

  return {
    connection: conn,
    api: axios.create({
      baseURL: "https://graph.microsoft.com/v1.0",
      headers: { Authorization: `Bearer ${token}` },
    }),
  };
}

export async function getTeamsUserInfo(accessToken: string) {
  const res = await axios.get("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { email: res.data.mail || res.data.userPrincipalName, tenantId: res.data.id };
}
