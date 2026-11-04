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
import type { SeatFx } from "@/components/Table";

export function useFx(code: string, myId: string | null) {
  const [fx, setFx] = useState<Record<string, SeatFx>>({});
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const ch = useRef<RealtimeChannel | null>(null);
  const lastFrom = useRef<Record<string, number>>({});

  const show = useCallback((from: string, kind: "sound" | "phrase", id: string) => {
    // on ignore les effets inconnus (ou trafiqués)
    const c = getContent();
    if (!c.settings.fxEnabled) return;
    if (kind === "sound" ? !c.sounds.some((s) => s.id === id) : !c.phrases.some((p) => p.id === id)) return;
    const now = Date.now();
    if (now - (lastFrom.current[from] ?? 0) < c.settings.fxCooldownSec * 600) return; // anti-spam côté réception
    lastFrom.current[from] = now;
    if (kind === "sound") playSound(id); else speakPhrase(id);
    if (!getSettings().bubbles) return;
    const key = now;
    setFx((f) => ({ ...f, [from]: { kind, id, key } }));
    setTimeout(() => setFx((f) => {
      if (f[from]?.key !== key) return f;
      const { [from]: _gone, ...rest } = f;
      return rest;
    }), kind === "phrase" ? 3000 : 2300);
  }, []);

  useEffect(() => {
    if (!myId) return;
    const c = realtime().channel(`fx-${code}`, { config: { broadcast: { self: false } } });
    c.on("broadcast", { event: "fx" }, ({ payload }) => {
      const p = payload as { from?: string; kind?: string; id?: string };
      if (typeof p.from === "string" && (p.kind === "sound" || p.kind === "phrase") && typeof p.id === "string") show(p.from, p.kind, p.id);
    }).subscribe();
    ch.current = c;
    return () => { realtime().removeChannel(c); ch.current = null; };
  }, [code, myId, show]);

  const send = useCallback((kind: "sound" | "phrase", id: string) => {
    if (!myId) return;
    const now = Date.now();
    if (now < cooldownUntil) return;
    setCooldownUntil(now + getContent().settings.fxCooldownSec * 1000);
    lastFrom.current[myId] = 0;
    show(myId, kind, id);
    ch.current?.send({ type: "broadcast", event: "fx", payload: { from: myId, kind, id } });
  }, [myId, cooldownUntil, show]);

  return { fx, send, cooldownUntil };
}
