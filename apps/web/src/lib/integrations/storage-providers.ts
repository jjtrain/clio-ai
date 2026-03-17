import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

async function getStorageConfig(provider: string) {
  const c = await db.storageIntegration.findUnique({ where: { provider } });
  if (!c?.isEnabled) return null;
  return c;
}
function headers(token: string) { return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }; }
function notConfigured(p: string) { return { success: false, error: `${p} is not configured.`, provider: p }; }

// ─── Dropbox ─────────────────────────────────────────────────────
export async function dropboxTestConnection() {
  const c = await getStorageConfig("DROPBOX");
  if (!c?.accessToken) return notConfigured("Dropbox");
  try {
    const res = await makeApiCall("https://api.dropboxapi.com/2/users/get_current_account", { method: "POST", headers: { Authorization: `Bearer ${c.accessToken}`, "Content-Type": "application/json" }, body: "null" });
    return res.ok ? { success: true, data: await res.json(), provider: "DROPBOX" } : { success: false, error: `Dropbox returned ${res.status}`, provider: "DROPBOX" };
  } catch (err: any) { return { success: false, error: err.message, provider: "DROPBOX" }; }
}
export async function dropboxListFolder(path: string) {
  const c = await getStorageConfig("DROPBOX");
  if (!c?.accessToken) return notConfigured("Dropbox");
  try {
    const res = await makeApiCall("https://api.dropboxapi.com/2/files/list_folder", { method: "POST", headers: { Authorization: `Bearer ${c.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ path: path || "", recursive: false }) });
    return res.ok ? { success: true, data: await res.json(), provider: "DROPBOX" } : { success: false, error: `Failed: ${res.status}`, provider: "DROPBOX" };
  } catch (err: any) { return { success: false, error: err.message, provider: "DROPBOX" }; }
}
export async function dropboxSearch(query: string) {
  const c = await getStorageConfig("DROPBOX");
  if (!c?.accessToken) return notConfigured("Dropbox");
  try {
    const res = await makeApiCall("https://api.dropboxapi.com/2/files/search_v2", { method: "POST", headers: { Authorization: `Bearer ${c.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ query, options: { max_results: 20 } }) });
    return res.ok ? { success: true, data: await res.json(), provider: "DROPBOX" } : { success: false, error: `Failed: ${res.status}`, provider: "DROPBOX" };
  } catch (err: any) { return { success: false, error: err.message, provider: "DROPBOX" }; }
}

// ─── Box ─────────────────────────────────────────────────────────
export async function boxTestConnection() {
  const c = await getStorageConfig("BOX");
  if (!c?.accessToken) return notConfigured("Box");
  try {
    const res = await makeApiCall("https://api.box.com/2.0/users/me", { headers: headers(c.accessToken) });
    return res.ok ? { success: true, data: await res.json(), provider: "BOX" } : { success: false, error: `Box returned ${res.status}`, provider: "BOX" };
  } catch (err: any) { return { success: false, error: err.message, provider: "BOX" }; }
}
export async function boxListFolder(folderId: string) {
  const c = await getStorageConfig("BOX");
  if (!c?.accessToken) return notConfigured("Box");
  try {
    const res = await makeApiCall(`https://api.box.com/2.0/folders/${folderId || "0"}/items?limit=100`, { headers: headers(c.accessToken) });
    return res.ok ? { success: true, data: await res.json(), provider: "BOX" } : { success: false, error: `Failed: ${res.status}`, provider: "BOX" };
  } catch (err: any) { return { success: false, error: err.message, provider: "BOX" }; }
}

// ─── Google Drive ────────────────────────────────────────────────
export async function gdriveTestConnection() {
  const c = await getStorageConfig("GOOGLE_DRIVE");
  if (!c?.accessToken) return notConfigured("Google Drive");
  try {
    const res = await makeApiCall("https://www.googleapis.com/drive/v3/about?fields=user,storageQuota", { headers: headers(c.accessToken) });
    return res.ok ? { success: true, data: await res.json(), provider: "GOOGLE_DRIVE" } : { success: false, error: `Google Drive returned ${res.status}`, provider: "GOOGLE_DRIVE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "GOOGLE_DRIVE" }; }
}
export async function gdriveListFolder(folderId: string) {
  const c = await getStorageConfig("GOOGLE_DRIVE");
  if (!c?.accessToken) return notConfigured("Google Drive");
  try {
    const q = `'${folderId || "root"}' in parents and trashed=false`;
    const res = await makeApiCall(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink)&pageSize=100`, { headers: headers(c.accessToken) });
    return res.ok ? { success: true, data: await res.json(), provider: "GOOGLE_DRIVE" } : { success: false, error: `Failed: ${res.status}`, provider: "GOOGLE_DRIVE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "GOOGLE_DRIVE" }; }
}
export async function gdriveSearch(query: string) {
  const c = await getStorageConfig("GOOGLE_DRIVE");
  if (!c?.accessToken) return notConfigured("Google Drive");
  try {
    const res = await makeApiCall(`https://www.googleapis.com/drive/v3/files?q=fullText contains '${query.replace(/'/g, "\\'")}'&fields=files(id,name,mimeType,size,modifiedTime,webViewLink)&pageSize=20`, { headers: headers(c.accessToken) });
    return res.ok ? { success: true, data: await res.json(), provider: "GOOGLE_DRIVE" } : { success: false, error: `Failed: ${res.status}`, provider: "GOOGLE_DRIVE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "GOOGLE_DRIVE" }; }
}

// ─── OneDrive / Microsoft 365 ────────────────────────────────────
export async function onedriveTestConnection() {
  const c = await getStorageConfig("ONEDRIVE");
  if (!c?.accessToken) return notConfigured("OneDrive");
  try {
    const res = await makeApiCall("https://graph.microsoft.com/v1.0/me?$select=displayName,mail", { headers: headers(c.accessToken) });
    return res.ok ? { success: true, data: await res.json(), provider: "ONEDRIVE" } : { success: false, error: `OneDrive returned ${res.status}`, provider: "ONEDRIVE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "ONEDRIVE" }; }
}
export async function onedriveListFolder(folderId?: string) {
  const c = await getStorageConfig("ONEDRIVE");
  if (!c?.accessToken) return notConfigured("OneDrive");
  try {
    const path = folderId ? `/me/drive/items/${folderId}/children` : "/me/drive/root/children";
    const res = await makeApiCall(`https://graph.microsoft.com/v1.0${path}?$select=id,name,size,lastModifiedDateTime,file,folder,webUrl`, { headers: headers(c.accessToken) });
    return res.ok ? { success: true, data: await res.json(), provider: "ONEDRIVE" } : { success: false, error: `Failed: ${res.status}`, provider: "ONEDRIVE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "ONEDRIVE" }; }
}
export async function onedriveSearch(query: string) {
  const c = await getStorageConfig("ONEDRIVE");
  if (!c?.accessToken) return notConfigured("OneDrive");
  try {
    const res = await makeApiCall(`https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(query)}')`, { headers: headers(c.accessToken) });
    return res.ok ? { success: true, data: await res.json(), provider: "ONEDRIVE" } : { success: false, error: `Failed: ${res.status}`, provider: "ONEDRIVE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "ONEDRIVE" }; }
}
