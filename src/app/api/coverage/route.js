import { coverage } from "@/lib/engine";
import { COVERAGE_MODES, profilesForMode } from "@/lib/profiles";

export const runtime = "nodejs";
export const maxDuration = 60;

function limitRows(payload, rowLimit) {
  const order = { "Coverage gap": 0, "Limited but usable": 1, Usable: 2, Strong: 3 };
  const rows = [...payload.rows].sort(
    (a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9)
      || a.profile_id.localeCompare(b.profile_id),
  );
  payload.total_rows = rows.length;
  payload.rows = rowLimit > 0 ? rows.slice(0, rowLimit) : rows;
  payload.returned_rows = payload.rows.length;
  return payload;
}

async function responseFor({ mode = "all_pnc", count = 72, topN = 5, rowLimit = 0, profiles }) {
  const payload = await coverage(profiles || profilesForMode(mode, count), topN);
  payload.mode = mode;
  payload.mode_meta = COVERAGE_MODES[mode] || COVERAGE_MODES.all_pnc;
  return limitRows(payload, rowLimit);
}

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    return Response.json(await responseFor({
      mode: params.get("mode") || "all_pnc",
      count: Number(params.get("count")) || 72,
      topN: Number(params.get("top_n")) || 5,
      rowLimit: Number(params.get("row_limit")) || 0,
    }));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    return Response.json(await responseFor({
      mode: body.mode || "all_pnc",
      count: Number(body.count) || 72,
      topN: Number(body.top_n) || 5,
      rowLimit: Number(body.row_limit) || 0,
      profiles: body.profiles,
    }));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
