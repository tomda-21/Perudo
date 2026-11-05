"use client";
// Tableau de bord, Apparence, Paramètres du jeu, Joueurs, Journal.
import { useEffect, useState, type CSSProperties } from "react";
import { Modal } from "../Panel";
import Avatar from "../Avatar";
import Logo from "../Logo";
import Cup from "../Cup";
import { adminApi, Confirm, Field, FileField, fmt } from "./kit";
import { Appearance, DEFAULT_APPEARANCE, DEFAULT_SETTINGS, GameSettings } from "@/lib/content";
import { useContent } from "@/lib/content-client";

type Overview = {
  players: number; admins: number; blocked: number; finished: number; live: number; lobbies: number; games_today: number;
  content: Record<string, number>;
  recent_results: { game_id: string; name: string; won: boolean; finished_at: string }[];
  recent_players: { name: string; created_at: string }[];
  recent_audit: { action: string; target: string | null; at: string; name: string | null }[];
};

const ACTIONS: Record<string, string> = {
  "admin.claim": "activation admin", "admin.login": "connexion admin", "admin.login_failed": "échec de connexion admin",
  "content.save": "contenu enregistré", "content.delete": "contenu supprimé", "content.reorder": "ordre modifié",
  "asset.upload": "fichier importé", "settings.publish": "réglages publiés", "settings.draft": "brouillon de réglages",
  "player.block": "joueur bloqué", "player.unblock": "joueur débloqué",
};

// ---------- TABLEAU DE BORD ----------
export function Dashboard() {
  const [o, setO] = useState<Overview | null>(null);
  const [err, setErr] = useState("");
  const [g, setG] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    adminApi<Overview>("overview").then(setO).catch((e) => setErr(e.message));
    adminApi<{ global: Record<string, number> }>("econ_stats").then((r) => setG(r.global)).catch(() => {});
  }, []);
  if (!o) return <p className="muted">{err || "Chargement…"}</p>;
  const cards = [
    ...(g ? [["🔐", g.accounts, "Comptes (e-mail)"], ["🪙", g.doblons, "Doblons en circulation"], ["🧰", g.chests, "Coffres ouverts"],
      ["🎡", g.spins, "Tours de roue"], ["🎁", g.rewards, "Récompenses versées"]] as const : []),
    ["👥", o.players, "Joueurs inscrits"], ["🏁", o.finished, "Parties terminées (comptées)"], ["🎲", o.live, "Parties en cours"],
    ["🚪", o.lobbies, "Salles d'attente ouvertes"], ["📅", o.games_today, "Salons créés (24 h)"],
    ["🥤", o.content.cup ?? 6, "Gobelets publiés"], ["🗺️", o.content.map ?? 4, "Maps publiées"],
    ["💬", o.content.phrase ?? 6, "Phrases publiées"], ["🔊", o.content.sound ?? 8, "Bruitages publiés"], ["⛔", o.blocked, "Comptes bloqués"],
  ] as const;
  return (
    <div className="a-section">
      <div className="a-cards">
        {cards.map(([i, v, l]) => <div key={l} className="stat"><div className="stat-value"><span>{i}</span> {v}</div><div className="stat-label">{l}</div></div>)}
      </div>
      <div className="a-cols">
        <div className="a-box"><h3>Dernières parties</h3>
          {o.recent_results.length === 0 ? <p className="muted small">Aucune partie comptée pour l&apos;instant.</p> :
            <ul className="a-mini">{o.recent_results.map((r, i) => <li key={i}>{r.won ? "🏆" : "💀"} {r.name} <span className="muted small">{fmt(r.finished_at)}</span></li>)}</ul>}
        </div>
        <div className="a-box"><h3>Nouveaux joueurs</h3>
          <ul className="a-mini">{o.recent_players.map((p, i) => <li key={i}>👤 {p.name} <span className="muted small">{fmt(p.created_at)}</span></li>)}</ul>
        </div>
        <div className="a-box"><h3>Activité admin</h3>
          {o.recent_audit.length === 0 ? <p className="muted small">Rien pour l&apos;instant.</p> :
            <ul className="a-mini">{o.recent_audit.map((a, i) => <li key={i}>{ACTIONS[a.action] ?? a.action}{a.target ? ` · ${a.target}` : ""} <span className="muted small">{fmt(a.at)}</span></li>)}</ul>}
        </div>
      </div>
    </div>
  );
}

type SettingsResp = Record<string, { draft: unknown; published: unknown; updated_at: string }>;
type Hist = { hid: number; data: unknown; at: string };

/** Brouillon / publication / historique d'un réglage. */
export function useSetting<T>(key: "game" | "appearance" | "economy", def: T) {
  const [draft, setDraft] = useState<T | null>(null);
  const [published, setPublished] = useState<T | null>(null);
  const [hist, setHist] = useState<Hist[]>([]);
  const [msg, setMsg] = useState("");
  const load = async () => {
    const s = await adminApi<SettingsResp>("settings_get");
    setDraft(((s[key]?.draft as T) ?? (s[key]?.published as T)) ?? def);
    setPublished((s[key]?.published as T) ?? def);
    setHist(await adminApi<Hist[]>("settings_history", { key }));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, []);
  const save = async (publish: boolean) => {
    setMsg("");
    try {
      await adminApi("settings_save", { key, draft, publish });
      setMsg(publish ? "Publié ✓ — appliqué au site d'ici 20 secondes" : "Brouillon enregistré ✓ (pas encore visible des joueurs)");
      load();
    } catch (e) { setMsg((e as Error).message); }
  };
  const revert = async (hid: number) => { await adminApi("content_revert", { hid }).catch((e) => setMsg(e.message)); setMsg("Version restaurée et publiée ✓"); load(); };
  return { draft, setDraft, published, hist, msg, save, revert };
}

export function Publisher({ save, msg, hist, revert }: { save: (p: boolean) => void; msg: string; hist: Hist[]; revert: (hid: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="row">
        <button className="gbtn gbtn-purple" onClick={() => save(false)}>Enregistrer le brouillon</button>
        <button className="gbtn gbtn-green" onClick={() => save(true)}>Publier</button>
        <button className="gbtn gbtn-dark" onClick={() => setOpen(true)} disabled={!hist.length}>Versions publiées ({hist.length})</button>
      </div>
      {msg && <p className="hint">{msg}</p>}
      {open && (
        <Modal title="Versions publiées" onClose={() => setOpen(false)}>
          <ul className="a-list compact">
            {hist.map((h) => (
              <li key={h.hid} className="a-item">
                <div className="a-item-main"><b>{fmt(h.at)}</b></div>
                <button className="gbtn gbtn-dark gbtn-sm" onClick={() => { revert(h.hid); setOpen(false); }}>Revenir à cette version</button>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
}

// ---------- APPARENCE ----------
export function AppearanceAdmin() {
  const s = useSetting<Appearance>("appearance", DEFAULT_APPEARANCE);
  if (!s.draft) return <p className="muted">{s.msg || "Chargement…"}</p>;
  const a = s.draft;
  const setColor = (k: keyof Appearance["colors"], v: string) => s.setDraft({ ...a, colors: { ...a.colors, [k]: v } });
  const vars = {
    "--gold": a.colors.gold, "--plum": a.colors.plum, "--btn-green": a.colors.green, "--btn-red": a.colors.red,
    "--btn-purple": a.colors.purple, "--felt": a.colors.felt,
  } as CSSProperties;
  const colors: [keyof Appearance["colors"], string][] = [["gold", "Or (titres, boutons dorés)"], ["plum", "Fond de nuit"], ["green", "Bouton « Enchérir »"], ["red", "Bouton « Menteur ! » / Quitter"], ["purple", "Bouton « Rejoindre »"], ["felt", "Tapis de la table"]];
  return (
    <div className="a-section a-form-split">
      <div className="a-form">
        <h3>Couleurs</h3>
        <div className="a-colors">
          {colors.map(([k, l]) => (
            <label key={k} className="a-color"><input type="color" value={a.colors[k]} onChange={(e) => setColor(k, e.target.value)} /><span>{l}</span></label>
          ))}
        </div>
        <button className="a-link" onClick={() => s.setDraft({ ...a, colors: DEFAULT_APPEARANCE.colors })}>Remettre les couleurs d&apos;origine</button>
        <h3>Accueil</h3>
        <FileField label="Logo (remplace le logo dessiné)" kind="image" value={a.logo} onChange={(v) => s.setDraft({ ...a, logo: v })} hint="PNG transparent, environ 1040 × 520." />
        <FileField label="Fond de l'accueil" kind="image" value={a.homeBackground} onChange={(v) => s.setDraft({ ...a, homeBackground: v })} hint="2560 × 1440, centre dégagé pour le panneau." />
        <FileField label="Mascotte (à gauche, sur ordinateur)" kind="image" value={a.mascot} onChange={(v) => s.setDraft({ ...a, mascot: v })} hint="PNG transparent, environ 900 × 1300." />
        <Field label="Phrase de la mascotte"><input value={a.tagline} maxLength={40} onChange={(e) => s.setDraft({ ...a, tagline: e.target.value })} /></Field>
        <Publisher {...s} />
      </div>
      <div className="a-preview">
        <span className="a-label">Aperçu (avant publication)</span>
        <div className="a-theme-preview" style={vars}>
          <div className="a-theme-logo"><Logo size="sm" image={a.logo} /></div>
          <div className="row">
            <button className="gbtn gbtn-gold gbtn-sm">▶ Créer</button>
            <button className="gbtn gbtn-purple gbtn-sm">🔗 Rejoindre</button>
          </div>
          <div className="row">
            <button className="gbtn gbtn-green gbtn-sm">▶ Enchérir</button>
            <button className="gbtn gbtn-red gbtn-sm">⚡ Menteur !</button>
          </div>
          <div className="a-felt"><Cup state="down" size="lg" /></div>
        </div>
        <p className="a-hint">Les couleurs sont contrôlées : un code de couleur invalide est ignoré, et les textes gardent leur contraste.</p>
      </div>
    </div>
  );
}

// ---------- PARAMÈTRES DU JEU ----------
export function SettingsAdmin() {
  const s = useSetting<GameSettings>("game", DEFAULT_SETTINGS);
  if (!s.draft) return <p className="muted">{s.msg || "Chargement…"}</p>;
  const g = s.draft;
  const set = (p: Partial<GameSettings>) => s.setDraft({ ...g, ...p });
  return (
    <div className="a-section a-form">
      <p className="a-note">Ces réglages s&apos;appliquent aux <b>nouveaux salons</b>. Une partie déjà créée garde ses règles jusqu&apos;à la fin.</p>
      <Field label={`Dés au départ : ${g.startDice}`} hint="5 dans le Perudo classique. C'est aussi le maximum qu'on peut récupérer avec « Exact ! ».">
        <input type="range" min={1} max={6} value={g.startDice} onChange={(e) => set({ startDice: Number(e.target.value) })} />
      </Field>
      <label className="toggle-row"><span>Variante « Exact ! »</span><input type="checkbox" checked={g.exactEnabled} onChange={(e) => set({ exactEnabled: e.target.checked })} /><span className="switch" /></label>
      <label className="toggle-row"><span>Palifico (pax non jokers à 1 dé)</span><input type="checkbox" checked={g.palificoEnabled} onChange={(e) => set({ palificoEnabled: e.target.checked })} /><span className="switch" /></label>
      <label className="toggle-row"><span>Sons et phrases entre joueurs</span><input type="checkbox" checked={g.fxEnabled} onChange={(e) => set({ fxEnabled: e.target.checked })} /><span className="switch" /></label>
      <p className="a-hint">Soundboard : aucun délai entre deux utilisations (choix définitif).</p>
      <p className="a-hint">Les maps disponibles et celles du tirage au hasard se règlent dans l&apos;onglet Maps (publier / désactiver, « peut être tirée au hasard »).</p>
      <Publisher {...s} />
    </div>
  );
}

// ---------- JOUEURS ----------
type PlayerRow = { id: string; name: string; avatar: string; has_photo: boolean; photo_v: number; role: string; blocked: boolean; created_at: string; played: number; wins: number };
type PlayerDetail = {
  profile: { id: string; name: string; avatar: string; has_photo: boolean; photo_v: number; cup: string; role: string; blocked: boolean; blocked_reason: string | null; created_at: string };
  results: { game_id: string; won: boolean; humans: number; rounds: number; liar_wins: number; exact_wins: number; finished_at: string }[];
  unlocks: string[];
};
const av = (p: { id: string; avatar: string; has_photo: boolean; photo_v: number }) => (p.has_photo ? `photo:${p.id}:${p.photo_v}` : p.avatar);

export function PlayersAdmin() {
  const [q, setQ] = useState("");
  const [list, setList] = useState<PlayerRow[] | null>(null);
  const [open, setOpen] = useState<PlayerDetail | null>(null);
  const [block, setBlock] = useState<{ id: string; name: string; blocked: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const search = async (text = q) => setList(await adminApi<PlayerRow[]>("players_search", { q: text }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { search("").catch((e) => setMsg(e.message)); }, []);
  const show = async (id: string) => setOpen(await adminApi<PlayerDetail>("player_get", { id }));

  return (
    <div className="a-section">
      <div className="a-toolbar">
        <input placeholder="Rechercher un pseudo…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
        <button className="gbtn gbtn-dark gbtn-sm" onClick={() => search()}>Rechercher</button>
      </div>
      {msg && <p className="hint">{msg}</p>}
      {!list ? <p className="muted">Chargement…</p> : (
        <ul className="a-list">
          {list.map((p) => (
            <li key={p.id} className="a-item">
              <Avatar name={p.name} avatar={av(p)} size={40} />
              <div className="a-item-main"><b>{p.name} {p.role === "admin" && <span className="a-badge a-badge-published">admin</span>} {p.blocked && <span className="a-badge a-badge-disabled">bloqué</span>}</b>
                <span className="muted small">{p.played} parties · {p.wins} victoires · inscrit le {fmt(p.created_at)}</span></div>
              <button className="gbtn gbtn-dark gbtn-sm" onClick={() => show(p.id)}>Voir</button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <Modal title={open.profile.name} onClose={() => setOpen(null)} wide>
          <div className="profile-head">
            <Avatar name={open.profile.name} avatar={av(open.profile)} size={80} />
            <div className="profile-id">
              <span className="muted small">Inscrit le {fmt(open.profile.created_at)} · gobelet équipé : {open.profile.cup}</span>
              <span className="muted small">Gobelets obtenus : {open.unlocks.length ? open.unlocks.join(", ") : "aucun pour l'instant"}</span>
              {open.profile.blocked && <span className="error small">Bloqué : {open.profile.blocked_reason}</span>}
            </div>
          </div>
          <div className="stat-grid">
            <div className="stat"><div className="stat-value">🎲 {open.results.length}</div><div className="stat-label">Parties</div></div>
            <div className="stat"><div className="stat-value">🏆 {open.results.filter((r) => r.won).length}</div><div className="stat-label">Victoires</div></div>
            <div className="stat"><div className="stat-value">💀 {open.results.filter((r) => !r.won).length}</div><div className="stat-label">Défaites</div></div>
            <div className="stat"><div className="stat-value">🤥 {open.results.reduce((n, r) => n + r.liar_wins, 0)}</div><div className="stat-label">Menteurs réussis</div></div>
          </div>
          <ul className="a-mini">{open.results.slice(0, 15).map((r, i) => <li key={i}>{r.won ? "🏆 Victoire" : "💀 Défaite"} · {r.humans} joueurs · {r.rounds} manches <span className="muted small">{fmt(r.finished_at)}</span></li>)}</ul>
          <p className="a-hint">Les résultats des parties terminées ne sont pas modifiables : ils viennent uniquement du serveur de jeu.</p>
          <PlayerEconomy id={open.profile.id} name={open.profile.name} />
          {open.profile.role !== "admin" && (
            <div className="row">
              {open.profile.blocked
                ? <button className="gbtn gbtn-green" onClick={() => setBlock({ id: open.profile.id, name: open.profile.name, blocked: false })}>Débloquer</button>
                : <button className="gbtn gbtn-red" onClick={() => setBlock({ id: open.profile.id, name: open.profile.name, blocked: true })}>Bloquer ce compte</button>}
            </div>
          )}
        </Modal>
      )}

      {block && (
        <Confirm title={block.blocked ? "Bloquer ce compte ?" : "Débloquer ?"} danger={block.blocked ? "Bloquer" : "Débloquer"}
          text={<>
            <p>{block.blocked ? `${block.name} ne pourra plus créer ni rejoindre de partie.` : `${block.name} pourra de nouveau jouer.`}</p>
            {block.blocked && <input placeholder="Raison (obligatoire)" value={reason} onChange={(e) => setReason(e.target.value)} />}
          </>}
          onNo={() => setBlock(null)}
          onYes={async () => {
            try {
              await adminApi("player_block", { id: block.id, blocked: block.blocked, reason, confirm: true });
              setBlock(null); setReason(""); setOpen(null); search();
            } catch (e) { setMsg((e as Error).message); setBlock(null); }
          }} />
      )}
    </div>
  );
}

// ---------- JOURNAL ----------
export function AuditAdmin() {
  const [list, setList] = useState<{ id: number; action: string; target: string | null; at: string; name: string | null; detail: Record<string, unknown> | null }[] | null>(null);
  useEffect(() => { adminApi<typeof list>("audit").then(setList).catch(() => setList([])); }, []);
  if (!list) return <p className="muted">Chargement…</p>;
  return (
    <div className="a-section">
      <p className="a-note">Toutes les actions de l&apos;espace admin sont enregistrées ici (elles ne peuvent pas être effacées depuis l&apos;admin).</p>
      <ul className="a-list compact">
        {list.map((a) => (
          <li key={a.id} className="a-item">
            <div className="a-item-main"><b>{ACTIONS[a.action] ?? a.action}</b><span className="muted small">{a.target ?? ""}{a.detail && "reason" in a.detail && a.detail.reason ? ` · ${a.detail.reason}` : ""}</span></div>
            <span className="muted small">{a.name ?? "—"} · {fmt(a.at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- portefeuille d'un joueur (dans la fiche joueur) ----------
type WalletResp = {
  account: { login: string; created_at: string; email?: string | null } | null;
  level?: { level: number; into: number; need: number };
  wallet: { wallet: { doblons: number; xp: number; fragments: number; last_spin: string | null; title: string | null }; inventory: { type: string; id: string; source: string; at: string }[];
    ledger: { id: number; kind: string; doblons: number; xp: number; fragments: number; detail: Record<string, unknown> | null; at: string }[] };
};
function PlayerEconomy({ id, name }: { id: string; name: string }) {
  const [w, setW] = useState<WalletResp | null>(null);
  const [msg, setMsg] = useState("");
  const [grant, setGrant] = useState(false);
  const [f, setF] = useState({ doblons: 0, fragments: 0, xp: 0, reason: "", item: "" });
  const content = useContent();
  const itemOptions = [
    ...content.cups.map((c) => ({ v: `cup:${c.id}`, l: `🥤 ${c.name}` })), ...content.frames.map((c) => ({ v: `frame:${c.id}`, l: `🖼️ ${c.name}` })),
    ...content.victories.map((c) => ({ v: `victory:${c.id}`, l: `🎆 ${c.name}` })),
  ];
  const load = () => adminApi<WalletResp>("player_wallet", { id }).then(setW).catch((e) => setMsg(e.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);
  if (!w) return <p className="muted">{msg || "Chargement du portefeuille…"}</p>;
  if (!w.account) return <p className="a-note">Joueur invité (pas de compte) : pas de Doblons ni d&apos;XP.</p>;
  const x = w.wallet.wallet;
  return (
    <div className="a-section">
      <div className="section-title">Compte #{w.account.login}{w.account.email ? ` · ${w.account.email}` : ""} — portefeuille</div>
      <div className="stat-grid">
        <div className="stat"><div className="stat-value">🪙 {x.doblons}</div><div className="stat-label">Doblons</div></div>
        <div className="stat"><div className="stat-value">⭐ {w.level?.level ?? "?"}</div><div className="stat-label">Niveau</div></div>
        <div className="stat"><div className="stat-value">✨ {x.xp}</div><div className="stat-label">XP</div></div>
        <div className="stat"><div className="stat-value">🧩 {x.fragments}</div><div className="stat-label">Fragments</div></div>
        <div className="stat"><div className="stat-value">🎡</div><div className="stat-label">{x.last_spin ? `roue : ${fmt(x.last_spin)}` : "roue jamais tournée"}</div></div>
      </div>
      <p className="muted small">Inventaire : {w.wallet.inventory.length ? w.wallet.inventory.map((i) => `${i.type}:${i.id} (${i.source})`).join(", ") : "vide"}</p>
      <ul className="a-mini">{w.wallet.ledger.slice(0, 15).map((l) => <li key={l.id}>{l.kind} · {l.doblons > 0 ? "+" : ""}{l.doblons} 🪙 {l.xp ? `· +${l.xp} XP` : ""} {l.fragments ? `· ${l.fragments} 🧩` : ""} <span className="muted small">{fmt(l.at)}</span></li>)}</ul>
      <div className="row">
        <button className="gbtn gbtn-purple gbtn-sm" onClick={() => setGrant(true)}>Ajuster / offrir</button>
      </div>
      <p className="muted small">Mot de passe oublié : le joueur utilise « Mot de passe oublié ? » (lien par e-mail). L&apos;admin ne voit ni ne choisit jamais les mots de passe.</p>
      {msg && <p className="hint">{msg}</p>}
      {grant && (
        <Confirm title={`Ajuster le solde de ${name}`} danger="Appliquer"
          text={<div className="a-form">
            <Field label="Doblons (négatif pour retirer)"><input type="number" value={f.doblons} onChange={(e) => setF({ ...f, doblons: Number(e.target.value) })} /></Field>
            <Field label="Fragments (négatif pour retirer)"><input type="number" value={f.fragments} onChange={(e) => setF({ ...f, fragments: Number(e.target.value) })} /></Field>
            <Field label="XP (négatif pour corriger) — impossible sur ton propre compte"><input type="number" value={f.xp} onChange={(e) => setF({ ...f, xp: Number(e.target.value) })} /></Field>
            <Field label="Offrir un objet (facultatif)">
              <select value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })}>
                <option value="">— aucun —</option>
                {itemOptions.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </Field>
            <Field label="Raison (obligatoire, visible dans le journal)"><input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
          </div>}
          onNo={() => setGrant(false)}
          onYes={async () => {
            const [type, iid] = f.item ? f.item.split(":") : [];
            try { await adminApi("player_grant", { id, doblons: f.doblons, fragments: f.fragments, xp: f.xp, item: f.item ? { type, id: iid } : null, reason: f.reason, confirm: true }); setMsg("Ajustement appliqué ✓"); load(); }
            catch (e) { setMsg((e as Error).message); }
            setGrant(false);
          }} />
      )}
    </div>
  );
}
