"use client";
// Commandes de jeu : barre d'enchère (façon maquette) et salle d'attente.
import { useContent } from "@/lib/content-client";
import type { PlayerView } from "@/lib/rules";

// ---------- salle d'attente ----------
export function Lobby({ view, isHost, busy, copied, onShare, act }: {
  view: PlayerView; isHost: boolean; busy: boolean; copied: boolean; onShare: () => void; act: (b: Record<string, unknown>) => void;
}) {
  const MAPS = useContent().maps.filter((m) => m.random !== false);
  const bots = view.players.filter((p) => p.isBot);
  const full = view.players.length >= 8;
  return (
    <div className="panel lobby-panel">
      <div className="row-wrap">
        <button className="gbtn gbtn-purple gbtn-sm" onClick={onShare}>{copied ? "Lien copié !" : `🔗 Inviter (code ${view.code})`}</button>
        {isHost && <button className="gbtn gbtn-dark gbtn-sm" disabled={busy || full} onClick={() => act({ type: "addBot" })}>🤖 + Ajouter un bot</button>}
      </div>
      {isHost && bots.length > 0 && (
        <div className="bot-chips">
          {bots.map((b) => <button key={b.id} className="bot-chip" disabled={busy} onClick={() => act({ type: "removeBot", botId: b.id })} title="Retirer ce bot">{b.name} ✕</button>)}
        </div>
      )}
      <p className="lobby-map">🎲 L&apos;univers de la partie sera tiré au sort au lancement — {MAPS.length} map{MAPS.length > 1 ? "s" : ""} en jeu : {MAPS.map((m) => m.icon).join(" ")}</p>
      {isHost ? (
        <button className="gbtn gbtn-gold gbtn-xl" disabled={busy || view.players.length < 2} onClick={() => act({ type: "start" })}>
          {view.players.length < 2 ? "Ajoute un pote ou un bot…" : "▶ Lancer la partie"}
        </button>
      ) : (
        <p className="waiting">L&apos;hôte va lancer la partie…</p>
      )}
    </div>
  );
}

