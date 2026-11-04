// Animations de victoire (purement décoratives). « confetti » est gratuite,
// les autres s'achètent dans la boutique. Tout en CSS : léger sur téléphone.
import Confetti from "./Confetti";

const r = (i: number, k: number) => ((i * 9301 + k * 49297) % 233280) / 233280;

export default function Victory({ style = "confetti" }: { style?: string }) {
  if (style === "confetti") return <Confetti />;
  const items: Record<string, { n: number; char: string[]; cls: string }> = {
    fireworks: { n: 10, char: [""], cls: "vfx-firework" },
    goldrain: { n: 40, char: ["🪙", "💰", "✨"], cls: "vfx-fall" },
    hearts: { n: 32, char: ["❤️", "💖", "💛", "💜"], cls: "vfx-rise" },
    stars: { n: 14, char: ["⭐"], cls: "vfx-shoot" },
  };
  const it = items[style] ?? items.goldrain;
  return (
    <div className={`vfx vfx-${style}`} aria-hidden="true">
      {Array.from({ length: it.n }, (_, i) => (
        <span key={i} className={it.cls} style={{
          left: `${r(i, 1) * 100}%`, top: style === "fireworks" ? `${10 + r(i, 7) * 45}%` : style === "stars" ? `${r(i, 7) * 40}%` : undefined,
          animationDelay: `${r(i, 2) * (style === "fireworks" ? 2.4 : 1.4)}s`,
          animationDuration: `${(style === "fireworks" ? 1.3 : 2.4) + r(i, 3) * 1.4}s`,
          fontSize: `${18 + r(i, 4) * 18}px`,
          ["--hue" as string]: `${Math.round(r(i, 5) * 360)}`,
        }}>{it.char[i % it.char.length]}</span>
      ))}
    </div>
  );
}
