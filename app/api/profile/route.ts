// Mon profil : créer (POST), lire (GET), modifier (PATCH)
import { authProfile, createProfile, profilePayload, updateProfile } from "@/lib/profiles";
import { handle, json } from "@/lib/api";

export const dynamic = "force-dynamic";

const creds = (req: Request) => [req.headers.get("x-profile-id"), req.headers.get("x-profile-key")] as const;

export async function POST(req: Request) {
  try {
    const { name } = await req.json().catch(() => ({}));
    const { id, key, row } = await createProfile(name);
    return json({ id, key, ...(await profilePayload(row)) });
  } catch (e) {
    return handle(e);
  }
}

export async function GET(req: Request) {
  try {
    const r = await authProfile(...creds(req));
    if (!r) return json({ error: "Profil introuvable" }, 404);
    return json(await profilePayload(r));
  } catch (e) {
    return handle(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const r = await authProfile(...creds(req));
    if (!r) return json({ error: "Profil introuvable" }, 404);
    const patch = await req.json();
    return json(await profilePayload(await updateProfile(r, patch)));
  } catch (e) {
    return handle(e);
  }
}
