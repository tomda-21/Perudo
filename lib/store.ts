// Accès à la base Supabase — utilisé uniquement côté serveur.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { GameState, RuleError } from "./rules";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_KEY;
  if (!url || !key) throw new Error("Variables Supabase manquantes");
  return createClient(url, key, { auth: { persistSession: false } });
}

function secret() {
  const s = process.env.APP_SECRET;
  if (!s) throw new Error("APP_SECRET manquant");
  return s;
}

export async function loadGame(code: string) {
  const { data, error } = await db().rpc("store_get", { p_secret: secret(), p_code: code });
  if (error) throw new Error(error.message);
  return data as { state: GameState; version: number } | null;
}

export async function createGame(state: GameState) {
  const { data, error } = await db().rpc("store_create", {
    p_secret: secret(),
    p_code: state.code,
    p_state: state,
  });
  if (error) throw new Error(error.message);
  return data as boolean;
}

/**
 * Applique une modification à une partie.
 * Si deux joueurs jouent en même temps, on recommence (verrou optimiste).
 */
export async function mutate(code: string, fn: (s: GameState) => void) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const row = await loadGame(code);
    if (!row) throw new RuleError("Partie introuvable");
    const state = row.state;
    fn(state);
    const { data, error } = await db().rpc("store_put", {
      p_secret: secret(),
      p_code: code,
      p_state: state,
      p_version: row.version,
    });
    if (error) throw new Error(error.message);
    if (data) return state;
  }
  throw new RuleError("Trop de monde joue en même temps, réessaie");
}
