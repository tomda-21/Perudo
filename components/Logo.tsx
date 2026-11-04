// Le logo PERUDO : lettres dorées sur un panneau en bois, dés et couronne.
// Dessiné en SVG pour rester net à toutes les tailles.
import { assetUrl } from "@/lib/content";

export default function Logo({ size = "lg", image }: { size?: "sm" | "lg"; image?: string | null }) {
  if (image) return <div className={`logo-wrap logo-${size}`}><img src={assetUrl(image)!} alt="Perudo" /></div>;
  return (
    <div className={`logo-wrap logo-${size}`} aria-label="Perudo — bluff, dés et menteurs entre potes">
      <svg viewBox="0 0 520 260" role="img">
        <defs>
          <linearGradient id="lg-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff3b0" />
            <stop offset="0.45" stopColor="#ffd34d" />
            <stop offset="0.55" stopColor="#f2a516" />
            <stop offset="1" stopColor="#b86b06" />
          </linearGradient>
          <linearGradient id="lg-wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9a5d2e" />
            <stop offset="1" stopColor="#5a3114" />
          </linearGradient>
          <linearGradient id="lg-rim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe08a" />
            <stop offset="1" stopColor="#a86a10" />
          </linearGradient>
        </defs>
        {/* panneau en bois */}
        <path d="M40 70 Q260 40 480 70 L470 178 Q260 205 50 178 Z" fill="url(#lg-wood)" stroke="url(#lg-rim)" strokeWidth="7" />
        <path d="M70 92 Q260 70 450 92" stroke="#3b1e0b" strokeWidth="3" fill="none" opacity="0.35" />
        <path d="M66 150 Q260 172 456 150" stroke="#3b1e0b" strokeWidth="3" fill="none" opacity="0.35" />
        {/* clous dorés */}
        {[[62, 86], [458, 86], [66, 166], [454, 166]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="6" fill="url(#lg-rim)" stroke="#5a3114" strokeWidth="2" />)}
        {/* lettres */}
        <text x="260" y="160" textAnchor="middle" className="logo-letters" fontSize="104" stroke="#4a2208" strokeWidth="16" strokeLinejoin="round" fill="#4a2208">PERUDO</text>
        <text x="260" y="160" textAnchor="middle" className="logo-letters" fontSize="104" fill="url(#lg-gold)" stroke="#fff6c8" strokeWidth="1.5">PERUDO</text>
        {/* dés */}
        <g transform="translate(196 6) rotate(-14)">
          <rect width="54" height="54" rx="11" fill="#fffdf6" stroke="#c9bfa8" strokeWidth="2" />
          {[[14, 14], [40, 14], [27, 27], [14, 40], [40, 40]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" fill="#222" />)}
        </g>
        <g transform="translate(262 4) rotate(12)">
          <rect width="50" height="50" rx="10" fill="#fffdf6" stroke="#c9bfa8" strokeWidth="2" />
          {[[13, 13], [37, 13], [13, 37], [37, 37]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" fill="#222" />)}
        </g>
        {/* couronne */}
        <g transform="translate(400 18) rotate(16)">
          <path d="M0 40 L6 8 L22 26 L34 0 L46 26 L62 8 L68 40 Z" fill="url(#lg-gold)" stroke="#8a4f06" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="34" cy="30" r="5" fill="#e0314b" />
        </g>
        {/* sous-titre sur une planche */}
        <path d="M120 196 L400 196 L392 246 L128 246 Z" fill="#e9c98f" stroke="#8a5a2b" strokeWidth="4" />
        <text x="260" y="218" textAnchor="middle" className="logo-sub" fontSize="20" fill="#4a2a10">Bluff, dés et menteurs</text>
        <text x="260" y="240" textAnchor="middle" className="logo-sub" fontSize="20" fill="#4a2a10">entre potes !</text>
      </svg>
    </div>
  );
}
