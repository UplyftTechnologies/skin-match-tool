import { health } from "@/lib/engine";

export const runtime = "nodejs";

export function GET() {
  try {
    return Response.json(health());
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
