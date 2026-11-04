"use client";
// Gestion des contenus : phrases cultes, bruitages, gobelets, maps.
// Chaque élément : brouillon / publié / désactivé, ordre, historique, retour arrière.
import { useEffect, useState, type CSSProperties } from "react";
import { Modal } from "../Panel";
import Cup from "../Cup";
import Scene from "../Scene";
import Avatar from "../Avatar";
import { adminApi, Confirm, EMOJIS, Field, FileField, fmt, StatusBadge } from "./kit";
import { MAP_ANIMS, MapAnim, Status } from "@/lib/content";
import { SOUNDS } from "@/lib/catalog";
import { previewSound, previewVoice } from "@/lib/sfx";
import { unlockAudio } from "@/lib/sound";
import { loadContent } from "@/lib/content-client";

export type Kind = "phrase" | "sound" | "cup" | "map";
type Row = { kind: Kind; id: string; data: Record<string, unknown>; sort: number; status: Status; updated_at: string };
type Hist = { hid: number; data: Record<string, unknown>; status: string; deleted: boolean; at: string };

const TITLES: Record<Kind, { one: string; add: string; empty: Record<string, unknown> }> = {
  phrase: { one: "phrase", add: "Nouvelle phrase", empty: { text: "" } },
  sound: { one: "bruitage", add: "Nouveau bruitage", empty: { label: "", icon: "🔊", volume: 1, anim: "pop" } },
  cup: { one: "gobelet", add: "Nouveau gobelet", empty: { name: "", description: "", rarity: "rare", cond: { type: "wins", n: 10 }, skin: "custom" } },
  map: { one: "map", add: "Nouvelle map", empty: { name: "", icon: "🗺️", anims: [], random: true, layers: [] } },
};

const label = (r: { kind: Kind; data: Record<string, unknown> }) =>
  String(r.kind === "phrase" ? r.data.text : r.kind === "sound" ? r.data.label : r.data.name);

export default function ContentAdmin({ kind }: { kind: Kind }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [edit, setEdit] = useState<{ id: string | null; data: Record<string, unknown>; status: Status } | null>(null);
  const [del, setDel] = useState<Row | null>(null);
  const [hist, setHist] = useState<{ row: Row; list: Hist[] } | null>(null);
  const [msg, setMsg] = useState("");

  const reload = async () => {
    const all = await adminApi<Row[]>("content_list");
    setRows(all.filter((r) => r.kind === kind).sort((a, b) => a.sort - b.sort));
  };
  useEffect(() => { setRows(null); reload().catch((e) => setMsg(e.message)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [kind]);

  async function save(status: Status) {
    if (!edit) return;
    setMsg("");
    try {
      await adminApi("content_save", { kind, id: edit.id, data: edit.data, status });
      setEdit(null);
      setMsg(status === "published" ? "Publié ✓ — visible dans le jeu d'ici quelques secondes" : "Enregistré en brouillon ✓");
      await reload();
      loadContent(true);
    } catch (e) { setMsg((e as Error).message); }
  }
  async function move(i: number, d: number) {
    if (!rows) return;
    const next = [...rows];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    setRows(next);
    await adminApi("content_reorder", { kind, ids: next.map((r) => r.id) }).catch((e) => setMsg(e.message));
  }
  async function setStatus(r: Row, status: Status) {
    await adminApi("content_save", { kind, id: r.id, data: r.data, status }).catch((e) => setMsg(e.message));
    reload();
  }

  return (
    <div className="a-section">
      <div className="a-toolbar">
        <button className="gbtn gbtn-gold gbtn-sm" onClick={() => { setMsg(""); setEdit({ id: null, data: structuredClone(TITLES[kind].empty), status: "draft" }); }}>＋ {TITLES[kind].add}</button>
        {msg && <span className="a-msg">{msg}</span>}
      </div>
      {!rows ? <p className="muted">Chargement…</p> : rows.length === 0 ? <p className="muted">Aucun élément.</p> : (
        <ul className="a-list">
          {rows.map((r, i) => (
            <li key={r.id} className={`a-item status-${r.status}`}>
              <div className="a-order">
                <button disabled={i === 0} onClick={() => move(i, -1)} aria-label="Monter">▲</button>
                <button disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label="Descendre">▼</button>
              </div>
              <ItemPreview kind={kind} data={r.data} />
              <div className="a-item-main">
                <b>{label(r)}</b>
                <span className="muted small">{describe(kind, r.data)}</span>
              </div>
              <StatusBadge s={r.status} />
              <div className="a-actions">
                <button className="gbtn gbtn-dark gbtn-sm" onClick={() => { setMsg(""); setEdit({ id: r.id, data: structuredClone(r.data), status: r.status }); }}>Modifier</button>
                {r.status === "published"
                  ? <button className="gbtn gbtn-dark gbtn-sm" onClick={() => setStatus(r, "disabled")}>Désactiver</button>
                  : <button className="gbtn gbtn-green gbtn-sm" onClick={() => setStatus(r, "published")}>Publier</button>}
                <button className="gbtn gbtn-dark gbtn-sm" onClick={async () => setHist({ row: r, list: await adminApi<Hist[]>("content_history", { kind, id: r.id }) })}>Historique</button>
                <button className="gbtn gbtn-red gbtn-sm" onClick={() => setDel(r)} aria-label="Supprimer">🗑</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {edit && (
        <Modal title={edit.id ? `Modifier : ${TITLES[kind].one}` : TITLES[kind].add} onClose={() => setEdit(null)} wide>
          <Editor kind={kind} data={edit.data} isNew={!edit.id} onChange={(data) => setEdit({ ...edit, data })} />
          {msg && <p className="error">{msg}</p>}
          <div className="row">
            <button className="gbtn gbtn-dark" onClick={() => setEdit(null)}>Annuler</button>
            <button className="gbtn gbtn-purple" onClick={() => save("draft")}>Enregistrer le brouillon</button>
            <button className="gbtn gbtn-green" onClick={() => save("published")}>Publier</button>
          </div>
        </Modal>
      )}

      {del && (
        <Confirm title="Supprimer ?" danger="Supprimer définitivement"
          text={<>« {label(del)} » sera retiré du jeu. Tu pourras le retrouver dans l&apos;historique. <br />Astuce : « Désactiver » le cache sans le supprimer.</>}
          onNo={() => setDel(null)}
          onYes={async () => { await adminApi("content_delete", { kind, id: del.id, confirm: del.id }).catch((e) => setMsg(e.message)); setDel(null); reload(); }} />
      )}

      {hist && (
        <Modal title="Historique" onClose={() => setHist(null)}>
          <p className="muted small">Les 20 dernières versions de « {label(hist.row)} ». Restaurer = recréer cette version.</p>
          <ul className="a-list compact">
            {hist.list.map((h) => (
              <li key={h.hid} className="a-item">
                <div className="a-item-main"><b>{fmt(h.at)}</b><span className="muted small">{h.deleted ? "supprimé" : describe(kind, h.data)}</span></div>
                {!h.deleted && <StatusBadge s={h.status} />}
                <button className="gbtn gbtn-dark gbtn-sm" onClick={async () => { await adminApi("content_revert", { hid: h.hid }).catch((e) => setMsg(e.message)); setHist(null); reload(); }}>Restaurer</button>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}

function describe(kind: Kind, d: Record<string, unknown>) {
  if (kind === "phrase") return d.audio ? "avec un enregistrement audio" : "sans audio (voix de synthèse)";
  if (kind === "sound") return `${d.file ? "fichier importé" : "son d'origine"} · volume ${Math.round(Number(d.volume ?? 1) * 100)} %`;
  if (kind === "cup") {
    const c = (d.cond ?? {}) as { type?: string; n?: number };
    const t = { none: "disponible dès le départ", wins: `${c.n} victoires`, played: `${c.n} parties`, liarWins: `${c.n} « Menteur ! » réussis`, winStreak: `${c.n} victoires d'affilée` }[c.type ?? "none"];
    return `${d.rarity ?? "commun"} · ${t}`;
  }
  const anims = (d.anims as string[] | undefined)?.join(", ");
  return `${d.random === false ? "hors tirage au hasard" : "dans le tirage au hasard"}${anims ? ` · ${anims}` : ""}`;
}

function ItemPreview({ kind, data }: { kind: Kind; data: Record<string, unknown> }) {
  if (kind === "phrase") return <span className="a-prev">💬</span>;
  if (kind === "sound") return <span className="a-prev">{String(data.icon ?? "🔊")}</span>;
  if (kind === "cup") return <span className="a-prev cup-prev"><Cup state="down" size="md" preview={{ skin: String(data.skin ?? "custom"), image: data.image as string | null }} /></span>;
  return <span className="a-prev">{String(data.icon ?? "🗺️")}</span>;
}

// ---------- formulaires ----------
function Editor({ kind, data, onChange, isNew }: { kind: Kind; data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; isNew: boolean }) {
  const set = (k: string, v: unknown) => onChange({ ...data, [k]: v });

  if (kind === "phrase")
    return (
      <div className="a-form">
        <Field label="Texte de la phrase (écrit exactement comme il s'affichera)">
          <input value={String(data.text ?? "")} maxLength={60} onChange={(e) => set("text", e.target.value)} />
        </Field>
        <FileField label="Enregistrement audio (facultatif)" kind="audio" value={data.audio as string} onChange={(v) => set("audio", v)}
          hint="MP3, OGG, WAV ou M4A, 700 Ko max. Sans fichier : voix de synthèse du téléphone." />
        <div className="a-preview">
          <span className="a-label">Aperçu</span>
          <div className="a-preview-seat">
            <div className="speech static">{String(data.text || "…")}</div>
            <Avatar name="Tom" avatar="gobelin" size={64} />
          </div>
          <button className="gbtn gbtn-dark gbtn-sm" onClick={() => { unlockAudio(); previewVoice(String(data.text ?? ""), data.audio as string); }}>▶ Écouter</button>
        </div>
      </div>
    );

  if (kind === "sound")
    return (
      <div className="a-form">
        <Field label="Nom du bruitage"><input value={String(data.label ?? "")} maxLength={24} onChange={(e) => set("label", e.target.value)} /></Field>
        <Field label="Icône">
          <div className="emoji-grid">
            {EMOJIS.map((e) => <button type="button" key={e} className={data.icon === e ? "on" : ""} onClick={() => set("icon", e)}>{e}</button>)}
            <input className="emoji-input" value={String(data.icon ?? "")} maxLength={4} onChange={(e) => set("icon", e.target.value)} aria-label="Autre emoji" />
          </div>
        </Field>
        <FileField label="Fichier audio" kind="audio" value={data.file as string} onChange={(v) => set("file", v)} hint="MP3, OGG, WAV ou M4A, 700 Ko max, idéalement moins de 3 secondes." />
        {!data.file && (
          <Field label="… ou un son d'origine (fabriqué par le navigateur)">
            <select value={String(data.synth ?? "")} onChange={(e) => set("synth", e.target.value || null)}>
              <option value="">— aucun —</option>
              {SOUNDS.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
            </select>
          </Field>
        )}
        <Field label={`Volume par défaut : ${Math.round(Number(data.volume ?? 1) * 100)} %`}>
          <input type="range" min={0.05} max={1} step={0.05} value={Number(data.volume ?? 1)} onChange={(e) => set("volume", Number(e.target.value))} />
        </Field>
        <Field label="Animation sur l'avatar">
          <select value={String(data.anim ?? "pop")} onChange={(e) => set("anim", e.target.value)}>
            <option value="shake">Vibration</option><option value="tomatoes">Tomates</option><option value="clap">Mains qui applaudissent</option>
            <option value="laugh">Emojis qui rient</option><option value="pop">Surprise</option><option value="sad">Larmes</option>
          </select>
        </Field>
        <button className="gbtn gbtn-dark gbtn-sm" onClick={() => { unlockAudio(); previewSound({ file: data.file as string, synth: data.synth as string, volume: Number(data.volume ?? 1) }); }}>▶ Écouter l&apos;aperçu</button>
      </div>
    );

  if (kind === "cup") {
    const cond = (data.cond ?? { type: "none" }) as { type: string; n?: number };
    const builtin = ["classic", "royal", "crystal", "infernal", "celestial", "tropical"];
    return (
      <div className="a-form a-form-split">
        <div>
          <Field label="Nom"><input value={String(data.name ?? "")} maxLength={24} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Description"><input value={String(data.description ?? "")} maxLength={140} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="Rareté">
            <select value={String(data.rarity ?? "commun")} onChange={(e) => set("rarity", e.target.value)}>
              <option value="commun">Commun</option><option value="rare">Rare</option><option value="épique">Épique</option><option value="légendaire">Légendaire</option>
            </select>
          </Field>
          <Field label="Condition de déblocage">
            <select value={cond.type} onChange={(e) => set("cond", { type: e.target.value, n: cond.n ?? 10 })}>
              <option value="none">Disponible dès le départ</option>
              <option value="wins">Nombre de victoires</option>
              <option value="played">Nombre de parties terminées</option>
              <option value="liarWins">Nombre de « Menteur ! » réussis</option>
              <option value="winStreak">Victoires d&apos;affilée</option>
            </select>
          </Field>
          {cond.type !== "none" && (
            <Field label="Nombre nécessaire"><input type="number" min={1} max={10000} value={cond.n ?? 10} onChange={(e) => set("cond", { ...cond, n: Number(e.target.value) })} /></Field>
          )}
          <p className="a-hint">Les joueurs qui ont déjà obtenu ce gobelet le gardent, même si tu durcis la condition. Seules les parties avec au moins 2 vrais joueurs comptent.</p>
          {isNew || !builtin.includes(String(data.skin)) ? (
            <FileField label="Illustration du gobelet" kind="image" value={data.image as string} onChange={(v) => onChange({ ...data, image: v, skin: "custom" })}
              hint="PNG ou WEBP à fond transparent, 512 × 512, 2,5 Mo max." />
          ) : (
            <FileField label="Illustration (remplace le dessin d'origine)" kind="image" value={data.image as string} onChange={(v) => set("image", v)} hint="Facultatif. PNG/WEBP transparent, 512 × 512." />
          )}
        </div>
        <div className="a-preview">
          <span className="a-label">Aperçu</span>
          <div className="cup-card"><div className="cup-stage"><Cup state="show" size="xl" preview={{ skin: String(data.skin ?? "custom"), image: data.image as string }} /></div><div className="cup-name">{String(data.name || "…")}</div></div>
          <span className="a-label">En jeu</span>
          <div className="a-felt"><Cup state="down" size="lg" preview={{ skin: String(data.skin ?? "custom"), image: data.image as string }} /></div>
        </div>
      </div>
    );
  }

  // map
  const anims = (data.anims as MapAnim[] | undefined) ?? [];
  const layers = (data.layers as string[] | undefined) ?? [];
  return (
    <div className="a-form a-form-split">
      <div>
        <Field label="Nom de la map"><input value={String(data.name ?? "")} maxLength={30} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Icône"><input value={String(data.icon ?? "")} maxLength={4} onChange={(e) => set("icon", e.target.value)} /></Field>
        <FileField label={data.scene ? "Image de fond (remplace le dessin d'origine)" : "Image de fond"} kind="image" value={data.image as string} onChange={(v) => set("image", v)}
          hint="2560 × 1440 conseillé, centre dégagé pour la table. 2,5 Mo max (WEBP recommandé)." />
        {[0, 1, 2].map((i) => (
          <FileField key={i} label={`Calque ${i + 1} (facultatif, PNG transparent par-dessus le fond)`} kind="image" value={layers[i]}
            onChange={(v) => { const next = [...layers]; if (v) next[i] = v; else next.splice(i, 1); set("layers", next.filter(Boolean)); }} />
        )).slice(0, Math.min(3, layers.length + 1))}
        <Field label="Animations d'ambiance">
          <div className="a-checks">
            {MAP_ANIMS.filter((a) => a !== "none").map((a) => (
              <label key={a}><input type="checkbox" checked={anims.includes(a)} onChange={(e) => set("anims", e.target.checked ? [...anims, a] : anims.filter((x) => x !== a))} />
                {{ embers: "Braises", sparkles: "Paillettes", float: "Lucioles", clouds: "Nuages", rain: "Pluie" }[a]}</label>
            ))}
          </div>
        </Field>
        <Field label="Couleur du tapis">
          <div className="a-row"><input type="color" value={String(data.felt ?? "#2f8a52")} onChange={(e) => set("felt", e.target.value)} />
            {data.felt ? <button type="button" className="a-link" onClick={() => set("felt", null)}>Couleur par défaut</button> : null}</div>
        </Field>
        <label className="a-check"><input type="checkbox" checked={data.random !== false} onChange={(e) => set("random", e.target.checked)} /> Peut être tirée au hasard</label>
      </div>
      <div className="a-preview">
        <span className="a-label">Aperçu avec la table</span>
        <div className="a-map-preview" style={data.felt ? ({ ["--felt" as string]: String(data.felt) } as CSSProperties) : undefined}>
          <Scene id="__preview__" contained override={{ scene: data.scene as string, image: data.image as string, layers, anims }} />
          <div className="a-mini-table"><div className="table-rail"><div className="table-felt" /></div></div>
        </div>
      </div>
    </div>
  );
}
