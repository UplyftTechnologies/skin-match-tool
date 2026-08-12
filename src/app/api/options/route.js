import { optionsPayload } from "@/lib/engine";
import { COVERAGE_MODES } from "@/lib/profiles";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json(await optionsPayload(COVERAGE_MODES));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
