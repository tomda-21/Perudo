"use client";
// =============================================================
//  PARTIE — scène de jeu : décor de la map, table, joueurs, enchère,
//  gobelets et effets. Purement visuel : le serveur décide de tout.
//
//  Ordinateur : une scène 1734 × 962 (dimensions de la maquette de Tom)
//  mise à l'échelle de l'écran ; la barre de commandes y est intégrée.
//  Téléphone : même univers, table + joueurs en haut, commandes en bas.
// =============================================================
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Avatar from "./Avatar";
import Cup from "./Cup";
import type { PlayerView, PublicPlayer } from "@/lib/rules";
import { useContent } from "@/lib/content-client";
import { assetUrl } from "@/lib/content";
import { gameBg, gameTable } from "@/lib/catalog";

export type SeatFx = { kind: "sound" | "phrase" | "reaction"; id: string; key: number };
export const G = "/art/game/";

// lumières d'ambiance (lanternes, soleil, néons) posées sur les décors intégrés
const GLOWS: Record<string, [number, number, number][]> = {
  beach: [[465, 38, 46], [205, 135, 52], [382, 78, 50], [1290, 48, 52], [1462, 112, 46], [1508, 122, 40], [1668, 136, 46], [678, 132, 120], [40, 230, 50]],
  casino: [[176, 279, 70], [41, 349, 60], [1230, 411, 80], [1450, 167, 70], [1395, 482, 60], [1700, 525, 70]],
  hell: [[200, 120, 120], [1500, 140, 120], [860, 60, 140]],
  street: [[260, 130, 70], [1460, 120, 70], [1120, 70, 60]],
  heaven: [[860, 40, 200]],
};

// ---------- géométrie ----------
export type Geo = {
  W: number; H: number; cx: number; cy: number; rx: number; ry: number;
  me: { x: number; y: number }; av: number; plaque: { x: number; y: number; s: number }; cup: { x: number; y: number; s: number };
};
export const DESKTOP: Geo = { W: 1734, H: 962, cx: 784, cy: 370, rx: 560, ry: 255, me: { x: 647, y: 572 }, av: 146, plaque: { x: 833, y: 318, s: 1 }, cup: { x: 798, y: 447, s: 1 } };
export const MOBILE: Geo = { W: 800, H: 860, cx: 400, cy: 420, rx: 300, ry: 300, me: { x: 300, y: 712 }, av: 124, plaque: { x: 400, y: 402, s: 0.86 }, cup: { x: 400, y: 545, s: 0.8 } };

/** Places autour de la table : le joueur local en bas, les autres sur l'arc du haut. */
export function seatPoints(n: number, g: Geo) {
  const k = Math.max(0, n - 1);
  const pts = [g.me];
  for (let i = 0; i < k; i++) {
    const deg = k === 1 ? 270 : 186 + (168 * i) / (k - 1);
    const a = (deg * Math.PI) / 180;
    pts.push({ x: g.cx + g.rx * Math.cos(a), y: g.cy + g.ry * Math.sin(a) });
  }
  return pts;
}

export function useLayout() {
  const [v, setV] = useState({ mobile: false, s: 0.6, w: 1280, h: 720 });
  useEffect(() => {
    const f = () => {
      const w = window.innerWidth, h = window.innerHeight;
      const mobile = w < 760 || w / h < 1.05;
      const s = mobile ? Math.min(w / MOBILE.W, (h - 62 - 300) / MOBILE.H) : Math.min(h / DESKTOP.H, w / 1520);
      setV({ mobile, s, w, h });
    };
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return v;
}

/** Un vrai dé illustré (faces 1 à 6, issues de la maquette). */
export function DieImg({ value, size = 64, dim, hl, className = "" }: { value: number; size?: number; dim?: boolean; hl?: boolean; className?: string }) {
  return (
    <img src={`${G}die${value}.webp`} alt={value === 1 ? "pax" : `${value}`} draggable={false} width={size} height={size}
      className={`die-img ${dim ? "dim" : ""} ${hl ? "hl" : ""} ${className}`} style={{ width: size, height: size }} />
  );
}

const FX_EMOJI: Record<string, string[]> = {
  shake: ["💨", "💨", "💨"], tomatoes: ["🍅", "🍅", "🍅", "🍅", "🍅"], clap: ["👏", "👏", "👏"],
  laugh: ["😂", "🤣", "😂", "🤣"], pop: ["😱", "❗"], sad: ["😭", "💧", "💧"],
};

type StageProps = {
  view: PlayerView; myId: string; geo: Geo; present: Set<string> | null; shaking: boolean; peek: boolean;
  fx: Record<string, SeatFx>; onCupClick: () => void; children?: ReactNode; withBackground: boolean;
};

/** Décor + table + joueurs, dans les coordonnées de la scène. */
export function Stage({ view, myId, geo, present, shaking, peek, fx, onCupClick, children, withBackground }: StageProps) {
  const { maps, sounds: SOUNDS, phrases: PHRASES, reactions: REACTIONS, frames: FRAMES } = useContent();
  const map = maps.find((m) => m.id === view.map);
  const scene = map?.scene ?? view.map ?? "casino";
  const custom = map?.image ? assetUrl(map.image) : null;
  const seats = [...view.players].sort((a, b) => a.seat - b.seat);
  const meIdx = Math.max(0, seats.findIndex((p) => p.id === myId));
  const ordered = [...seats.slice(meIdx), ...seats.slice(0, meIdx)];
  const pts = seatPoints(ordered.length, geo);
  const r = view.reveal;
  const showReveal = (view.phase === "reveal" || view.phase === "finished") && !!r;
  const counts = (d: number) => !!r && (d === r.bid.face || (!r.palifico && r.bid.face !== 1 && d === 1));
  const desktop = geo === DESKTOP;
  const bidKey = `${view.round}-${view.history.length}`;

  return (
    <>
      {withBackground && (desktop && !custom
        ? <img className="st-bg" src={gameBg(scene)} alt="" draggable={false} />
        : <>
            {custom && desktop && <img className="st-bg" src={custom} alt="" draggable={false} />}
            <img className={desktop ? "st-table-d" : "st-table-m"} src={gameTable(scene)} alt="" draggable={false} />
          </>)}

      {withBackground && !custom && (GLOWS[scene] ?? []).map(([x, y, r], i) => (
        <span key={i} className="fx-glow" style={{ left: x - r, top: y - r, width: r * 2, height: r * 2, animationDelay: `${i * 0.6}s` }} />
      ))}
      {withBackground && scene === "beach" && <span className="st-sea" style={{ left: 560, top: 165, width: 420, height: 60 }} />}

      {/* gobelet central : se secoue au début de la manche, sursaute à chaque annonce, se soulève à la révélation */}
      <div className="st-cup" style={{ left: geo.cup.x, top: geo.cup.y, ["--k" as string]: geo.cup.s }}>
        <img key={shaking ? "shake" : showReveal ? "lift" : bidKey}
          className={`st-cup-img ${shaking ? "shake" : showReveal ? "lift" : view.history.length ? "hop" : ""}`}
          src={`${G}cup.webp`} alt="" draggable={false} />
        {showReveal && <span className="st-cup-rays" />}
      </div>

      <Center view={view} geo={geo} />

      {ordered.map((p, i) => {
        const pt = pts[i];
        const isMe = p.id === myId;
        const out = view.phase !== "lobby" && p.diceCount === 0 && !(showReveal && r!.hands[p.id]);
        const active = view.phase === "bidding" && view.turnId === p.id;
        const offline = !p.isBot && !p.left && present !== null && !present.has(p.id);
        const hand = showReveal ? r!.hands[p.id] : undefined;
        const f = fx[p.id];
        const sound = f?.kind === "sound" ? SOUNDS.find((s) => s.id === f.id) : undefined;
        const phrase = f?.kind === "phrase" ? PHRASES.find((s) => s.id === f.id) : undefined;
        const reaction = f?.kind === "reaction" ? REACTIONS.find((s) => s.id === f.id) : undefined;
        const frame = p.frame ? FRAMES.find((x) => x.id === p.frame)?.style ?? p.frame : null;
        // vers le centre de la table (pour poser le gobelet et les dés révélés)
        const dx = geo.cx - pt.x, dy = geo.cy + 60 - pt.y, len = Math.hypot(dx, dy) || 1;
        const toward = isMe ? { x: -geo.av * 0.9, y: -geo.av * 0.15 } : { x: (dx / len) * geo.av * 1.05, y: (dy / len) * geo.av * 0.95 };
        const lastBid = view.phase === "bidding" ? [...view.history].reverse().find((h) => h.playerId === p.id) : undefined;
        return (
          <div key={p.id}
            className={["st-seat", isMe && "me", active && "active", out && "out", offline && "offline",
              showReveal && r!.loserId === p.id && "loser", showReveal && r!.gainerId === p.id && "gainer",
              view.phase === "finished" && view.winnerId === p.id && "winner"].filter(Boolean).join(" ")}
            style={{ left: pt.x, top: pt.y, ["--av" as string]: `${geo.av}px` } as CSSProperties}>

            {/* gobelet du joueur (son vrai modèle de collection), posé vers la table */}
            {view.phase !== "lobby" && !out && !hand && (
              <div className="st-seat-cup" style={{ transform: `translate(${toward.x}px, ${toward.y}px)` }}>
                <Cup size={isMe ? "md" : "sm"} skin={p.cup ?? "classic"}
                  state={shaking ? "shake" : isMe && peek ? "lifted" : "down"}
                  onClick={isMe && view.phase === "bidding" && !shaking ? onCupClick : undefined}
                  label={isMe ? (peek ? "Reposer mon gobelet" : "Soulever mon gobelet") : undefined}
                  key={`${view.round}-${shaking}`} />
              </div>
            )}
            {hand && isMe && (
              <div className="st-hand" style={{ transform: `translate(${toward.x * 1.15}px, ${toward.y}px)` }}>
                {hand.map((d, k) => <DieImg key={k} value={d} size={desktop ? 44 : 38} hl={counts(d)} dim={!counts(d)} />)}
              </div>
            )}

            <div className={`st-portrait ${sound ? `fx-${sound.anim}` : ""} ${frame ? `frame frame-${frame}` : ""}`} key={sound ? `s${f!.key}` : "idle"}>
              <Avatar name={p.name} avatar={p.avatar} />
              {p.isHost && <span className="st-crown" title="Hôte">♛</span>}
              {p.isBot && <span className="st-bot">BOT</span>}
              {showReveal && r!.loserId === p.id && <span className="float-delta float-minus">−1</span>}
              {showReveal && r!.gainerId === p.id && <span className="float-delta float-plus">+1</span>}
              {showReveal && r!.eliminatedId === p.id && <span className="st-skull">💀</span>}
              {reaction && <span key={f!.key} className="reaction-pop" aria-label={reaction.label}>{reaction.emoji}</span>}
              {sound && <span className="fx-emojis" key={f!.key}>{FX_EMOJI[sound.anim].map((e, k) => <span key={k} style={{ ["--k" as string]: k }}>{e}</span>)}</span>}
            </div>

            {phrase && <div key={f!.key} className="st-speech">{phrase.text}</div>}
            {!phrase && lastBid && (
              <div key={`${view.round}-${view.history.length}`} className={`st-bidbubble ${view.bidderId === p.id ? "last" : ""}`}>
                {lastBid.bid.qty} × <DieImg value={lastBid.bid.face} size={desktop ? 30 : 26} />
              </div>
            )}

            <div className="st-plate">
              <div className="st-name">
                {!p.isBot && !p.left && <span className={`dot ${offline ? "off" : ""}`} />}
                <span className="st-name-txt">{p.name}</span>
                {p.level ? <span className="st-level" title="Niveau">{p.level}</span> : null}
              </div>
              {hand && !isMe ? (
                <div className="st-hand-in">{hand.map((d, k) => <DieImg key={k} value={d} size={desktop ? 34 : 30} hl={counts(d)} dim={!counts(d)} />)}</div>
              ) : view.phase !== "lobby" && (
                <div className="st-dice">
                  {p.left ? "a quitté" : out ? "spectateur" : <><img src={`${G}die5.webp`} alt="" /> {p.diceCount} dé{p.diceCount > 1 ? "s" : ""}</>}
                </div>
              )}
              {active && <div className="st-turn">{isMe ? "à toi !" : p.isBot ? "réfléchit…" : "joue…"}</div>}
              {offline && !active && view.phase !== "lobby" && <div className="st-turn off">déconnecté</div>}
            </div>
          </div>
        );
      })}
      {children}
    </>
  );
}

function bidLabel(qty: number, face: number) {
  return face === 1 ? `${qty} pax` : `${qty} dé${qty > 1 ? "s" : ""} de`;
}

function Center({ view, geo }: { view: PlayerView; geo: Geo }) {
  const name = (id: string | null) => view.players.find((p) => p.id === id)?.name ?? "?";
  const r = view.reveal;
  const revealing = (view.phase === "reveal" || view.phase === "finished") && !!r;
  const style = { left: geo.plaque.x, top: geo.plaque.y + (revealing ? geo.av * 0.3 : 0), ["--k" as string]: geo.plaque.s } as CSSProperties;

  if (view.phase === "lobby")
    return (
      <div className="st-plaque" style={style}>
        <img src={`${G}plaque.webp`} alt="" draggable={false} />
        <div className="st-plaque-in">
          <span className="st-plaque-lbl">Salle d&apos;attente</span>
          <span className="st-plaque-big code">{view.code}</span>
        </div>
      </div>
    );

  if ((view.phase === "reveal" || view.phase === "finished") && r) {
    const verdict = r.call === "liar"
      ? `${name(r.loserId)} perd un dé`
      : r.gainerId ? `${name(r.callerId)} gagne un dé !` : `${name(r.callerId)} perd un dé`;
    return (
      <div className={`st-plaque reveal ${r.call}`} style={style} key={`rev-${view.round}`}>
        <img src={`${G}plaque.webp`} alt="" draggable={false} />
        <div className="st-plaque-in">
          <span className="st-plaque-lbl">{r.call === "liar" ? "Dudo !" : "Exact !"} · {r.bid.qty} × {r.bid.face === 1 ? "pax" : r.bid.face}</span>
          <span className="st-plaque-big">Il y en avait {r.count}</span>
          <span className={`st-verdict ${r.gainerId ? "good" : ""}`}>{verdict}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="st-plaque" style={style} key={`${view.round}-${view.history.length}`}>
      <img src={`${G}plaque.webp`} alt="" draggable={false} />
      <div className="st-plaque-in">
        <span className="st-plaque-lbl">{view.bid ? "Enchère actuelle" : `Manche ${view.round}`}</span>
        {view.bid
          ? <span className="st-plaque-big">{bidLabel(view.bid.qty, view.bid.face)} {view.bid.face !== 1 && <DieImg value={view.bid.face} size={54} />}</span>
          : <span className="st-plaque-big small">{name(view.turnId)} ouvre</span>}
        <span className="st-plaque-by">
          {view.bid ? `par ${name(view.bidderId)} · ` : ""}{view.totalDice} dés en jeu{view.palifico ? " · PALIFICO" : ""}
        </span>
      </div>
    </div>
  );
}

// ---------- effets : Dudo, Exact, découverte de la map ----------
export function CallFx({ kind, success }: { kind: "liar" | "exact"; success: boolean }) {
  const dice = [6, 3, 5, 2, 4, 1];
  return (
    <div className={`callfx callfx-${kind} ${success ? "ok" : ""}`} aria-hidden="true">
      <div className="callfx-flash" />
      <div className="callfx-rays" />
      {kind === "exact" && <div className="callfx-target"><span /><span /><span /></div>}
      <div className="callfx-banner">
        <img src={`${G}${kind === "liar" ? "ban-dudo" : "ban-exact"}.webp`} alt="" />
        <span>{kind === "liar" ? "Dudo !" : "Exact !"}</span>
      </div>
      <div className="callfx-dice">
        {dice.map((d, i) => <DieImg key={i} value={d} size={70} className={`fly f${i}`} />)}
      </div>
    </div>
  );
}

export function MapIntro({ name, icon }: { name: string; icon: string }) {
  return (
    <div className="mapintro" aria-live="polite">
      <div className="mapintro-card">
        <span className="mapintro-lbl">Univers tiré au sort</span>
        <span className="mapintro-name">{icon} {name}</span>
      </div>
    </div>
  );
}

export type { PublicPlayer };
