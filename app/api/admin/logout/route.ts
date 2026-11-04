import { clearSessionCookie } from "@/lib/admin";

export async function POST() {
  await clearSessionCookie();
  return Response.json({ ok: true });
}
