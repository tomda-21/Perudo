"use client";
// Page d'accueil : créer une partie ou rejoindre avec un code
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, lastName, rememberName, saveSession } from "@/lib/client";
import Die from "@/components/Die";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setName(lastName()), []);

  async function go(kind: "create" | "join") {
    setError("");
    if (!name.trim()) return setError("Choisis un pseudo");
    if (kind === "join" && code.trim().length < 4) return setError("Entre le code de la partie");
    setBusy(true);
    try {
      const r = kind === "create" ? await api.create(name) : await api.join(code.trim().toUpperCase(), name);
      rememberName(name);
      saveSession(r.code, { playerId: r.playerId, token: r.token });
      router.push(`/partie/${r.code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="home">
      <div className="hero-dice">
        <Die value={1} size="lg" />
        <Die value={5} size="lg" />
        <Die value={3} size="lg" />
      </div>
      <h1 className="title">Perudo</h1>
      <p className="subtitle">Bluff, dés et menteurs — entre potes.</p>

      <section className="card stack">
        <label className="field">
          <span>Ton pseudo</span>
          <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="ex. Tom" />
        </label>

        <button className="btn btn-primary" disabled={busy} onClick={() => go("create")}>
          Créer une partie
        </button>

        <div className="divider"><span>ou</span></div>

        <div className="row">
          <input
            className="code-input"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CODE"
          />
          <button className="btn" disabled={busy} onClick={() => go("join")}>Rejoindre</button>
        </div>

        {error && <p className="error">{error}</p>}
      </section>

      <details className="card rules">
        <summary>Nos règles</summary>
        <ul>
          <li><b>Menteur !</b> — tu penses que l&apos;annonce précédente est fausse. Le perdant lâche un dé.</li>
          <li><b>Exact !</b> — tu penses qu&apos;il y a pile le bon nombre. Juste : +1 dé (max 5). Faux : −1 dé.</li>
          <li><b>Pax</b> = les 1. Jokers, mais jamais en première annonce.</li>
          <li>Passer aux pax : la moitié de la quantité (arrondie au-dessus). En revenir : le double + 1.</li>
          <li><b>Palifico</b> : la première manche où un joueur tombe à 1 dé, les pax ne sont plus jokers. Une seule fois par joueur.</li>
        </ul>
      </details>
    </main>
  );
}
