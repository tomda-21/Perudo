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

/** Maps proposées (publiées par l'admin) et celles autorisées pour le tirage au hasard. */
export const mapPool = (c: PublicContent) => ({
  all: c.maps.map((m) => m.id),
  random: c.maps.filter((m) => m.random).map((m) => m.id),
});
