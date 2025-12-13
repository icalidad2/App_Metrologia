// src/app/api/measurements/route.js
export const runtime = "nodejs";

import { assertApiKey, buildAppsScriptUrl, fetchJson, jsonResponse } from "@/lib/appsScriptProxy";

export async function POST(request) {
  const auth = assertApiKey(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status);

  try {
    const body = await request.json().catch(() => null);
    if (!body) return jsonResponse({ ok: false, error: "Body JSON requerido." }, 400);

    const url = buildAppsScriptUrl("measurements");
    const { resp, data } = await fetchJson(
      url,
      { method: "POST", body: JSON.stringify(body) },
      25000
    );

    return jsonResponse(data, resp.ok ? 200 : 500);
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) }, 500);
  }
}
