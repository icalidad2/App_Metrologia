// src/app/api/history/route.js
export const runtime = "nodejs";

import { assertApiKey, buildAppsScriptUrl, fetchJson, jsonResponse } from "@/lib/appsScriptProxy";

export async function GET(request) {
  const auth = assertApiKey(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status);

  try {
    const { searchParams } = new URL(request.url);

    const url = buildAppsScriptUrl("history", {
      product_id: searchParams.get("product_id"),
      lot: searchParams.get("lot"),
      cavity: searchParams.get("cavity"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      limit: searchParams.get("limit"),
    });

    const { resp, data } = await fetchJson(url, { method: "GET" }, 20000);
    return jsonResponse(data, resp.ok ? 200 : 500);
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) }, 500);
  }
}
