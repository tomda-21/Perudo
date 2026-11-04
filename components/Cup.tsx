"use client";
// Un gobelet de Perudo. Les 6 modèles d'origine sont dessinés en CSS ;
// un gobelet créé dans l'admin utilise son illustration importée.
import { useContent } from "@/lib/content-client";
import { assetUrl } from "@/lib/content";
import { CUPS } from "@/lib/catalog";

type Props = {
  state: "down" | "shake" | "lifted" | "show";
  size?: "sm" | "md" | "lg" | "xl";
  skin?: string; // identifiant du gobelet
  onClick?: () => void;
  label?: string;
  preview?: { skin: string; image?: string | null }; // aperçu dans l'admin (avant publication)
};

const BUILTIN = ["classic", "royal", "crystal", "infernal", "celestial", "tropical"];

export default function Cup({ state, size = "sm", skin = "classic", onClick, label, preview }: Props) {
  const { cups } = useContent();
  const item = preview ? { skin: preview.skin, image: preview.image ?? null } : cups.find((c) => c.id === skin);
  const css = item ? (BUILTIN.includes(item.skin) ? item.skin : "custom") : BUILTIN.includes(skin) ? skin : "classic";
  const img = item?.image ? assetUrl(item.image) : CUPS.find((c) => c.id === skin)?.art ? `/art/cups/${skin}.webp` : null;
  const cls = `cup cup-${size} cup-${state} skin-${css} ${img ? "has-art" : ""}`;
  const inner = (
    <>
      <span className="cup-body" />
      <span className="cup-rim" />
      <span className="cup-band" />
      <span className="cup-deco" />
      {img && <span className="cup-art" style={{ backgroundImage: `url(${img})` }} />}
    </>
  );
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} aria-label={label ?? "Gobelet"}>{inner}</button>
  ) : (
    <span className={cls} aria-hidden="true">{inner}</span>
  );
}
