// Contenu publié (phrases, sons, gobelets, maps, réglages, apparence) — public
import { publicContent } from "@/lib/content-server";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await publicContent(), { headers: { "cache-control": "public, max-age=10, s-maxage=15" } });
}
