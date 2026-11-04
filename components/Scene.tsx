// =============================================================
//  Décors (maps) — illustrations PROVISOIRES dessinées en SVG animé.
//  Dès qu'une vraie illustration est déposée (voir ASSETS.md), elle
//  s'affiche par-dessus automatiquement : rien d'autre à changer.
// =============================================================
"use client";
import { HOME_ART, MAPS } from "@/lib/catalog";
import { assetUrl, MapAnim } from "@/lib/content";
import { useContent } from "@/lib/content-client";

export type SceneId = string; // "casino" (accueil) ou l'identifiant d'une map

const BUILTIN = ["casino", "beach", "hell", "heaven", "street"];

/**
 * Un décor = (1) le dessin d'origine si la map en a un, (2) l'image de fond
 * importée dans l'admin, (3) des calques par-dessus, (4) des animations prédéfinies.
 */
export default function Scene({ id, override, contained }: { id: SceneId; override?: { image?: string | null; layers?: string[]; anims?: MapAnim[]; scene?: string | null }; contained?: boolean }) {
  const { maps, appearance } = useContent();
  const m = override ?? maps.find((x) => x.id === id);
  const scene = id === "casino" ? "casino" : m?.scene ?? (m ? null : BUILTIN.includes(id) ? id : "beach");
  let image: string | null = null;
  if (id === "casino") image = appearance.homeBackground ? assetUrl(appearance.homeBackground) : HOME_ART.art ? HOME_ART.background : null;
  else if (m?.image) image = assetUrl(m.image);
  else { const b = MAPS.find((x) => x.id === scene); if (b?.art) image = b.image; }
  const anims = (m && "anims" in m ? m.anims : []) ?? [];
  return (
    <div className={`scene scene-${scene ?? "custom"} ${contained ? "scene-contained" : ""}`} aria-hidden="true">
      {scene && (
        <svg className="scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
          {scene === "casino" && <Casino />}
          {scene === "beach" && <Beach />}
          {scene === "hell" && <Hell />}
          {scene === "heaven" && <Heaven />}
          {scene === "street" && <Street />}
        </svg>
      )}
      {image && <div className="scene-photo" style={{ backgroundImage: `url(${image})` }} />}
      {(m?.layers ?? []).map((l) => <div key={l} className="scene-photo scene-layer" style={{ backgroundImage: `url(${assetUrl(l)})` }} />)}
      {anims.length > 0 && (
        <svg className="scene-svg scene-fx" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
          {anims.includes("embers") && <Particles n={40} color="#ffb347" cls="ember" area={[0, 400, 1600, 500]} />}
          {anims.includes("sparkles") && <Particles n={40} color="#fff2a8" cls="sparkle" />}
          {anims.includes("float") && <Particles n={30} color="#ffe9a6" cls="float" />}
          {anims.includes("rain") && <Particles n={70} color="#cfe6ff" cls="rain" area={[0, -100, 1600, 900]} />}
          {anims.includes("clouds") && <><Cloud x={300} y={160} s={1.2} fill="rgba(255,255,255,0.7)" /><Cloud x={1250} y={120} s={1} fill="rgba(255,255,255,0.6)" /></>}
        </svg>
      )}
      <div className="scene-vignette" />
    </div>
  );
}

// ---------- éléments réutilisables ----------
function Palm({ x, y, s = 1, flip = false, delay = 0 }: { x: number; y: number; s?: number; flip?: boolean; delay?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <path d="M0 0 C 10 -120, 30 -230, 70 -330" stroke="#5b3a1d" strokeWidth="22" fill="none" strokeLinecap="round" />
      <path d="M0 0 C 10 -120, 30 -230, 70 -330" stroke="#7a5230" strokeWidth="10" fill="none" strokeDasharray="6 18" strokeLinecap="round" />
      <g className="sway" style={{ animationDelay: `${delay}s`, transformOrigin: "70px -330px" }}>
        {[-150, -110, -60, -10, 30, 70].map((r, i) => (
          <path key={i} transform={`translate(70 -330) rotate(${r})`} d="M0 0 C 60 -30, 130 -20, 190 30 C 130 0, 60 0, 0 0" fill={i % 2 ? "#1f7a3f" : "#2b9a4e"} stroke="#145a2c" strokeWidth="2" />
        ))}
        <circle cx="64" cy="-322" r="12" fill="#6b4220" /><circle cx="80" cy="-318" r="11" fill="#5b3a1d" />
      </g>
    </g>
  );
}

function Lights({ x1, y1, x2, y2, n = 10, colors = ["#ffd36b"] }: { x1: number; y1: number; x2: number; y2: number; n?: number; colors?: string[] }) {
  const mx = (x1 + x2) / 2, my = Math.max(y1, y2) + 60;
  const pts = Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    return [(1 - t) ** 2 * x1 + 2 * (1 - t) * t * mx + t * t * x2, (1 - t) ** 2 * y1 + 2 * (1 - t) * t * my + t * t * y2];
  });
  return (
    <g>
      <path d={`M${x1} ${y1} Q${mx} ${my + 60} ${x2} ${y2}`} stroke="#2a1a10" strokeWidth="3" fill="none" />
      {pts.map(([x, y], i) => (
        <g key={i} className="twinkle" style={{ animationDelay: `${(i * 0.37) % 2}s` }}>
          <circle cx={x} cy={y + 8} r="16" fill={colors[i % colors.length]} opacity="0.25" />
          <circle cx={x} cy={y + 8} r="6" fill={colors[i % colors.length]} />
        </g>
      ))}
    </g>
  );
}

function Particles({ n, color, cls, area = [0, 0, 1600, 900] }: { n: number; color: string; cls: string; area?: number[] }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const r = (k: number) => ((i * 7919 + k * 104729) % 1000) / 1000;
        return (
          <circle key={i} className={cls} cx={area[0] + r(1) * area[2]} cy={area[1] + r(2) * area[3]} r={1.5 + r(3) * 3}
            fill={color} style={{ animationDelay: `${r(4) * 6}s`, animationDuration: `${4 + r(5) * 5}s` }} />
        );
      })}
    </g>
  );
}

function Sunset({ top, mid, low }: { top: string; mid: string; low: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`sky-${top.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} /><stop offset="0.55" stopColor={mid} /><stop offset="1" stopColor={low} />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill={`url(#sky-${top.slice(1)})`} />
    </>
  );
}

function Cloud({ x, y, s = 1, fill = "#ffffff", cls = "drift" }: { x: number; y: number; s?: number; fill?: string; cls?: string }) {
  return (
    <g className={cls} style={{ animationDelay: `${(x % 7) * -3}s` }}>
      <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
        <ellipse cx="0" cy="0" rx="90" ry="34" /><ellipse cx="-50" cy="8" rx="60" ry="26" /><ellipse cx="55" cy="6" rx="70" ry="28" /><ellipse cx="10" cy="-22" rx="55" ry="32" />
      </g>
    </g>
  );
}

function Sea({ y, c1, c2, glint }: { y: number; c1: string; c2: string; glint: string }) {
  return (
    <g>
      <rect x="0" y={y} width="1600" height={900 - y} fill={c1} />
      <rect x="0" y={y + 60} width="1600" height={900 - y} fill={c2} opacity="0.6" />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} className="wave" style={{ animationDelay: `${i * 0.8}s` }}
          d={`M-100 ${y + 20 + i * 26} q 50 -10 100 0 t 100 0 t 100 0 t 100 0 t 100 0 t 100 0 t 100 0 t 100 0 t 100 0 t 100 0 t 100 0 t 100 0 t 100 0 t 100 0 t 100 0 t 100 0 t 100 0 t 100 0`}
          stroke={glint} strokeWidth="3" fill="none" opacity={0.5 - i * 0.1} />
      ))}
    </g>
  );
}

// ---------- ACCUEIL : casino tropical ----------
function Casino() {
  return (
    <g>
      <Sunset top="#3b1b6b" mid="#c2477a" low="#ffb35c" />
      <circle cx="820" cy="470" r="120" fill="#ffd27a" opacity="0.9" />
      <circle cx="820" cy="470" r="190" fill="#ffd27a" opacity="0.15" className="pulse-slow" />
      <Cloud x={300} y={160} s={1.1} fill="#f7a6c1" /><Cloud x={1250} y={120} s={0.9} fill="#f6b3d0" />
      <Sea y={520} c1="#3a3c8f" c2="#2a2470" glint="#ffc98a" />
      {/* casino à droite */}
      <g transform="translate(1080 210)">
        <rect x="0" y="120" width="420" height="380" fill="#6a2a5a" stroke="#2a0f24" strokeWidth="6" />
        <rect x="40" y="250" width="70" height="110" rx="35" fill="#ffcf6b" opacity="0.85" />
        <rect x="310" y="250" width="70" height="110" rx="35" fill="#ffcf6b" opacity="0.85" />
        <path d="M150 500 L150 330 Q210 260 270 330 L270 500 Z" fill="#3a1630" stroke="#d6a13a" strokeWidth="8" />
        <path d="M-20 130 L210 20 L440 130 Z" fill="#8a2f6e" stroke="#2a0f24" strokeWidth="6" />
        <rect x="70" y="60" width="280" height="110" rx="18" fill="#b8204e" stroke="#ffd36b" strokeWidth="8" />
        <text x="210" y="112" textAnchor="middle" fontSize="54" className="scene-sign">PERUDO</text>
        <text x="210" y="154" textAnchor="middle" fontSize="34" className="scene-sign">CASINO</text>
        {Array.from({ length: 16 }, (_, i) => (
          <circle key={i} className="marquee" style={{ animationDelay: `${(i % 4) * 0.25}s` }} cx={80 + i * 17.5} cy={66} r="5" fill="#fff2b0" />
        ))}
        <rect x="120" y="500" width="180" height="20" fill="#d6a13a" />
      </g>
      <Palm x={960} y={780} s={1.0} delay={0.4} />
      <Palm x={1560} y={800} s={1.25} flip delay={1.1} />
      {/* cabane tiki à gauche */}
      <g transform="translate(40 300)">
        <path d="M0 140 L170 30 L340 140 Z" fill="#c98b3a" stroke="#6b4220" strokeWidth="6" />
        {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${20 + i * 36} 140 l 10 30`} stroke="#8a5a2b" strokeWidth="5" />)}
        <rect x="40" y="140" width="20" height="260" fill="#6b4220" /><rect x="280" y="140" width="20" height="260" fill="#6b4220" />
        <g className="twinkle"><rect x="150" y="175" width="40" height="56" rx="10" fill="#ffcf6b" /><circle cx="170" cy="203" r="44" fill="#ffcf6b" opacity="0.25" /></g>
      </g>
      <Palm x={110} y={820} s={1.2} delay={0.2} />
      <Lights x1={0} y1={150} x2={760} y2={110} n={12} colors={["#ffd36b", "#ff9e6b", "#ffe9a6"]} />
      <Lights x1={900} y1={120} x2={1600} y2={200} n={11} colors={["#ffd36b", "#ff7aa8", "#9be7ff"]} />
      <Particles n={40} color="#ffe9a6" cls="float" />
      {/* premier plan : comptoir en bois avec des dés */}
      <path d="M0 800 Q800 760 1600 800 L1600 900 L0 900 Z" fill="#4a2a14" />
      <path d="M0 800 Q800 760 1600 800" stroke="#7a4a24" strokeWidth="10" fill="none" />
      <g className="dice-hop"><g transform="translate(230 780) rotate(-12)"><rect width="60" height="60" rx="12" fill="#fffdf6" /><circle cx="16" cy="16" r="6" /><circle cx="44" cy="44" r="6" /><circle cx="30" cy="30" r="6" /></g></g>
      <g transform="translate(1320 790) rotate(18)"><rect width="56" height="56" rx="11" fill="#fffdf6" /><circle cx="15" cy="15" r="5.5" /><circle cx="41" cy="15" r="5.5" /><circle cx="15" cy="41" r="5.5" /><circle cx="41" cy="41" r="5.5" /></g>
    </g>
  );
}

// ---------- PLAGE ----------
function Beach() {
  return (
    <g>
      <Sunset top="#4b2a86" mid="#ff7a7a" low="#ffcf7a" />
      <circle cx="800" cy="440" r="110" fill="#ffe08a" />
      <Cloud x={260} y={170} fill="#ffc0cf" /><Cloud x={1200} y={130} s={0.8} fill="#ffd0de" /><Cloud x={780} y={90} s={0.6} fill="#ffe1ea" />
      <Sea y={470} c1="#2f6fb0" c2="#1f4f8f" glint="#ffe6b0" />
      <path d="M0 700 Q400 640 800 690 T1600 680 L1600 900 L0 900 Z" fill="#f2c98a" />
      <path d="M0 700 Q400 640 800 690 T1600 680" className="foam" stroke="#ffffff" strokeWidth="8" fill="none" opacity="0.7" />
      <Palm x={120} y={760} s={1.3} delay={0.3} /><Palm x={300} y={720} s={0.9} delay={0.9} />
      <Palm x={1480} y={760} s={1.3} flip delay={0.6} /><Palm x={1320} y={710} s={0.85} flip delay={1.4} />
      <g transform="translate(1150 420)">
        <path d="M0 110 L120 30 L240 110 Z" fill="#d49a48" stroke="#6b4220" strokeWidth="5" />
        <rect x="30" y="110" width="14" height="150" fill="#6b4220" /><rect x="196" y="110" width="14" height="150" fill="#6b4220" />
        <g className="twinkle"><circle cx="120" cy="150" r="14" fill="#ffcf6b" /><circle cx="120" cy="150" r="36" fill="#ffcf6b" opacity="0.25" /></g>
      </g>
      <Lights x1={0} y1={120} x2={1600} y2={140} n={18} colors={["#ffd36b", "#ff9e6b"]} />
      <Particles n={24} color="#fff2c0" cls="float" area={[0, 200, 1600, 400]} />
    </g>
  );
}

// ---------- ENFER ----------
function Hell() {
  return (
    <g>
      <Sunset top="#1a0505" mid="#6b0f0a" low="#e0461b" />
      <path d="M0 520 L180 300 L300 420 L460 220 L640 520 Z" fill="#2a0d08" />
      <path d="M900 520 L1100 240 L1250 380 L1420 180 L1600 520 Z" fill="#2a0d08" />
      {/* coulées de lave */}
      <path className="lava-glow" d="M460 220 C 470 300, 430 380, 470 520" stroke="#ff7a1a" strokeWidth="14" fill="none" />
      <path className="lava-glow" style={{ animationDelay: "0.8s" }} d="M1420 180 C 1400 280, 1450 380, 1410 520" stroke="#ff9a2a" strokeWidth="12" fill="none" />
      <circle className="pulse-slow" cx="460" cy="215" r="40" fill="#ff7a1a" opacity="0.5" />
      <circle className="pulse-slow" cx="1420" cy="175" r="40" fill="#ff7a1a" opacity="0.5" />
      <rect y="520" width="1600" height="380" fill="#3a0f08" />
      <path className="lava-flow" d="M0 640 Q300 600 600 650 T1200 640 T1600 650 L1600 720 Q1200 700 800 730 T0 720 Z" fill="#ff5a14" />
      <path d="M0 660 Q400 630 800 670 T1600 660" stroke="#ffd36b" strokeWidth="4" fill="none" className="lava-glow" />
      {[[120, 780, 90], [380, 820, 60], [1250, 800, 80], [1480, 760, 110]].map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.55} fill="#1e0804" stroke="#5a1a0c" strokeWidth="4" />
      ))}
      <Particles n={46} color="#ffb347" cls="ember" area={[0, 400, 1600, 500]} />
    </g>
  );
}

// ---------- PARADIS ----------
function Heaven() {
  return (
    <g>
      <Sunset top="#7ec8ff" mid="#cfe9ff" low="#fff7e0" />
      <g className="rays" style={{ transformOrigin: "800px 260px" }}>
        {Array.from({ length: 14 }, (_, i) => (
          <path key={i} d="M800 260 L760 -400 L840 -400 Z" fill="#fff6c8" opacity="0.35" transform={`rotate(${i * (360 / 14)} 800 260)`} />
        ))}
      </g>
      <circle cx="800" cy="260" r="90" fill="#fff3b0" />
      {/* temple doré flottant */}
      <g transform="translate(620 300)" className="float-slow">
        <ellipse cx="180" cy="230" rx="230" ry="50" fill="#ffffff" />
        <path d="M20 90 L180 20 L340 90 Z" fill="#f2c94c" stroke="#b8860b" strokeWidth="5" />
        {[40, 100, 160, 220, 280].map((x) => <rect key={x} x={x} y="90" width="26" height="130" fill="#fff3d0" stroke="#d9b45a" strokeWidth="3" />)}
        <rect x="20" y="215" width="320" height="18" fill="#f2c94c" />
      </g>
      <Cloud x={200} y={600} s={2} /><Cloud x={1400} y={620} s={2.2} /><Cloud x={800} y={760} s={2.6} />
      <Cloud x={300} y={220} s={0.9} cls="drift" /><Cloud x={1300} y={180} s={1.1} cls="drift" />
      <Particles n={40} color="#ffd700" cls="sparkle" />
    </g>
  );
}

// ---------- RUE ----------
function Street() {
  const windows = (x: number, w: number, h: number, seed: number) =>
    Array.from({ length: Math.floor(w / 46) * Math.floor(h / 64) }, (_, i) => {
      const cols = Math.floor(w / 46);
      const lit = ((i * 31 + seed) % 5) > 1;
      return <rect key={i} x={x + 14 + (i % cols) * 46} y={900 - 260 - h + 20 + Math.floor(i / cols) * 64} width="24" height="36" rx="3"
        fill={lit ? "#ffcf6b" : "#2a2440"} className={lit && i % 7 === 0 ? "twinkle" : undefined} />;
    });
  return (
    <g>
      <Sunset top="#120c2e" mid="#2a1650" low="#5a2a6a" />
      <circle cx="1300" cy="140" r="50" fill="#fff4d6" />
      <Particles n={50} color="#ffffff" cls="sparkle" area={[0, 0, 1600, 300]} />
      {[[0, 260, 380, "#3a2550"], [270, 220, 460, "#2e2045"], [500, 300, 330, "#40285a"], [810, 240, 420, "#2e2045"], [1060, 280, 360, "#3a2550"], [1350, 250, 470, "#2e2045"]].map(([x, w, h, c], i) => (
        <g key={i}>
          <rect x={x as number} y={900 - 260 - (h as number)} width={w as number} height={(h as number) + 260} fill={c as string} stroke="#160e28" strokeWidth="4" />
          {windows(x as number, w as number, h as number, i * 13)}
        </g>
      ))}
      {/* enseignes au néon */}
      <g className="neon"><rect x="320" y="300" width="200" height="70" rx="14" fill="none" stroke="#ff4fa3" strokeWidth="8" /><text x="420" y="348" textAnchor="middle" fontSize="40" className="scene-neon" fill="#ff8ac6">BAR</text></g>
      <g className="neon" style={{ animationDelay: "1.3s" }}><rect x="1080" y="270" width="230" height="70" rx="14" fill="none" stroke="#4fd8ff" strokeWidth="8" /><text x="1195" y="318" textAnchor="middle" fontSize="38" className="scene-neon" fill="#9be7ff">DÉS 24/7</text></g>
      <Lights x1={0} y1={420} x2={1600} y2={400} n={20} colors={["#ffd36b", "#ff4fa3", "#4fd8ff"]} />
      {/* pavés */}
      <rect y="640" width="1600" height="260" fill="#3a3046" />
      {Array.from({ length: 60 }, (_, i) => (
        <rect key={i} x={(i % 15) * 110 + (Math.floor(i / 15) % 2) * 55} y={660 + Math.floor(i / 15) * 60} width="96" height="46" rx="10" fill="#4a3d5a" />
      ))}
      {/* lampadaires */}
      {[180, 1420].map((x) => (
        <g key={x}><rect x={x} y="380" width="14" height="300" fill="#1a1428" /><circle cx={x + 7} cy="372" r="22" fill="#ffd98a" className="twinkle" /><circle cx={x + 7} cy="372" r="70" fill="#ffd98a" opacity="0.15" /></g>
      ))}
    </g>
  );
}
