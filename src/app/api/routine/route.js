import { routine } from "@/lib/engine";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const limit = new URL(request.url).searchParams.get("limit") || body.limit || 1000;
    return Response.json(routine(body, limit));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
