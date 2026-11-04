// Sécurité de l'admin : jetons de session et mots de passe
import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

// le module admin est « serveur uniquement » : on neutralise ces imports pour le tester
const orig = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (req: string, ...rest: unknown[]) {
  if (req === "server-only") return {};
  if (req === "next/headers") return { cookies: async () => ({ get: () => undefined }) };
  if (req === "next/cache") return { unstable_cache: (f: unknown) => f, revalidateTag() {} };
  if (req === "@supabase/supabase-js") return { createClient: () => ({ rpc: async () => ({ data: null, error: null }) }) };
  return orig.call(this, req, ...rest);
};
process.env.APP_SECRET = "test-secret";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const A = require("../lib/admin") as typeof import("../lib/admin");

const ID = "0b2c2f1e-1111-4222-8333-444455556666";

test("jeton de session : valide, puis refusé si modifié ou expiré", () => {
  const t = A.signSession(ID, 1000);
  assert.equal(A.verifySession(t, 2000), ID);
  assert.equal(A.verifySession(t, 1000 + 13 * 3600 * 1000), null); // expiré (12 h)
  const [id, exp, sig] = t.split(".");
  assert.equal(A.verifySession(`${id}.${Number(exp) + 99999999}.${sig}`, 2000), null); // date trafiquée
  assert.equal(A.verifySession(`0b2c2f1e-1111-4222-8333-000000000000.${exp}.${sig}`, 2000), null); // autre profil
  assert.equal(A.verifySession("n'importe quoi", 2000), null);
  assert.equal(A.verifySession(undefined, 2000), null);
});

test("jeton signé avec une autre clé serveur : refusé", () => {
  const t = A.signSession(ID, 1000);
  process.env.APP_SECRET = "autre-cle";
  assert.equal(A.verifySession(t, 2000), null);
  process.env.APP_SECRET = "test-secret";
});

test("mot de passe : haché (jamais en clair) et vérifié", () => {
  const h = A.hashPassword("correct horse battery");
  assert.ok(!h.includes("correct"));
  assert.equal(A.checkPassword("correct horse battery", h), true);
  assert.equal(A.checkPassword("mauvais mot de passe", h), false);
  assert.equal(A.checkPassword("x", null), false);
  assert.ok(A.passwordProblem("court"));
  assert.equal(A.passwordProblem("assez-long-ok"), null);
});

test("requireAdmin : refuse sans cookie, et refuse une écriture venant d'un autre site", async () => {
  const noCookie = new Request("https://perudo.test/api/admin?op=overview");
  await assert.rejects(A.requireAdmin(noCookie), (e: Error & { status?: number }) => e.status === 401);
  const csrf = new Request("https://perudo.test/api/admin", { method: "POST", headers: { origin: "https://pirate.example", host: "perudo.test" } });
  await assert.rejects(A.requireAdmin(csrf), (e: Error & { status?: number }) => e.status === 403);
});
