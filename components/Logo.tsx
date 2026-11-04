// Le logo PERUDO : l'illustration officielle (panneau en bois, lettres dorées,
// dés et couronne). L'admin peut le remplacer par un autre fichier (Apparence).
import { assetUrl } from "@/lib/content";

export const LOGO_SRC = "/art/home/logo.webp";

export default function Logo({ size = "lg", image, shine = false }: { size?: "sm" | "lg"; image?: string | null; shine?: boolean }) {
  const src = image ? assetUrl(image)! : LOGO_SRC;
  return (
    <div className={`logo-wrap logo-${size} ${shine ? "logo-shine" : ""}`} aria-label="Perudo" role="img"
      style={shine ? ({ ["--logo-mask" as string]: `url(${src})` }) : undefined}>
      <img src={src} alt="Perudo" draggable={false} />
      {shine && <span className="logo-glint" aria-hidden="true" />}
    </div>
  );
}
