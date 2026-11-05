"use client";
// Lien « mot de passe oublié » reçu par e-mail : choisir un nouveau mot de passe.
import { useEffect, useState } from "react";
import Link from "next/link";
import { auth, authError, forgetProfile, syncAccount } from "@/lib/client";

export default function NewPassword() {
  const [ready, setReady] = useState<null | boolean>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // le lien contient une session de récupération, lue automatiquement par Supabase
    const { data } = auth().onAuthStateChange((ev, s) => { if (ev === "PASSWORD_RECOVERY" || s) setReady(true); });
    auth().getSession().then(({ data: d }) => setReady(!!d.session));
    return () => data.subscription.unsubscribe();
  }, []);

  async function save(e: { preventDefault(): void }) {
    e.preventDefault(); setMsg("");
    if (pw.length < 8) return setMsg("Mot de passe : 8 caractères minimum");
    if (pw !== pw2) return setMsg("Les deux mots de passe sont différents");
    setBusy(true);
    try {
      const { error } = await auth().updateUser({ password: pw });
      if (error) throw error;
      forgetProfile();
      await syncAccount().catch(() => {});
      setDone(true);
    } catch (err) { setMsg(authError(err)); } finally { setBusy(false); }
  }

  return (
    <main className="center-screen">
      <div className="panel stack narrow">
        <h2>Nouveau mot de passe</h2>
        {done ? <>
          <p>✅ Mot de passe changé, tu es connecté.</p>
          <Link className="gbtn gbtn-gold" href="/">Retour à l&apos;accueil</Link>
        </> : ready === false ? <>
          <p className="muted">Ce lien est invalide ou a expiré. Redemande un lien depuis « Mon profil » → « Me connecter » → « Mot de passe oublié ? ».</p>
          <Link className="gbtn gbtn-dark" href="/">Retour à l&apos;accueil</Link>
        </> : (
          <form className="account-form" onSubmit={save}>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Nouveau mot de passe (8 caractères min.)" autoComplete="new-password" />
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Confirme le mot de passe" autoComplete="new-password" />
            <button className="gbtn gbtn-gold" disabled={busy || !ready}>Enregistrer</button>
            {msg && <p className="error">{msg}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
