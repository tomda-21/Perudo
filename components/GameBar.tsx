"use client";
// =============================================================
//  Commandes d'enchère : quantité (− / +), six faces de dés cliquables,
//  Enchérir · Dudo ! · Exact !, et « Voir mes dés ».
//  Les règles viennent de lib/bids (les mêmes que celles du serveur) :
//  l'interface ne fait que proposer, le serveur valide.
// =============================================================
import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { PlayerView } from "@/lib/rules";
import { checkBid, minQtyFor } from "@/lib/bids";
import { sounds } from "@/lib/sound";
import { DieImg, G } from "./GameStage";

export function useBidPicker(view: PlayerView) {
  const [qty, setQty] = useState(1);
  const [face, setFace] = useState(2);
  const minFor = (f: number) => {
    const m = minQtyFor(view.bid, f, view.palifico);
    return m !== null && m <= view.totalDice ? Math.max(1, m) : null;
  };
  // à chaque nouvelle annonce : proposer la plus petite annonce valable (même valeur si possible)
  const bidKey = `${view.round}-${view.bid?.qty ?? 0}-${view.bid?.face ?? 0}`;
  useEffect(() => {
    if (!view.bid) { setQty(1); setFace(2); return; }
    const f = view.bid.face;
    const same = minFor(f);
    const up = f < 6 ? minFor(f + 1) : null;
    if (up !== null && up === view.bid.qty) { setFace(f + 1); setQty(up); }
    else if (same !== null) { setFace(f); setQty(same); }
    else { const g = [2, 3, 4, 5, 6, 1].find((x) => minFor(x) !== null) ?? 2; setFace(g); setQty(minFor(g) ?? 1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bidKey]);

  const err = useMemo(() => checkBid(view.bid, { qty, face }, view.palifico, view.totalDice), [view.bid, qty, face, view.palifico, view.totalDice]);
  const pickFace = (f: number) => {
    const m = minFor(f);
    if (m === null) return;
    sounds.tick();
    // passer de/vers les pax change d'échelle : on repart du minimum légal ; sinon on ne monte que si c'est insuffisant
    const switching = (f === 1) !== (face === 1) && !view.palifico;
    setFace(f);
    setQty((q) => (switching || q < m ? m : Math.min(q, view.totalDice)));
  };
  const minQ = minFor(face) ?? 1;
  const dec = () => { if (qty > minQ) { sounds.tick(); setQty(qty - 1); } };
  const inc = () => { if (qty < view.totalDice) { sounds.tick(); setQty(qty + 1); } };
  return { qty, face, err, pickFace, minFor, dec, inc, canDec: qty > minQ, canInc: qty < view.totalDice };
}

type BarProps = {
  view: PlayerView; myTurn: boolean; busy: boolean; act: (b: Record<string, unknown>) => void;
  peek: boolean; onPeek: () => void; shaking: boolean; waitingFor: string; imOut: boolean;
};

// positions dans la scène ordinateur (pixels de la maquette)
const TILE_X = [804, 917, 1030, 1143, 1255, 1368];
const abs = (x: number, y: number, w?: number, h?: number): CSSProperties => ({ left: x, top: y, width: w, height: h });

/** Barre de commandes intégrée à la scène (ordinateur). */
export function DesktopBar(props: BarProps) {
  const { view, myTurn, busy, act, peek, onPeek, shaking, waitingFor, imOut } = props;
  const p = useBidPicker(view);
  const live = myTurn && !busy;
  const exactOn = view.config?.exactEnabled !== false;
  // Exact : même hors de son tour, tant que l'annonce suivante n'est pas faite (le serveur tranche)
  const exactLive = !busy && !shaking && !!view.canExact;
  const exact = () => act({ type: "exact", expect: view.history.length });
  return (
    <div className={`gbar ${myTurn ? "my" : "wait"}`}>
      <img className="gbar-bg" src={`${G}bar.webp`} alt="" draggable={false} style={abs(122, 641, 1490, 321)} />
      <div className="gbar-ribbon" style={abs(1190, 626)}>
        {imOut ? "Tu es spectateur : tu peux encore faire du bruit 😈" : shaking ? "Les gobelets se secouent…" : myTurn ? "À toi de jouer !" : <>C&apos;est à <b>{waitingFor}</b> de jouer…</>}
      </div>

      <button className="gimg-btn" style={abs(128, 694, 240, 84)} onClick={onPeek} disabled={shaking || imOut}>
        <img src={`${G}peek.webp`} alt="" draggable={false} />
        <span className="glbl peek">{peek ? "Cacher" : "Voir mes dés"}</span>
      </button>

      <span className="gbar-title" style={abs(540, 668)}>Quantité de dés</span>
      <span className="gbar-title" style={abs(1085, 668)}>Valeur du dé</span>

      <img className="gimg" src={`${G}qtybox.webp`} alt="" draggable={false} style={abs(379, 686, 322, 112)} />
      <button className="gimg-btn small" style={abs(393, 694, 85, 85)} onClick={p.dec} disabled={!live || !p.canDec} aria-label="Moins">
        <img src={`${G}minus.webp`} alt="" draggable={false} />
      </button>
      <span className="gbar-qty" style={abs(540, 742)}>{p.qty}</span>
      <button className="gimg-btn small" style={abs(601, 694, 87, 85)} onClick={p.inc} disabled={!live || !p.canInc} aria-label="Plus">
        <img src={`${G}plus.webp`} alt="" draggable={false} />
      </button>

      {TILE_X.map((x, i) => {
        const f = i + 1;
        const ok = p.minFor(f) !== null;
        return (
          <button key={f} className={`gface ${p.face === f ? "on" : ""}`} style={abs(x - 50, 681, 100, 100)}
            onClick={() => p.pickFace(f)} disabled={!live || !ok} aria-pressed={p.face === f} aria-label={f === 1 ? "Pax" : `Face ${f}`}>
            <DieImg value={f} size={76} />
            {f === 1 && <span className="gface-pax">Pax</span>}
          </button>
        );
      })}

      <button className="gimg-btn act" style={abs(292, 809, 381, 103)} disabled={!live || !!p.err}
        onClick={() => act({ type: "bid", qty: p.qty, face: p.face })} title={p.err ?? ""}>
        <img src={`${G}bid.webp`} alt="" draggable={false} />
        <span className="glbl act">Enchérir</span>
      </button>
      <button className="gimg-btn act" style={abs(690, 809, 378, 103)} disabled={!live || !view.bid} onClick={() => act({ type: "liar" })}>
        <img src={`${G}dudo.webp`} alt="" draggable={false} />
        <span className="glbl act">Dudo !</span>
      </button>
      {exactOn && (
        <button className="gimg-btn act" style={abs(1086, 809, 386, 103)} disabled={!exactLive} onClick={exact}>
          <img src={`${G}exact.webp`} alt="" draggable={false} />
          <span className="glbl act">Exact !</span>
        </button>
      )}
      {myTurn && p.err && <span className="gbar-err" style={abs(784, 952)}>{p.err}</span>}
    </div>
  );
}

/** Commandes pour téléphone : mêmes boutons, réorganisés pour le pouce. */
export function MobileBar(props: BarProps) {
  const { view, myTurn, busy, act, peek, onPeek, shaking, waitingFor, imOut } = props;
  const p = useBidPicker(view);
  const live = myTurn && !busy;
  const exactOn = view.config?.exactEnabled !== false;
  // Exact : même hors de son tour, tant que l'annonce suivante n'est pas faite (le serveur tranche)
  const exactLive = !busy && !shaking && !!view.canExact;
  const exact = () => act({ type: "exact", expect: view.history.length });
  return (
    <div className={`mbar ${myTurn ? "my" : "wait"}`}>
      <div className="mbar-ribbon">
        {imOut ? "Tu es spectateur 😈" : shaking ? "Les gobelets se secouent…" : myTurn ? "À toi de jouer !" : <>C&apos;est à <b>{waitingFor}</b>…</>}
      </div>
      <div className="mbar-row">
        <button className="mimg peek" onClick={onPeek} disabled={shaking || imOut}><span>{peek ? "Cacher" : "Voir mes dés"}</span></button>
        <div className="mqty">
          <span className="mlbl">Quantité</span>
          <div className="mqty-box">
            <button className="mstep" onClick={p.dec} disabled={!live || !p.canDec} aria-label="Moins"><img src={`${G}minus.webp`} alt="" /></button>
            <b>{p.qty}</b>
            <button className="mstep" onClick={p.inc} disabled={!live || !p.canInc} aria-label="Plus"><img src={`${G}plus.webp`} alt="" /></button>
          </div>
        </div>
      </div>
      <div className="mfaces" role="group" aria-label="Valeur du dé">
        {[1, 2, 3, 4, 5, 6].map((f) => (
          <button key={f} className={`mface ${p.face === f ? "on" : ""}`} onClick={() => p.pickFace(f)} disabled={!live || p.minFor(f) === null}
            aria-pressed={p.face === f} aria-label={f === 1 ? "Pax" : `Face ${f}`}>
            <DieImg value={f} size={40} />
            {f === 1 && <span className="mface-pax">Pax</span>}
          </button>
        ))}
      </div>
      <div className="mactions">
        <button className="mact bid" disabled={!live || !!p.err} onClick={() => act({ type: "bid", qty: p.qty, face: p.face })}><span>Enchérir</span></button>
        <button className="mact dudo" disabled={!live || !view.bid} onClick={() => act({ type: "liar" })}><span>Dudo !</span></button>
        {exactOn && <button className="mact exact" disabled={!exactLive} onClick={exact}><span>Exact !</span></button>}
      </div>
      {myTurn && p.err && <p className="mbar-err">{p.err}</p>}
    </div>
  );
}

/**
 * Interface V2 : barre de commandes compacte, la même sur téléphone (paysage) et ordinateur.
 * Mes dés (zone privée, masquables) · − quantité + · six faces · Enchérir / Dudo ! / Exact !
 */
export function Bar2(props: BarProps & { remain?: React.ReactNode }) {
  const { view, myTurn, busy, act, peek, onPeek, shaking, waitingFor, imOut, remain } = props;
  const p = useBidPicker(view);
  const live = myTurn && !busy;
  const exactOn = view.config?.exactEnabled !== false;
  const exactLive = !busy && !shaking && !!view.canExact; // hors de son tour aussi (le serveur tranche)
  return (
    <div className={`bar2 ${myTurn ? "my" : "wait"} ${imOut ? "out" : ""}`}>
      <div className="bar2-status" aria-live="polite">
        {imOut ? "Tu es spectateur 😈" : shaking ? "Les gobelets se secouent…" : myTurn ? <>À toi de jouer ! {remain}</> : <>C&apos;est à <b>{waitingFor}</b> {remain}</>}
        {myTurn && p.err && !shaking && <span className="bar2-err"> · {p.err}</span>}
      </div>
      <div className="bar2-row">
        {!imOut && (
          // mes dés s'affichent sur ma plaque (dans mon gobelet) ; ici, seulement les montrer / cacher
          <button className={`bar2-mine ${peek ? "open" : ""}`} onClick={onPeek} disabled={shaking}
            aria-label={peek ? "Masquer mes dés" : "Voir mes dés"} title={peek ? "Masquer mes dés" : "Voir mes dés"}>
            <span className="bar2-eye">{peek ? "🙈" : "👁"}</span>
            <span className="bar2-lbl">{peek ? "Cacher mes dés" : "Voir mes dés"}</span>
          </button>
        )}
        <div className="bar2-qty" role="group" aria-label="Quantité">
          <button onClick={p.dec} disabled={!live || !p.canDec} aria-label="Moins"><img src={`${G}minus.webp`} alt="" /></button>
          <b>{p.qty}</b>
          <button onClick={p.inc} disabled={!live || !p.canInc} aria-label="Plus"><img src={`${G}plus.webp`} alt="" /></button>
        </div>
        <div className="bar2-faces" role="group" aria-label="Valeur du dé">
          {[1, 2, 3, 4, 5, 6].map((f) => (
            <button key={f} className={`bar2-face ${p.face === f ? "on" : ""}`} onClick={() => p.pickFace(f)} disabled={!live || p.minFor(f) === null}
              aria-pressed={p.face === f} aria-label={f === 1 ? "Pax" : `Face ${f}`}>
              <DieImg value={f} size={44} />
              {f === 1 && <span className="bar2-pax">Pax</span>}
            </button>
          ))}
        </div>
        <div className="bar2-acts">
          <button className="bar2-act bid" disabled={!live || !!p.err} onClick={() => act({ type: "bid", qty: p.qty, face: p.face })}><span>Enchérir</span></button>
          <button className="bar2-act dudo" disabled={!live || !view.bid} onClick={() => act({ type: "liar" })}><span>Dudo !</span></button>
          {exactOn && <button className="bar2-act exact" disabled={!exactLive} onClick={() => act({ type: "exact", expect: view.history.length })}><span>Exact !</span></button>}
        </div>
      </div>
    </div>
  );
}
