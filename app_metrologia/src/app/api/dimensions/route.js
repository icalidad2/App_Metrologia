// src/app/api/dimensions/route.js
export const runtime = "nodejs";

import { assertApiKey, buildAppsScriptUrl, fetchJson, jsonResponse } from "@/lib/appsScriptProxy";

export async function GET(request) {
  const auth = assertApiKey(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status);

  try {
    const { searchParams } = new URL(request.url);
    const product_id = searchParams.get("product_id");
    if (!product_id) return jsonResponse({ ok: false, error: "product_id requerido." }, 400);

    const url = buildAppsScriptUrl("dimensions", { product_id });
    const { resp, data } = await fetchJson(url, { method: "GET" }, 15000);
    return jsonResponse(data, resp.ok ? 200 : 500);
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) }, 500);
  }
}
