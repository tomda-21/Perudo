// =============================================================
//  La table de Perudo : tapis ovale, joueurs installés autour,
//  gobelets, annonces, révélation. Purement visuel : toutes les
//  décisions sont prises par le serveur.
// =============================================================
import Die from "./Die";
import Cup from "./Cup";
import Avatar from "./Avatar";
import type { PlayerView, PublicPlayer } from "@/lib/rules";

type Props = {
  view: PlayerView;
  myId: string | null;
  present: Set<string> | null; // joueurs connectés (null = inconnu)
  shaking: boolean;
};

/** Place les joueurs sur une ellipse, le joueur local en bas. */
export function seatPositions(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = ((90 + (i * 360) / n) * Math.PI) / 180;
    return { left: 50 + 43 * Math.cos(a), top: 50 + 41 * Math.sin(a) };
  });
}

export default function Table({ view, myId, present, shaking }: Props) {
  const seats = [...view.players].sort((a, b) => a.seat - b.seat);
  const meIdx = Math.max(0, seats.findIndex((p) => p.id === myId));
  const ordered = [...seats.slice(meIdx), ...seats.slice(0, meIdx)];
  const pos = seatPositions(ordered.length);
  const r = view.reveal;
  const showReveal = (view.phase === "reveal" || view.phase === "finished") && !!r;
  const lastBidderId = view.phase === "bidding" ? view.bidderId : null;
  const counts = (d: number) =>
    !!r && (d === r.bid.face || (!r.palifico && r.bid.face !== 1 && d === 1));

  return (
    <div className={`table-wrap n${ordered.length}`}>
      <div className="table-rail">
        <div className="table-felt">
          <Center view={view} />
        </div>
      </div>

      {ordered.map((p, i) => {
        const out = view.phase !== "lobby" && p.diceCount === 0 && !(showReveal && r!.hands[p.id]);
        const active = view.phase === "bidding" && view.turnId === p.id;
        const offline = !p.isBot && present !== null && !present.has(p.id);
        const lastBid = [...view.history].reverse().find((h) => h.playerId === p.id);
        const hand = showReveal ? r!.hands[p.id] : undefined;
        const isLoser = showReveal && r!.loserId === p.id;
        const isGainer = showReveal && r!.gainerId === p.id;
        const isWinner = view.phase === "finished" && view.winnerId === p.id;
        return (
          <div
            key={p.id}
            className={[
              "seat",
              p.id === myId && "seat-me",
              active && "seat-active",
              out && "seat-out",
              offline && "seat-offline",
              isLoser && "seat-loser",
              isGainer && "seat-gainer",
              isWinner && "seat-winner",
              pos[i].top < 50 ? "seat-top" : "seat-bottom",
            ].filter(Boolean).join(" ")}
            style={{ left: `${pos[i].left}%`, top: `${pos[i].top}%` }}
          >
            {/* bulle d'annonce */}
            {view.phase === "bidding" && lastBid && (
              <div
                key={`${view.round}-${view.history.length}-${p.id}`}
                className={`bid-bubble ${p.id === lastBidderId ? "bid-bubble-last" : ""}`}
              >
                {lastBid.bid.qty} × <Die value={lastBid.bid.face} size="xs" />
              </div>
            )}

            <div className="seat-avatar-wrap">
              <Avatar name={p.name} isBot={p.isBot} />
              {p.isHost && <span className="seat-crown" title="Hôte">♛</span>}
              {isLoser && <span className="float-delta float-minus">−1</span>}
              {isGainer && <span className="float-delta float-plus">+1</span>}
              {showReveal && r!.eliminatedId === p.id && <span className="seat-skull">💀</span>}
            </div>

            <div className="seat-name">{p.name}</div>

            <SeatStatus p={p} view={view} active={active} out={out} offline={offline} isMe={p.id === myId} />

            {/* gobelet ou dés révélés */}
            {view.phase !== "lobby" && !out && (
              <div className="seat-cup-zone">
                {hand ? (
                  <div className="seat-dice revealed">
                    {hand.map((d, k) => (
                      <Die key={k} value={d} size="xs" highlight={counts(d)} dim={!counts(d)} />
                    ))}
                  </div>
                ) : (
                  <Cup
                    size="sm"
                    state={shaking ? "shake" : "down"}
                    key={`${view.round}-${shaking}`}
                  />
                )}
              </div>
            )}

            {view.phase !== "lobby" && !out && !hand && (
              <div className="seat-dice-count" title={`${p.diceCount} dé(s)`}>
                {Array.from({ length: p.diceCount }, (_, k) => <span key={k} className="mini-die" />)}
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
  if (view.phase === "lobby") return <div className="seat-status">{p.isBot ? "bot" : "prêt"}</div>;
  if (out) return <div className="seat-status status-out">éliminé</div>;
  if (active) return <div className="seat-status status-active">{isMe ? "à toi !" : p.isBot ? "réfléchit…" : "son tour"}</div>;
  if (offline) return <div className="seat-status status-offline">déconnecté</div>;
  return null;
}

function Center({ view }: { view: PlayerView }) {
  const name = (id: string | null) => view.players.find((p) => p.id === id)?.name ?? "?";
  const r = view.reveal;

  if (view.phase === "lobby")
    return (
      <div className="center-box">
        <div className="center-label">Salle d&apos;attente</div>
        <div className="center-code">{view.code}</div>
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
        <div className={`stamp ${r.call === "exact" ? "stamp-exact" : ""}`}>
          {r.call === "liar" ? "MENTEUR !" : "EXACT !"}
        </div>
        <div className="center-sub">{name(r.callerId)} sur {r.bid.qty} × <Die value={r.bid.face} size="xs" /></div>
        <div className="center-count">
          Il y en avait <b>{r.count}</b>
        </div>
        <div className={`center-verdict ${r.gainerId ? "good" : ""}`}>{verdict}</div>
      </div>
    );
  }

  return (
    <div className="center-box">
      {view.palifico && <div className="badge-palifico">PALIFICO · pax non jokers</div>}
      {view.bid ? (
        <div className="center-bid" key={`${view.round}-${view.history.length}`}>
          <span className="center-qty">{view.bid.qty}</span>
          <span className="center-x">×</span>
          <Die value={view.bid.face} size="md" />
        </div>
      ) : (
        <div className="center-label">Nouvelle manche</div>
      )}
      <div className="center-sub">
        {view.bid ? <>annoncé par <b>{name(view.bidderId)}</b></> : <><b>{name(view.turnId)}</b> ouvre</>}
      </div>
      <div className="center-sub dim">{view.totalDice} dés en jeu · manche {view.round}</div>
    </div>
  );
}
