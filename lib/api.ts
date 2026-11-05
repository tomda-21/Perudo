import "server-only";
import { NextResponse } from "next/server";
import { GameState, RuleError } from "./rules";
import type { PublicContent } from "./content";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export function handle(e: unknown) {
  if (e instanceof RuleError) return json({ error: e.message }, 400);
  console.error(e);
  return json({ error: "Erreur serveur, réessaie" }, 500);
}

export function playerFromToken(s: GameState, token: string | null) {
  if (!token) return null;
  return s.players.find((p) => p.token === token) ?? null;
}

export const cleanCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

/** Maps activées : publiées dans l'admin ET cochées « active dans le tirage ». Personne ne choisit : le serveur tire au sort. */
export const mapPool = (c: PublicContent) => c.maps.filter((m) => m.random !== false).map((m) => m.id);
