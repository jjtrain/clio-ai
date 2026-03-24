import { google } from "googleapis";
import { db } from "@/lib/db";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const REDIRECT_URI = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/gmail/callback`;

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function createOAuth2Client() {
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
}

export function getAuthUrl(userId: string): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: userId,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  return {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token!,
    expiry: new Date(tokens.expiry_date || Date.now() + 3600000),
  };
}

export async function refreshAccessToken(connectionId: string) {
  const connection = await db.gmailConnection.findUniqueOrThrow({ where: { id: connectionId } });
  const client = createOAuth2Client();
  client.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
  });

  const { credentials } = await client.refreshAccessToken();

  await db.gmailConnection.update({
    where: { id: connectionId },
    data: {
      accessToken: credentials.access_token!,
      refreshToken: credentials.refresh_token || connection.refreshToken,
      tokenExpiry: new Date(credentials.expiry_date || Date.now() + 3600000),
    },
  });

  return credentials;
}

export async function getAuthorizedClient(userId: string) {
  const connection = await db.gmailConnection.findUnique({ where: { userId } });
  if (!connection) throw new Error("Gmail not connected");

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
  });

  // Refresh if within 5 minutes of expiry
  if (connection.tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000) {
    const { credentials } = await client.refreshAccessToken();
    await db.gmailConnection.update({
      where: { userId },
      data: {
        accessToken: credentials.access_token!,
        refreshToken: credentials.refresh_token || connection.refreshToken,
        tokenExpiry: new Date(credentials.expiry_date || Date.now() + 3600000),
      },
    });
    client.setCredentials(credentials);
  }

  return { client, gmail: google.gmail({ version: "v1", auth: client }), connection };
}

export async function getUserEmail(accessToken: string): Promise<string> {
  const client = createOAuth2Client();
  client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  return data.email || "";
}
