"use client";
// Fenêtres : Mon profil, Mes gobelets, Paramètres, Nos règles.
import { useEffect, useRef, useState } from "react";
import { Modal } from "./Panel";
import Avatar from "./Avatar";
import Cup from "./Cup";
import { api, MyProfile, rememberName } from "@/lib/client";
import { AVATARS, condLabel, condProgress } from "@/lib/catalog";
import { useSettings } from "@/lib/settings";
import { playSound } from "@/lib/sfx";
import { unlockAudio } from "@/lib/sound";
import { AccountBox, Coins, HistoryList, LevelCard, ProgressState } from "./Progress";
import type { CupItem } from "@/lib/content";

/** Charge (ou crée) le profil de cet appareil. */
export function useMyProfile() {
  const [data, setData] = useState<MyProfile | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.myProfile().then(setData).catch((e) => setError((e as Error).message));
  }, []);
  return { data, setData, error };
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
/** Réduit une photo à 160×160 (JPEG léger) avant l'envoi. */
async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const S = 160, c = document.createElement("canvas");
    c.width = S; c.height = S;
    const side = Math.min(img.width, img.height);
    c.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
    return c.toDataURL("image/jpeg", 0.82);
  } finally { URL.revokeObjectURL(url); }
}

// ---------- MON PROFIL ----------
export function ProfileModal({ onClose, profile, prog }: { onClose: () => void; profile: ReturnType<typeof useMyProfile>; prog: ProgressState }) {
  const { data, setData, error } = profile;
  const isAdmin = !!data?.isAdmin; // visible seulement pour le compte administrateur
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [picking, setPicking] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { if (data) setName(data.profile.name); }, [data]);

  async function save(patch: Record<string, unknown>, ok?: string) {
    setBusy(true); setMsg("");
    try {
      const r = await api.updateProfile(patch);
      setData(r);
      if ("name" in patch) rememberName(r.profile.name);
      if (ok) setMsg(ok);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Modal title="Mon profil" onClose={onClose}>
      {!data ? <p className="muted">{error || "Chargement…"}</p> : (
        <div className="profile">
          <div className="profile-head">
            <div className="profile-avatar">
              <Avatar name={data.profile.name} avatar={data.profile.publicAvatar} size={112} />
              <button className="avatar-cam" onClick={() => file.current?.click()} aria-label="Changer la photo" title="Ajouter / changer la photo">📷</button>
              <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) save({ photo: await shrinkPhoto(f) }, "Photo enregistrée");
                e.target.value = "";
              }} />
            </div>
            <div className="profile-id">
              <div className="name-edit">
                <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} aria-label="Pseudo" />
                <button className="btn-icon" disabled={busy || name.trim() === data.profile.name} onClick={() => save({ name }, "Pseudo enregistré")} title="Enregistrer">✏️</button>
              </div>
              <div className="muted small">Joueur depuis le {fmtDate(data.profile.since)}</div>
              <div className="row-wrap">
                <button className="gbtn gbtn-dark gbtn-sm" onClick={() => setPicking((p) => !p)}>Choisir un avatar</button>
                {data.profile.hasPhoto && <button className="gbtn gbtn-dark gbtn-sm" disabled={busy} onClick={() => save({ photo: null }, "Photo supprimée")}>Supprimer la photo</button>}
              </div>
            </div>
          </div>

          {picking && (
            <div className="avatar-grid">
              {AVATARS.map((a) => (
                <button key={a} className={`avatar-pick ${!data.profile.hasPhoto && data.profile.avatar === a ? "on" : ""}`}
                  onClick={() => { save({ avatar: a, ...(data.profile.hasPhoto ? { photo: null } : {}) }, "Avatar choisi"); setPicking(false); }}>
                  <Avatar name={a} avatar={a} size={64} />
                </button>
              ))}
            </div>
          )}
          {msg && <p className="hint">{msg}</p>}

          <AccountBox account={data.account} onChange={() => { api.myProfile().then(setData).catch(() => {}); prog.reload(); }} />
          <LevelCard prog={prog} />

          {isAdmin && <a href="/admin" className="gbtn gbtn-purple gbtn-sm admin-entry">🛠 Ouvrir Perudo Admin</a>}

          <div className="section-title">Statistiques</div>
          {!data.account && <p className="muted small">Invité : tes parties ne sont pas enregistrées. Crée un compte pour garder tes statistiques.</p>}
          <div className="stat-grid">
            <Stat icon="🎲" value={data.stats.played} label="Parties jouées" />
            <Stat icon="🏆" value={data.stats.wins} label="Victoires" />
            <Stat icon="💀" value={data.stats.losses} label="Défaites" />
            <Stat icon="📊" value={`${data.stats.rate}%`} label="Taux de victoire" />
          </div>
          <div className="stat-grid stat-grid-sm">
            <Stat icon="⚡" value={`${data.stats.liarWins}/${data.stats.liarCalls}${data.stats.liarCalls ? ` (${Math.round((data.stats.liarWins / data.stats.liarCalls) * 100)} %)` : ""}`} label="Dudo réussis / tentés" />
            <Stat icon="🎯" value={`${data.stats.exactWins}/${data.stats.exactCalls}${data.stats.exactCalls ? ` (${Math.round((data.stats.exactWins / data.stats.exactCalls) * 100)} %)` : ""}`} label="Exact réussis / tentés" />
            <Stat icon="🔥" value={data.stats.bestWinStreak} label="Meilleure série" />
          </div>
          <div className="stat-grid stat-grid-sm">
            <Stat icon="🐦‍🔥" value={data.stats.phoenix ?? 0} label="Victoires après 1 dé" />
            <Stat icon="🛡️" value={data.stats.flawless ?? 0} label="Victoires sans perte" />
            <Stat icon="🗣️" value={data.stats.bids ?? 0} label="Annonces" />
          </div>

          <HistoryList prog={prog} />
        </div>
      )}
    </Modal>
  );
}

function Stat({ icon, value, label }: { icon: string; value: number | string; label: string }) {
  return (
    <div className="stat">
      <div className="stat-value"><span>{icon}</span> {value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// ---------- MES GOBELETS ----------
type CupTab = "classic" | "exploit" | "mystery" | "shop";
export function CupsModal({ onClose, profile, prog, openShop }: { onClose: () => void; profile: ReturnType<typeof useMyProfile>; prog: ProgressState; openShop?: () => void }) {
  const { data, setData, error } = profile;
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<CupTab>("exploit");
  const [busy, setBusy] = useState(false);
  const p = prog.data;
  const member = !!data?.account;
  async function equip(id: string) {
    setMsg("");
    try { setData(await api.updateProfile({ cup: id })); } catch (e) { setMsg((e as Error).message); }
  }
  // § 48 : 6 fragments → le gobelet mystère de son choix
  async function exchange(cupId: string, name: string) {
    if (!confirm(`Échanger ${need} fragments contre « ${name} » ?`)) return;
    setBusy(true); setMsg("");
    try {
      const r = await api.progressAction<{ cup: string | null; doblons: number }>({ op: "exchange", cup: cupId });
      prog.setData(r.progress);
      setData(await api.myProfile());
      setMsg(r.result.cup ? `🎁 Nouveau gobelet : ${r.result.cup} !` : `Tu as déjà tous les mystères : +${r.result.doblons} Doblons.`);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  // 4 catégories : Classique, Exploits, Mystères, Prestige (boutique)
  const cat = (c: CupItem) => (c.cond?.type === "none" && (c.category ?? "exploit") === "exploit" ? "classic" : c.category ?? "exploit");
  const list = (data?.cups ?? []).filter((c) => cat(c) === tab);
  const need = p?.economy.fragments.needed ?? 6;
  return (
    <Modal title="Mes gobelets" onClose={onClose} wide>
      {!data ? <p className="muted">{error || "Chargement…"}</p> : (
        <>
          <div className="tabs">
            <button className={tab === "classic" ? "on" : ""} onClick={() => setTab("classic")}>🪵 Classique</button>
            <button className={tab === "exploit" ? "on" : ""} onClick={() => setTab("exploit")}>🏅 Exploits</button>
            <button className={tab === "mystery" ? "on" : ""} onClick={() => setTab("mystery")}>🎁 Mystères</button>
            <button className={tab === "shop" ? "on" : ""} onClick={() => setTab("shop")}>👑 Prestige</button>
          </div>
          {!member && <p className="guest-note">👤 En invité, seul le gobelet Classique est disponible. Crée un compte dans <b>Mon profil</b> pour débloquer les exploits en jouant (la progression d&apos;invité n&apos;est pas reprise).</p>}
          {tab === "mystery" && member && p?.member && (
            <div className="frag-box">
              <span>🧩 Fragments : <b>{p.fragments} / {need}</b></span>
              <div className="progress"><span style={{ width: `${Math.min(100, (p.fragments / need) * 100)}%` }} /></div>
              <span className="muted small">{p.fragments >= need ? "Choisis ci-dessous le gobelet mystère que tu veux." : `Encore ${need - p.fragments} fragment${need - p.fragments > 1 ? "s" : ""} pour choisir un gobelet mystère.`}</span>
              <span className="muted small">Donne un gobelet mystère que tu n&apos;as pas encore, au hasard. Fragments : roue et défis hebdo.</span>
            </div>
          )}
          {tab === "shop" && openShop && list.length === 0 && <p className="center-text"><button className="gbtn gbtn-gold gbtn-sm" onClick={openShop}>Ouvrir la boutique</button></p>}
          {list.length === 0 ? <p className="muted center-text">Aucun gobelet dans cette catégorie pour l&apos;instant.</p> : (
            <div className="cup-grid">
              {list.map((c) => {
                const unlocked = (data.usable ?? data.unlocked).includes(c.id);
                const equipped = data.profile.cup === c.id;
                const pr = condProgress(c.cond, data.stats);
                return (
                  <div key={c.id} className={`cup-card ${equipped ? "equipped" : ""} ${unlocked ? "" : "locked"} ${tab === "mystery" && !unlocked ? "mystery" : ""}`}>
                    <div className={`cup-stage ${c.fx && c.fx !== "none" && unlocked ? `cupfx-${c.fx}` : ""}`}><Cup state="show" size="xl" skin={c.id} /></div>
                    {!unlocked && <span className="lock" aria-label="Verrouillé">{tab === "mystery" ? "❓" : "🔒"}</span>}
                    {equipped && <span className="check" aria-label="Équipé">✓</span>}
                    <div className="cup-name">{c.name}</div>
                    {c.rarity && c.rarity !== "commun" && <div className={`rarity rarity-${c.rarity === "épique" ? "epic" : c.rarity === "légendaire" ? "legend" : "rare"}`}>{c.rarity}</div>}
                    {c.description && <div className="cup-desc">{c.description}</div>}
                    {equipped ? <div className="pill pill-green">Équipé</div>
                      : unlocked ? <button className="pill pill-btn" onClick={() => equip(c.id)}>Équiper</button>
                      : tab === "shop" ? <button className="pill pill-btn" onClick={openShop}>🪙 {(c.price ?? 0).toLocaleString("fr-FR")}</button>
                      : tab === "mystery" && p?.member && p.fragments >= need ? <button className="gbtn gbtn-purple gbtn-sm" disabled={busy} onClick={() => exchange(c.id, c.name)}>🧩 Choisir ({need})</button>
                      : <div className="pill">{tab === "mystery" ? "Roue ou fragments" : condLabel(c.cond)}</div>}
                    {!unlocked && tab === "exploit" && member && (
                      <div className="progress" title={`${pr.have} / ${pr.need}`}>
                        <span style={{ width: `${(pr.have / pr.need) * 100}%` }} />
                        <em>{pr.have}/{pr.need}</em>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {msg && <p className="hint center-text">{msg}</p>}
          {p?.member && <p className="center-text"><Coins n={p.doblons} frag={p.fragments} /></p>}
          <p className="muted small center-text">Les gobelets sont purement décoratifs : ils ne changent jamais les dés. Seules les parties avec au moins 2 vrais joueurs font progresser les exploits.</p>
        </>
      )}
    </Modal>
  );
}

// ---------- PARAMÈTRES ----------
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [s, set] = useSettings();
  const Toggle = ({ k, label }: { k: "gameSounds" | "soundboard" | "voices" | "bubbles" | "reduceMotion"; label: string }) => (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={s[k]} onChange={(e) => set({ [k]: e.target.checked })} />
      <span className="switch" />
    </label>
  );
  return (
    <Modal title="Paramètres" onClose={onClose}>
      <div className="settings">
        <label className="slider-row">
          <span>Volume</span>
          <input type="range" min={0} max={1} step={0.05} value={s.volume}
            onChange={(e) => set({ volume: Number(e.target.value) })}
            onPointerUp={() => { unlockAudio(); playSound("applaudissements"); }} />
          <b>{Math.round(s.volume * 100)}%</b>
        </label>
        <Toggle k="gameSounds" label="Sons du jeu (dés, menteur…)" />
        <Toggle k="soundboard" label="Bruitages des joueurs" />
        <Toggle k="voices" label="Voix des phrases" />
        <Toggle k="bubbles" label="Bulles et réactions" />
        <Toggle k="reduceMotion" label="Réduire les animations" />
        <p className="muted small">Réglages gardés sur cet appareil.</p>
      </div>
    </Modal>
  );
}

// ---------- RÈGLES ----------
export function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Nos règles" onClose={onClose}>
      <ul className="rules-list">
        <li><b>Le but</b> : être le dernier à avoir des dés. Chacun commence avec 5 dés cachés sous son gobelet.</li>
        <li><b>Annoncer</b> : « il y a au moins X dés de telle valeur sur toute la table ». Chaque annonce doit monter.</li>
        <li><b>Pax</b> = les 1. Ils sont jokers, mais on ne peut jamais ouvrir une manche sur les pax.</li>
        <li>Passer aux pax : la moitié de la quantité (arrondie au-dessus). En revenir : le double + 1.</li>
        <li><b>Menteur !</b> — tu penses que l&apos;annonce est fausse. On compte : le perdant lâche un dé.</li>
        <li><b>Exact !</b> — tu penses qu&apos;il y a pile le bon nombre. Juste : +1 dé (max 5). Faux : −1 dé.</li>
        <li><b>Palifico</b> : la première manche où un joueur tombe à 1 dé, les pax ne sont plus jokers. Une seule fois par joueur.</li>
      </ul>
    </Modal>
  );
}
