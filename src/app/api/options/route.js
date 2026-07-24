import { optionsPayload } from "@/lib/engine";
import { COVERAGE_MODES } from "@/lib/profiles";

export const runtime = "nodejs";

export function GET() {
  try {
    return Response.json(optionsPayload(COVERAGE_MODES));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
