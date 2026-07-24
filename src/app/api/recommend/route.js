import { recommend } from "@/lib/engine";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const limit = new URL(request.url).searchParams.get("limit") || body.limit || 24;
    return Response.json(recommend(body, limit));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
