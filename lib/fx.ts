"use client";
// =============================================================
//  Effets entre joueurs (bruitages + phrases cultes), en temps réel.
//  Ils passent par un canal « diffusion » de Supabase : rapide, et
//  sans toucher à l'état de la partie (purement pour rigoler).
// =============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { realtime } from "./client";
import { getSettings } from "./settings";
import { playSound, speakPhrase } from "./sfx";
import { getContent } from "./content-client";
import type { SeatFx } from "@/components/GameStage";

export type FxKind = "sound" | "phrase" | "reaction";
type Seat = { id: string; fxOwned?: string[] | null; profileId?: string | null };

/** Un effet payant n'est joué que si son auteur le possède (liste fournie par le serveur). */
export function fxAllowed(kind: FxKind, id: string, sender: Seat | undefined) {
  const c = getContent();
  const item = kind === "sound" ? c.sounds.find((s) => s.id === id) : kind === "phrase" ? c.phrases.find((p) => p.id === id) : c.reactions.find((r) => r.id === id);
  if (!item) return false;
  if (!item.price) return true;
  return !!sender?.fxOwned?.includes(`${kind}:${id}`);
}

export function useFx(code: string, myId: string | null, players: Seat[] = []) {
  const seats = useRef(players);
  seats.current = players;
  const [fx, setFx] = useState<Record<string, SeatFx>>({});
  const ch = useRef<RealtimeChannel | null>(null);

  const show = useCallback((from: string, kind: FxKind, id: string) => {
    // on ignore les effets inconnus, trafiqués, ou non possédés par leur auteur
    const c = getContent();
    if (!c.settings.fxEnabled) return;
    if (!fxAllowed(kind, id, seats.current.find((p) => p.id === from))) return;
    // § 66 : aucun délai ni anti-spam ; § 65 : un joueur peut être coupé localement (son seulement, la bulle reste)
    const now = Date.now();
    const sender = seats.current.find((p) => p.id === from);
    const muted = getSettings().mutedPlayers.includes(sender?.profileId ?? from);
    if (!muted) { if (kind === "sound") playSound(id); else if (kind === "phrase") speakPhrase(id); }
    if (!getSettings().bubbles) return;
    const key = now;
    setFx((f) => ({ ...f, [from]: { kind, id, key } }));
    setTimeout(() => setFx((f) => {
      if (f[from]?.key !== key) return f;
      const { [from]: _gone, ...rest } = f;
      return rest;
    }), kind === "phrase" ? 3000 : kind === "reaction" ? 2000 : 2300);
  }, []);

  useEffect(() => {
    if (!myId) return;
    const c = realtime().channel(`fx-${code}`, { config: { broadcast: { self: false } } });
    c.on("broadcast", { event: "fx" }, ({ payload }) => {
      const p = payload as { from?: string; kind?: string; id?: string };
      if (typeof p.from === "string" && (p.kind === "sound" || p.kind === "phrase" || p.kind === "reaction") && typeof p.id === "string") show(p.from, p.kind, p.id);
    }).subscribe();
    ch.current = c;
    return () => { realtime().removeChannel(c); ch.current = null; };
  }, [code, myId, show]);

  const send = useCallback((kind: FxKind, id: string) => {
    if (!myId) return;
    show(myId, kind, id);
    ch.current?.send({ type: "broadcast", event: "fx", payload: { from: myId, kind, id } });
  }, [myId, show]);

  return { fx, send };
}
