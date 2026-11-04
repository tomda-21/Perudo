"use client";
// Commandes de jeu : barre d'enchère (façon maquette) et salle d'attente.
import { useEffect, useMemo, useState } from "react";
import Die from "./Die";
import { checkBid } from "@/lib/bids";
import { useContent } from "@/lib/content-client";
import type { PlayerView } from "@/lib/rules";

// ---------- barre de commandes ----------
export function ControlBar({ view, myTurn, imOut, busy, act, peek, onPeek, shaking, waitingFor }: {
  view: PlayerView; myTurn: boolean; imOut: boolean; busy: boolean; act: (b: Record<string, unknown>) => void;
  peek: boolean; onPeek: () => void; shaking: boolean; waitingFor: string;
}) {
  const [qty, setQty] = useState(1);
  const [face, setFace] = useState(2);

  // propose automatiquement la plus petite annonce valable (seulement quand l'annonce change)
  const bidKey = `${view.round}-${view.bid?.qty ?? 0}-${view.bid?.face ?? 0}`;
  useEffect(() => {
    if (!view.bid) { setQty(1); setFace(2); return; }
    const f = view.bid.face;
    if (checkBid(view.bid, { qty: view.bid.qty, face: f + 1 }, view.palifico, view.totalDice) === null) {
      setQty(view.bid.qty); setFace(f + 1);
    } else {
      setQty(Math.min(view.bid.qty + 1, view.totalDice)); setFace(f === 1 && !view.palifico ? 1 : f);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bidKey]);

  const err = useMemo(() => checkBid(view.bid, { qty, face }, view.palifico, view.totalDice), [view.bid, qty, face, view.palifico, view.totalDice]);

  if (imOut) return <div className="control-bar center-bar"><p className="waiting">Tu es spectateur : tu peux encore envoyer des sons et des phrases 😈</p></div>;

  return (
    <div className={`control-bar ${myTurn ? "active" : ""}`}>
      {myTurn && <div className="turn-banner">À toi de jouer !</div>}
      <button className="gbtn gbtn-dark see-btn" onClick={onPeek} disabled={shaking}>👁 {peek ? "Cacher" : "Voir mes dés"}</button>

      {myTurn ? (
        <>
          <div className="bid-picker">
            <div className="stepper">
              <button className="step" aria-label="Moins" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
              <span className="step-val">{qty}</span>
              <button className="step" aria-label="Plus" onClick={() => setQty((q) => Math.min(view.totalDice, q + 1))}>+</button>
            </div>
            <span className="bid-of">dé{qty > 1 ? "s" : ""} de</span>
            <div className="stepper">
              <button className="step" aria-label="Valeur précédente" onClick={() => setFace((f) => (f === 1 ? 6 : f - 1))}>−</button>
              <span className="step-val"><Die value={face} size="sm" />{face === 1 && <em>pax</em>}</span>
              <button className="step" aria-label="Valeur suivante" onClick={() => setFace((f) => (f === 6 ? 1 : f + 1))}>+</button>
            </div>
          </div>
          <div className="bid-actions">
            <button className="gbtn gbtn-green" disabled={busy || !!err} onClick={() => act({ type: "bid", qty, face })} title={err ?? ""}>▶ Enchérir</button>
            {view.bid && <button className="gbtn gbtn-red" disabled={busy} onClick={() => act({ type: "liar" })}>⚡ Menteur !</button>}
            {view.bid && view.config?.exactEnabled !== false && <button className="gbtn gbtn-gold" disabled={busy} onClick={() => act({ type: "exact" })}>🎯 Exact !</button>}
          </div>
          {err && <p className="hint bar-hint">{err}</p>}
        </>
      ) : (
        <p className="waiting">{shaking ? "Les gobelets se secouent…" : <>C&apos;est à <b>{waitingFor}</b> de jouer…</>}</p>
      )}
    </div>
  );
}

// ---------- salle d'attente ----------
export function Lobby({ view, isHost, busy, copied, onShare, act }: {
  view: PlayerView; isHost: boolean; busy: boolean; copied: boolean; onShare: () => void; act: (b: Record<string, unknown>) => void;
}) {
  const { maps: MAPS } = useContent();
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
      <div className="map-picker">
        <span className="muted small">Map :</span>
        {MAPS.map((m) => (
          <button key={m.id} disabled={!isHost || busy} className={`map-chip ${view.map === m.id ? "on" : ""}`} onClick={() => act({ type: "setMap", map: m.id })}>
            {m.icon} {m.name}
          </button>
        ))}
        {isHost && <button className="map-chip" disabled={busy} onClick={() => act({ type: "setMap", map: "random" })}>🎲 Au hasard</button>}
      </div>
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

