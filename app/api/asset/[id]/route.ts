// Fichier importé dans l'admin (image ou son), servi avec un long cache
import { srv } from "@/lib/srv";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const a = await srv<{ mime: string; b64: string } | null>("asset_get", { id }).catch(() => null);
  if (!a) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(a.b64, "base64"), {
    headers: { "content-type": a.mime, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
  });
}
