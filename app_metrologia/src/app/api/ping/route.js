// src/app/api/ping/route.js
export const runtime = "nodejs";

import { assertApiKey, buildAppsScriptUrl, fetchJson, jsonResponse } from "@/lib/appsScriptProxy";

export async function GET(request) {
  const auth = assertApiKey(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status);

  try {
    const url = buildAppsScriptUrl("ping");
    const { resp, data } = await fetchJson(url, { method: "GET" }, 8000);
    return jsonResponse(data, resp.ok ? 200 : 500);
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) }, 500);
  }
}
