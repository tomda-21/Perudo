// =============================================================
//  La table de Perudo : tapis ovale intégré au décor, joueurs
//  installés autour, gobelets, annonces, révélation, effets drôles.
//  Purement visuel : toutes les décisions sont prises par le serveur.
// =============================================================
import Die from "./Die";
import Cup from "./Cup";
import Avatar from "./Avatar";
import type { PlayerView, PublicPlayer } from "@/lib/rules";
import { useContent } from "@/lib/content-client";

export type SeatFx = { kind: "sound" | "phrase" | "reaction"; id: string; key: number };

type Props = {
  view: PlayerView;
  myId: string | null;
  present: Set<string> | null; // joueurs connectés (null = inconnu)
  shaking: boolean;
  peek: boolean; // mon gobelet est soulevé
  fx: Record<string, SeatFx>;
  onCupClick?: () => void;
};

/** Place les joueurs sur une ellipse, le joueur local en bas. */
export function seatPositions(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = ((90 + (i * 360) / n) * Math.PI) / 180;
    return { left: 50 + 41.5 * Math.cos(a), top: 50 + 42 * Math.sin(a) };
  });
}

const FX_EMOJI: Record<string, string[]> = {
  shake: ["💨", "💨", "💨"], tomatoes: ["🍅", "🍅", "🍅", "🍅", "🍅"], clap: ["👏", "👏", "👏"],
  laugh: ["😂", "🤣", "😂", "🤣"], pop: ["😱", "❗"], sad: ["😭", "💧", "💧"],
};

export default function Table({ view, myId, present, shaking, peek, fx, onCupClick }: Props) {
  const { sounds: SOUNDS, phrases: PHRASES, reactions: REACTIONS, frames: FRAMES } = useContent();
  const seats = [...view.players].sort((a, b) => a.seat - b.seat);
  const meIdx = Math.max(0, seats.findIndex((p) => p.id === myId));
  const ordered = [...seats.slice(meIdx), ...seats.slice(0, meIdx)];
  const pos = seatPositions(ordered.length);
  const r = view.reveal;
  const showReveal = (view.phase === "reveal" || view.phase === "finished") && !!r;
  const lastBidderId = view.phase === "bidding" ? view.bidderId : null;
  const counts = (d: number) => !!r && (d === r.bid.face || (!r.palifico && r.bid.face !== 1 && d === 1));
  const me = view.players.find((p) => p.id === myId);

  return (
    <div className={`table-wrap n${ordered.length}`}>
      <div className="table-shadow" />
      <div className="table-rail">
        <div className="table-felt">
          <Center view={view} />
          {view.phase === "bidding" && me && me.diceCount > 0 && (
            <div className="center-cup">
              <Cup size="lg" skin={me.cup ?? "classic"} state={shaking ? "shake" : peek ? "lifted" : "down"}
                onClick={shaking ? undefined : onCupClick} label={peek ? "Reposer le gobelet" : "Soulever mon gobelet"} />
            </div>
          )}
        </div>
      </div>

      {ordered.map((p, i) => {
        const out = view.phase !== "lobby" && p.diceCount === 0 && !(showReveal && r!.hands[p.id]);
        const active = view.phase === "bidding" && view.turnId === p.id;
        const offline = !p.isBot && !p.left && present !== null && !present.has(p.id);
        const lastBid = [...view.history].reverse().find((h) => h.playerId === p.id);
        const hand = showReveal ? r!.hands[p.id] : undefined;
        const isLoser = showReveal && r!.loserId === p.id;
        const isGainer = showReveal && r!.gainerId === p.id;
        const isWinner = view.phase === "finished" && view.winnerId === p.id;
        const f = fx[p.id];
        const sound = f?.kind === "sound" ? SOUNDS.find((s) => s.id === f.id) : undefined;
        const phrase = f?.kind === "phrase" ? PHRASES.find((s) => s.id === f.id) : undefined;
        const reaction = f?.kind === "reaction" ? REACTIONS.find((s) => s.id === f.id) : undefined;
        const top = pos[i].top < 50;
        return (
          <div
            key={p.id}
            className={[
              "seat", p.id === myId && "seat-me", active && "seat-active", out && "seat-out",
              offline && "seat-offline", isLoser && "seat-loser", isGainer && "seat-gainer",
              isWinner && "seat-winner", top ? "seat-top" : "seat-bottom",
            ].filter(Boolean).join(" ")}
            style={{ left: `${pos[i].left}%`, top: `${pos[i].top}%` }}
          >
            {/* bulle de phrase culte */}
            {phrase && <div key={f!.key} className="speech">{phrase.text}</div>}

            {/* bulle d'annonce */}
            {view.phase === "bidding" && lastBid && !phrase && (
              <div key={`${view.round}-${view.history.length}`} className={`bid-bubble ${p.id === lastBidderId ? "bid-bubble-last" : ""}`}>
                {lastBid.bid.qty} × <Die value={lastBid.bid.face} size="xs" />
              </div>
            )}

            <div className={`seat-portrait ${sound ? `fx-${sound.anim}` : ""} ${p.frame ? `frame frame-${FRAMES.find((x) => x.id === p.frame)?.style ?? p.frame}` : ""}`} key={sound ? `s${f!.key}` : "idle"}>
              <Avatar name={p.name} avatar={p.avatar} />
              {reaction && <span key={f!.key} className="reaction-pop" aria-label={reaction.label}>{reaction.emoji}</span>}
              {p.isHost && <span className="seat-crown" title="Hôte">♛</span>}
              {p.isBot && <span className="seat-bot">BOT</span>}
              {isLoser && <span className="float-delta float-minus">−1</span>}
              {isGainer && <span className="float-delta float-plus">+1</span>}
              {showReveal && r!.eliminatedId === p.id && <span className="seat-skull">💀</span>}
              {sound && (
                <span className="fx-emojis" key={f!.key}>
                  {FX_EMOJI[sound.anim].map((e, k) => <span key={k} style={{ ["--k" as string]: k }}>{e}</span>)}
                </span>
              )}
            </div>

            <div className="seat-plate">
              <div className="seat-name">
                {!p.isBot && !p.left && <span className={`dot ${offline ? "dot-off" : ""}`} />}
                {p.name}
                {p.level ? <span className="seat-level" title="Niveau">{p.level}</span> : null}
              </div>
              {p.title && <div className="seat-title">{p.title}</div>}
              {view.phase !== "lobby" && !out && !hand && <div className="seat-dice-count">🎲 {p.diceCount} dé{p.diceCount > 1 ? "s" : ""}</div>}
              <SeatStatus p={p} view={view} active={active} out={out} offline={offline} isMe={p.id === myId} />
            </div>

            {/* gobelet ou dés révélés */}
            {view.phase !== "lobby" && !out && (
              <div className="seat-cup-zone">
                {hand ? (
                  <div className="seat-dice revealed">
                    {hand.map((d, k) => <Die key={k} value={d} size="xs" highlight={counts(d)} dim={!counts(d)} />)}
                  </div>
                ) : p.id !== myId ? (
                  <Cup size="sm" skin={p.cup ?? "classic"} state={shaking ? "shake" : "down"} key={`${view.round}-${shaking}`} />
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SeatStatus({ p, view, active, out, offline, isMe }: {
  p: PublicPlayer; view: PlayerView; active: boolean; out: boolean; offline: boolean; isMe: boolean;
}) {
  if (p.left) return <div className="seat-status status-out">a quitté</div>;
  if (view.phase === "lobby") return null;
  if (out) return <div className="seat-status status-out">spectateur</div>;
  if (active) return <div className="seat-status status-active">{isMe ? "à toi !" : p.isBot ? "réfléchit…" : "joue…"}</div>;
  if (offline) return <div className="seat-status status-offline">déconnecté</div>;
  return null;
}

function Center({ view }: { view: PlayerView }) {
  const name = (id: string | null) => view.players.find((p) => p.id === id)?.name ?? "?";
  const r = view.reveal;

  if (view.phase === "lobby")
    return (
      <div className="center-box">
        <div className="bid-plaque">
          <div className="plaque-label">Salle d&apos;attente</div>
          <div className="plaque-code">{view.code}</div>
        </div>
        <div className="center-sub">{view.players.length}/8 joueurs</div>
      </div>
    );

  if ((view.phase === "reveal" || view.phase === "finished") && r) {
    const verdict =
      r.call === "liar"
        ? r.loserId === r.callerId ? `${name(r.callerId)} perd un dé` : `${name(r.bidderId)} perd un dé`
        : r.gainerId ? `${name(r.callerId)} gagne un dé !` : `${name(r.callerId)} perd un dé`;
    return (
      <div className="center-box" key={`rev-${view.round}`}>
        <div className={`stamp ${r.call === "exact" ? "stamp-exact" : ""}`}>{r.call === "liar" ? "MENTEUR !" : "EXACT !"}</div>
        <div className="center-sub">{name(r.callerId)} sur {r.bid.qty} × <Die value={r.bid.face} size="xs" /></div>
        <div className="center-count">Il y en avait <b>{r.count}</b></div>
        <div className={`center-verdict ${r.gainerId ? "good" : ""}`}>{verdict}</div>
      </div>
    );
  }

  return (
    <div className="center-box">
      {view.palifico && <div className="badge-palifico">PALIFICO · pax non jokers</div>}
      <div className="bid-plaque" key={`${view.round}-${view.history.length}`}>
        <div className="plaque-label">{view.bid ? "Enchère actuelle" : "Nouvelle manche"}</div>
        {view.bid ? (
          <div className="plaque-bid">
            {view.bid.qty} dé{view.bid.qty > 1 ? "s" : ""} de <Die value={view.bid.face} size="sm" />
          </div>
        ) : (
          <div className="plaque-bid small">{name(view.turnId)} ouvre</div>
        )}
        {view.bid && <div className="plaque-by">par {name(view.bidderId)}</div>}
      </div>
      <div className="center-sub dim">{view.totalDice} dés en jeu</div>
    </div>
  );
}
