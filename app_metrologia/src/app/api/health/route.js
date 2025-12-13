// ===============================================
// FILE: src/app/api/health/route.js
// ===============================================
export const runtime = "nodejs";

export async function GET() {
  const hasUrl = !!process.env.APPS_SCRIPT_URL;
  const hasKey = !!process.env.APPS_SCRIPT_INTERNAL_KEY;

  return Response.json({
    ok: true,
    env: {
      APPS_SCRIPT_URL: hasUrl ? "ok" : "missing",
      APPS_SCRIPT_INTERNAL_KEY: hasKey ? "ok" : "missing"
    },
    ts: new Date().toISOString()
  });
}
