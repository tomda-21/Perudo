# PERUDO V1.0 — suivi des travaux

Référence : cahier des charges « Prompt maître V1.0 » (5 nov. 2026).
Dernier état audité : commit `287f118` (en ligne sur perudo-xi.vercel.app).

## Architecture (rappel)
- Next.js 15 (App Router) + React 19, hébergé sur Vercel ; base Supabase (Postgres, schéma `private`, accès uniquement via fonctions `srv`/`srv2`/`srv3` protégées par `APP_SECRET`).
- Moteur de jeu : `lib/rules.ts` (états), `lib/bids.ts` (règles d'enchères, partagées client/serveur), `lib/bot.ts`.
- Partie : `app/api/games/*` (serveur autoritaire), `app/partie/[code]/page.tsx`, `components/GameStage.tsx`, `components/GameBar.tsx`.
- Comptes/progression : `lib/profiles.ts`, `lib/progression.ts`, `lib/economy.ts`, `app/api/account`, `app/api/progress`.
- Admin : `app/admin`, `app/api/admin`, `components/admin/*`, `lib/admin.ts`.
- Tests : `tests/*.test.ts` (66, `tsx --test`) + simulateur navigateur hors dépôt.

## Plan (ordre de priorité)
- [x] P1 Moteur : Palifico (valeur verrouillée, ouverture Pax), Exact (restrictions, hors tour), 2–6 joueurs, chrono 30 s serveur, relais bot à 60 s, dés perdus.
  - Horloge : `deadline` dans l'état ; `tick()` appelé par GET et chaque action (coup auto = surenchère minimale, sinon Dudo ; révélation 6 s puis manche auto). Présence : `seen` (écrit ≤ 1×/20 s) ; absent > 60 s → `botStep` joue pour lui.
  - Reste : un joueur de retour reprend la main tout de suite (pas « au tour suivant »).
- [x] P2 Comptes : e-mail + mot de passe (Supabase Auth), vérif. e-mail, mot de passe oublié, suppression ; invités à blanc ; pseudo 2×/mois ; identifiant public ; admin lié au compte.
  - `lib/account.ts`, `app/api/account` (session / delete), `public.srv4` + tables `private.auth_links`, `private.admin_owner` (e-mail du propriétaire ; rôle admin attribué en base au compte dont l'e-mail VÉRIFIÉ correspond, une seule fois).
  - Le navigateur garde la session Supabase (`perudo-auth`) ; `syncAccount()` l'échange contre le profil du compte (id + clé d'appareil).
  - À faire par Tom : URL du site dans Supabase (Authentication → URL Configuration). Envoi d'e-mails Supabase par défaut très limité.
  - Restes : réinit. mot de passe joueur dans l'admin = ancien système (P7) ; « parties avec bots comptent » (P5).
- [ ] P3 Interface : dés perso permanents, mobile paysage, zooms, Palifico/élimination, gobelin commentateur, retrait anti-spam, volumes séparés, couper un joueur.
- [ ] P4 Maps : 8 maps (3 nouvelles), décors HD manquants (fournis par Tom).
- [x] P5 Progression : nouveaux gains, formule de niveau, paliers, 3 défis/j + 1 hebdo, classements amis, succès.
  - `lib/economy.ts` (valeurs § 40–42, `levelRewardsUpTo`), `lib/progression.ts` (`grantLevelRewards`, `challengeReward`), cadres de palier `bronze-gobelin` / `gold-anim` (reward: jamais vendus), `lib/ranking.ts` + `lib/ranking-server.ts` (`srv5 rank_stats`). Toute partie terminée compte (bots compris), invités exclus.
  - Restes : affichage des classements = P8 (amis) ; fragments au choix / conversions 30 Doblons = P6.
- [ ] P6 Boutique : coffres (3 niveaux, tirage serveur atomique), prestige, pack de base gratuit, roue (nouveaux lots), fragments au choix.
- [ ] P7 Admin : droits cosmétiques admin, XP/objets aux joueurs (jamais à soi), coffres/probabilités.
- [ ] P8 Social : amis, invitations, présence, blocage/signalement, notifications.
- [ ] P9 PWA + validation finale.
