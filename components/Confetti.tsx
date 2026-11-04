// Confettis de victoire, en CSS pur (légers pour les téléphones).
const COLORS = ["#e8b04a", "#f28482", "#5fa8d3", "#81b29a", "#f2cc8f", "#9c89b8"];

export default function Confetti({ count = 60 }: { count?: number }) {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        // valeurs pseudo-aléatoires mais stables (pas de Math.random au rendu)
        const r = (k: number) => ((i * 9301 + k * 49297) % 233280) / 233280;
        return (
          <span
            key={i}
            style={{
              left: `${r(1) * 100}%`,
              background: COLORS[i % COLORS.length],
              animationDelay: `${r(2) * 0.8}s`,
              animationDuration: `${2.2 + r(3) * 1.6}s`,
              transform: `rotate(${r(4) * 360}deg)`,
              width: `${6 + r(5) * 6}px`,
              height: `${8 + r(6) * 8}px`,
            }}
          />
        );
      })}
    </div>
  );
}
