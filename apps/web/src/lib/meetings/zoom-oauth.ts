import axios from "axios";
import { db } from "@/lib/db";

const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID || "";
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET || "";
const REDIRECT_URI = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/meetings/zoom/callback`;

export function getZoomAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: ZOOM_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    state: userId,
  });
  return `https://zoom.us/oauth/authorize?${params.toString()}`;
}

export async function exchangeZoomCode(code: string) {
  const res = await axios.post("https://zoom.us/oauth/token", null, {
    params: { grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI },
    headers: {
      Authorization: `Basic ${Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64")}`,
    },
  });
  return {
    accessToken: res.data.access_token,
    refreshToken: res.data.refresh_token,
    expiresAt: new Date(Date.now() + res.data.expires_in * 1000),
  };
}

export async function refreshZoomToken(connectionId: string) {
  const conn = await db.videoConnection.findUniqueOrThrow({ where: { id: connectionId } });
  const res = await axios.post("https://zoom.us/oauth/token", null, {
    params: { grant_type: "refresh_token", refresh_token: conn.refreshToken },
    headers: {
      Authorization: `Basic ${Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64")}`,
    },
  });
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

export async function getZoomClient(userId: string) {
  const conn = await db.videoConnection.findFirst({ where: { userId, provider: "ZOOM", isActive: true } });
  if (!conn) throw new Error("Zoom not connected");

  let token = conn.accessToken;
  if (conn.tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000) {
    token = await refreshZoomToken(conn.id);
  }

  return {
    connection: conn,
    api: axios.create({
      baseURL: "https://api.zoom.us/v2",
      headers: { Authorization: `Bearer ${token}` },
    }),
  };
}

export async function getZoomUserInfo(accessToken: string) {
  const res = await axios.get("https://api.zoom.us/v2/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { zoomUserId: res.data.id, email: res.data.email };
}
