// Contenus publiés, lus depuis la base (avec un petit cache de 20 s).
import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { srv } from "./srv";
import {
  Appearance, ChallengeItem, cleanAppearance, cleanEconomy, cleanSettings, CupItem, DEFAULT_CONTENT, FrameItem, GameSettings, MapItem,
  PhraseItem, PublicContent, ReactionItem, SoundItem, Status, VictoryItem,
} from "./content";

export type Kind = "phrase" | "sound" | "cup" | "map" | "reaction" | "frame" | "victory" | "challenge";
export type Row = { kind: Kind; id: string; data: Record<string, unknown>; sort: number; status: Status; updated_at: string };
type SettingsRow = Record<string, { draft: unknown; published: unknown; updated_at: string }>;

/** Au premier passage dans l'admin, on copie le contenu d'origine dans la base. */
export async function seedIfEmpty(actor: string) {
  const rows = await srv<Row[]>("content_list", { all: true });
  const has = new Set(rows.map((r) => r.kind));
  const put = (kind: Row["kind"], items: { id: string }[]) =>
    Promise.all(items.map(({ id, ...data }, i) => srv("content_put", { kind, id, data, sort: i, status: "published", actor: null })));
  if (!has.has("phrase")) await put("phrase", DEFAULT_CONTENT.phrases);
  if (!has.has("sound")) await put("sound", DEFAULT_CONTENT.sounds);
  if (!has.has("cup")) await put("cup", DEFAULT_CONTENT.cups);
  if (!has.has("map")) await put("map", DEFAULT_CONTENT.maps);
  if (!has.has("reaction")) await put("reaction", DEFAULT_CONTENT.reactions);
  if (!has.has("frame")) await put("frame", DEFAULT_CONTENT.frames);
  if (!has.has("victory")) await put("victory", DEFAULT_CONTENT.victories);
  if (!has.has("challenge")) await put("challenge", DEFAULT_CONTENT.challenges);
  void actor;
}

async function load(): Promise<PublicContent> {
  const [rows, settings] = await Promise.all([srv<Row[]>("content_list", { all: true }), srv<SettingsRow>("settings_get")]);
  // une catégorie jamais remplie dans la base = contenu d'origine ;
  // sinon, uniquement ce qui est publié (brouillons et désactivés exclus)
  const of = <T>(kind: Row["kind"], def: T[]): T[] => {
    const all = rows.filter((r) => r.kind === kind);
    if (!all.length) return def;
    return all.filter((r) => r.status === "published").sort((a, b) => a.sort - b.sort).map((r) => ({ id: r.id, ...r.data }) as T);
  };
  const sp = settings.game?.published as Record<string, unknown> | undefined;
  const ap = settings.appearance?.published as Record<string, unknown> | undefined;
  const ep = settings.economy?.published as Record<string, unknown> | undefined;
  let economy = DEFAULT_CONTENT.economy;
  try { if (ep) economy = cleanEconomy(ep); } catch (e) { console.error("economy", e); }
  return {
    phrases: of<PhraseItem>("phrase", DEFAULT_CONTENT.phrases),
    sounds: of<SoundItem>("sound", DEFAULT_CONTENT.sounds),
    cups: of<CupItem>("cup", DEFAULT_CONTENT.cups),
    maps: of<MapItem>("map", DEFAULT_CONTENT.maps),
    reactions: of<ReactionItem>("reaction", DEFAULT_CONTENT.reactions),
    frames: of<FrameItem>("frame", DEFAULT_CONTENT.frames),
    victories: of<VictoryItem>("victory", DEFAULT_CONTENT.victories),
    challenges: of<ChallengeItem>("challenge", DEFAULT_CONTENT.challenges),
    economy,
    settings: sp ? cleanSettings(sp) : DEFAULT_CONTENT.settings,
    appearance: ap ? cleanAppearance(ap) : DEFAULT_CONTENT.appearance,
  };
}

const cached = unstable_cache(load, ["public-content-v3"], { revalidate: 20, tags: ["content"] });

/** Contenu publié ; en cas de souci avec la base, le contenu d'origine. */
export async function publicContent(): Promise<PublicContent> {
  try { return await cached(); } catch (e) { console.error(e); return DEFAULT_CONTENT; }
}
export async function gameSettings(): Promise<GameSettings> { return (await publicContent()).settings; }
export async function appearance(): Promise<Appearance> { return (await publicContent()).appearance; }
export const refreshContent = () => revalidateTag("content");
