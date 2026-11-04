// Import d'un fichier (image ou son) par l'admin — type et taille vérifiés
import { randomUUID } from "crypto";
import { AdminError, requireAdmin } from "@/lib/admin";
import { srv } from "@/lib/srv";

const LIMITS = { image: 2_500_000, audio: 700_000 };

/** On regarde les premiers octets du fichier (et pas seulement son nom). */
function sniff(b: Buffer): { mime: string; kind: "image" | "audio" } | null {
  const hex = b.subarray(0, 12).toString("hex");
  const ascii = b.subarray(0, 12).toString("latin1");
  if (hex.startsWith("89504e47")) return { mime: "image/png", kind: "image" };
  if (hex.startsWith("ffd8ff")) return { mime: "image/jpeg", kind: "image" };
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return { mime: "image/webp", kind: "image" };
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WAVE") return { mime: "audio/wav", kind: "audio" };
  if (ascii.startsWith("ID3") || hex.startsWith("fffb") || hex.startsWith("fff3") || hex.startsWith("fff2")) return { mime: "audio/mpeg", kind: "audio" };
  if (ascii.startsWith("OggS")) return { mime: "audio/ogg", kind: "audio" };
  if (ascii.slice(4, 8) === "ftyp") return { mime: "audio/mp4", kind: "audio" };
  return null;
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    const form = await req.formData();
    const file = form.get("file");
    const want = form.get("kind") === "audio" ? "audio" : "image";
    if (!(file instanceof File)) throw new AdminError("Aucun fichier reçu", 400);
    const buf = Buffer.from(await file.arrayBuffer());
    const t = sniff(buf);
    if (!t || t.kind !== want)
      throw new AdminError(want === "image" ? "Image refusée : PNG, JPEG ou WEBP uniquement" : "Son refusé : MP3, OGG, WAV ou M4A uniquement", 400);
    if (buf.length > LIMITS[want])
      throw new AdminError(`Fichier trop lourd (max ${Math.round(LIMITS[want] / 1000)} Ko)`, 400);
    const id = randomUUID();
    await srv("asset_put", { id, mime: t.mime, b64: buf.toString("base64"), size: buf.length, name: file.name.slice(0, 80), actor: admin.id });
    return Response.json({ id, mime: t.mime, size: buf.length });
  } catch (e) {
    if (e instanceof AdminError) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
