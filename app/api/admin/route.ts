// =============================================================
//  API de l'espace admin. CHAQUE appel passe par requireAdmin :
//  cookie signé valide + rôle « admin » revérifié en base.
//  Toute écriture est enregistrée dans le journal d'audit.
// =============================================================
import { AdminError, requireAdmin } from "@/lib/admin";
import { srv, srv2, srv3, srv5, srv6 } from "@/lib/srv";
import { accountOf } from "@/lib/account";
import { EconomyError, levelOf } from "@/lib/economy";
import { catalogOf, ItemType } from "@/lib/progression";
import { publicContent, refreshContent, Row, seedIfEmpty } from "@/lib/content-server";
import {
  cleanAppearance, cleanChallenge, cleanCup, cleanEconomy, cleanFrame, cleanMap, cleanPhrase, cleanReaction, cleanSettings, cleanSound,
  cleanVictory, ContentError, slug, Status,
} from "@/lib/content";

export const dynamic = "force-dynamic";

const CLEAN = {
  phrase: cleanPhrase, sound: cleanSound, cup: cleanCup, map: cleanMap,
  reaction: cleanReaction, frame: cleanFrame, victory: cleanVictory, challenge: cleanChallenge,
} as const;
type SettingKey = "game" | "appearance" | "economy";
const settingKey = (k: unknown): SettingKey | null => (k === "game" || k === "appearance" || k === "economy" ? k : null);
const cleanSetting = (k: SettingKey, d: Record<string, unknown>) =>
  k === "game" ? cleanSettings(d) : k === "appearance" ? cleanAppearance(d) : cleanEconomy(d);
type Kind = keyof typeof CLEAN;
const isKind = (k: unknown): k is Kind => typeof k === "string" && k in CLEAN;
const STATUSES: Status[] = ["draft", "published", "disabled"];

function fail(e: unknown) {
  if (e instanceof AdminError) return Response.json({ error: e.message }, { status: e.status });
  if (e instanceof ContentError || e instanceof EconomyError) return Response.json({ error: e.message }, { status: 400 });
  console.error(e);
  return Response.json({ error: "Erreur serveur" }, { status: 500 });
}

async function run(op: string, b: Record<string, unknown>, actor: string) {
  switch (op) {
    case "overview":
      return srv("overview");

    case "content_list": {
      await seedIfEmpty(actor);
      return srv<Row[]>("content_list", { all: true });
    }

    case "content_save": {
      if (!isKind(b.kind)) throw new ContentError("Type de contenu inconnu");
      const data = CLEAN[b.kind]((b.data ?? {}) as Record<string, unknown>);
      const status = STATUSES.includes(b.status as Status) ? (b.status as Status) : "draft";
      const rows = await srv<Row[]>("content_list", { all: true });
      let id = typeof b.id === "string" && b.id ? b.id : "";
      const exists = rows.some((r) => r.kind === b.kind && r.id === id);
      if (!exists) {
        // nouvel élément : identifiant lisible et unique
        const base = slug(String((data as { name?: string; label?: string; text?: string }).name ?? (data as { label?: string }).label ?? (data as { text?: string }).text ?? b.kind));
        id = base; let i = 2;
        while (rows.some((r) => r.kind === b.kind && r.id === id)) id = `${base}-${i++}`;
      }
      const sort = exists ? rows.find((r) => r.kind === b.kind && r.id === id)!.sort : rows.filter((r) => r.kind === b.kind).length;
      await srv("content_put", { kind: b.kind, id, data, sort, status, actor });
      refreshContent();
      return { id };
    }

    case "content_delete": {
      if (!isKind(b.kind) || typeof b.id !== "string") throw new ContentError("Élément inconnu");
      if (b.confirm !== b.id) throw new ContentError("Confirmation manquante");
      await srv("content_delete", { kind: b.kind, id: b.id, actor });
      refreshContent();
      return { ok: true };
    }

    case "content_reorder": {
      if (!isKind(b.kind) || !Array.isArray(b.ids)) throw new ContentError("Ordre invalide");
      await srv("content_reorder", { kind: b.kind, ids: b.ids.map(String), actor });
      refreshContent();
      return { ok: true };
    }

    case "content_history":
      return srv("content_history", { kind: String(b.kind), id: String(b.id) });

    case "content_revert": {
      // revenir à une version précédente = la ré-enregistrer comme nouvelle version
      const h = await srv<{ kind: string; id: string; data: Record<string, unknown>; status: Status; sort: number } | null>("history_get", { hid: Number(b.hid) });
      if (!h) throw new ContentError("Version introuvable");
      if (h.kind === "settings") {
        const key = settingKey(h.id);
        if (!key) throw new ContentError("Réglage inconnu");
        await srv("settings_put", { key, draft: cleanSetting(key, h.data), publish: true, actor });
      } else if (isKind(h.kind)) {
        await srv("content_put", { kind: h.kind, id: h.id, data: CLEAN[h.kind](h.data), sort: h.sort ?? 0, status: h.status ?? "draft", actor });
      }
      refreshContent();
      return { ok: true };
    }

    case "settings_get":
      return srv("settings_get");

    case "settings_save": {
      const key = settingKey(b.key);
      if (!key) throw new ContentError("Réglage inconnu");
      const draft = cleanSetting(key, (b.draft ?? {}) as Record<string, unknown>);
      await srv("settings_put", { key, draft, publish: b.publish === true, actor });
      refreshContent();
      return { ok: true, draft };
    }

    case "settings_history":
      return srv("content_history", { kind: "settings", id: settingKey(b.key) ?? "game" });

    case "players_search":
      return srv("players_search", { q: String(b.q ?? "").slice(0, 40) });

    case "player_get":
      return srv("player_get", { id: String(b.id) });

    case "player_block": {
      const reason = String(b.reason ?? "").trim().slice(0, 200);
      if (b.blocked === true && !reason) throw new ContentError("Indique la raison du blocage");
      if (b.confirm !== true) throw new ContentError("Confirmation manquante");
      const ok = await srv<boolean>("player_block", { id: String(b.id), blocked: b.blocked === true, reason, actor });
      if (!ok) throw new ContentError("Impossible de bloquer un administrateur");
      return { ok: true };
    }

    case "audit":
      return srv("audit_list");

    // ---------- signalements des joueurs ----------
    case "reports":
      return srv6("reports_list");
    case "report_handled": {
      await srv6("report_handled", { id: Number(b.id) });
      await srv3("audit_add", { actor, action: "report.handled", target: String(b.id), detail: null });
      return { ok: true };
    }

    // ---------- économie ----------
    case "econ_stats": {
      const [econ, global] = await Promise.all([srv2<Record<string, unknown>>("econ_stats"), srv5<Record<string, number>>("admin_stats")]);
      return { ...econ, global };
    }

    case "player_wallet": {
      const id = String(b.id);
      const [account, wallet, c] = await Promise.all([accountOf(id), srv2<{ wallet: { xp: number } }>("wallet", { profile_id: id }), publicContent()]);
      return { account, wallet, level: levelOf(c.economy, wallet.wallet.xp) };
    }

    case "player_grant": {
      // ajustement manuel (compensation, correction, objet offert) : toujours tracé
      const reason = String(b.reason ?? "").trim().slice(0, 200);
      if (!reason) throw new ContentError("Indique la raison de l'ajustement");
      if (b.confirm !== true) throw new ContentError("Confirmation manquante");
      const doblons = Math.round(Number(b.doblons) || 0), fragments = Math.round(Number(b.fragments) || 0), xp = Math.round(Number(b.xp) || 0);
      if (Math.abs(doblons) > 100000 || Math.abs(fragments) > 100 || Math.abs(xp) > 1_000_000) throw new ContentError("Montant trop grand");
      const id = String(b.id);
      // § 74 : jamais d'XP administrative sur son propre compte (aussi refusé en base)
      if (xp && id === actor) throw new ContentError("Tes XP se gagnent en jouant : impossible de t'en attribuer");
      const c = await publicContent();
      const items: { type: ItemType; id: string }[] = [];
      if (b.item && typeof b.item === "object") {
        const it = b.item as { type?: string; id?: string };
        const type = it.type as ItemType;
        const pool = type === "cup" ? c.cups.map((x) => ({ id: x.id })) : ["frame", "victory"].includes(String(type)) ? catalogOf(c, type) : [];
        if (!pool.some((x) => x.id === it.id)) throw new ContentError("Objet inconnu");
        items.push({ type, id: String(it.id) });
      }
      if (!doblons && !fragments && !xp && !items.length) throw new ContentError("Rien à ajuster");
      if (!(await accountOf(id))) throw new ContentError("Ce joueur n'a pas de compte");
      const r = await srv5<string>("admin_adjust", { profile_id: id, doblons, fragments, xp, items, detail: { reason, by: actor, items } });
      if (r === "self_xp") throw new ContentError("Tes XP se gagnent en jouant : impossible de t'en attribuer");
      if (r === "negative") throw new ContentError("Le solde (Doblons, fragments ou XP) ne peut pas devenir négatif");
      await srv3("audit_add", { actor, action: "economy.grant", target: id, detail: { doblons, fragments, xp, items, reason } });
      return { ok: true };
    }

  }
  throw new ContentError("Opération inconnue");
}

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin(req);
    const op = new URL(req.url).searchParams.get("op") ?? "overview";
    if (!["overview", "content_list", "settings_get", "audit", "econ_stats"].includes(op)) throw new ContentError("Opération inconnue");
    return Response.json(await run(op, {}, admin.id));
  } catch (e) { return fail(e); }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return Response.json(await run(String(body.op ?? ""), body, admin.id));
  } catch (e) { return fail(e); }
}
