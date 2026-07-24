import { representativeProfiles } from "@/lib/profiles";

export function GET(request) {
  const count = Number(new URL(request.url).searchParams.get("count")) || 72;
  return Response.json({ profiles: representativeProfiles(count) });
}
