// Photo de profil d'un joueur (servie en image, mise en cache)
import { photoOf } from "@/lib/profiles";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const photo = await photoOf((await params).id).catch(() => null);
  const m = photo?.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: { "content-type": m[1], "cache-control": "public, max-age=31536000, immutable" },
  });
}
