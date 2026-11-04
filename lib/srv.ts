// Appel du point d'entrée serveur de la base (protégé par APP_SECRET).
import "server-only";
import { createClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient> | null = null;
function db() {
  if (!client) client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_KEY!, { auth: { persistSession: false } });
  return client;
}

export async function srv<T = unknown>(op: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db().rpc("srv", { p_secret: process.env.APP_SECRET!, p_op: op, p_args: args });
  if (error) throw new Error(`srv ${op}: ${error.message}`);
  return data as T;
}
