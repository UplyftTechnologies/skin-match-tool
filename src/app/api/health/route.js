import { health } from "@/lib/engine";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json(await health());
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
