import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

function store() {
  return getStore({ name: "vendor-signins", consistency: "strong" });
}

async function allVisits() {
  const s = store();
  const { blobs } = await s.list({ prefix: "v/" });
  const out = [];
  for (const b of blobs) {
    const row = await s.get(b.key, { type: "json" });
    if (row) out.push(row);
  }
  out.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || String(a.timeIn || "").localeCompare(String(b.timeIn || "")));
  return out;
}

export default async (req: Request, _context: Context) => {
  try {
    if (req.method === "GET") {
      return Response.json({ ok: true, visits: await allVisits() });
    }
    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      const incoming = Array.isArray(body?.visits) ? body.visits : body?.visit ? [body.visit] : [];
      const s = store();
      const saved = [];
      for (const v of incoming) {
        if (!v || !v.id) continue;
        const key = "v/" + String(v.id).slice(0, 80);
        const prev = (await s.get(key, { type: "json" })) || {};
        const next = { ...prev, ...v };
        if (prev.timeOut && !v.timeOut) next.timeOut = prev.timeOut;
        if (v.timeOut) next.timeOut = v.timeOut;
        next.updatedAt = new Date().toISOString();
        await s.setJSON(key, next);
        saved.push(next);
      }
      return Response.json({ ok: true, saved: saved.length, visits: await allVisits() });
    }
    return new Response("Method not allowed", { status: 405 });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/visits",
};
