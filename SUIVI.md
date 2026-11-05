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
- [x] P3 Interface : dés perso permanents, mobile paysage, zooms, Palifico/élimination, gobelin commentateur, retrait anti-spam, volumes séparés, couper un joueur.
  - Soundboard : plus aucun délai ni anti-spam (émission et réception) ; limite technique de 8 sons superposés côté navigateur. Coupure locale par joueur (panneau Sons/Phrases, `settings.mutedPlayers`).
  - Volumes séparés : Général, Effets sonores, Musique, Ambiance (musique/ambiance : pas encore de pistes audio, réglages prêts).
  - Dés perso affichés en permanence près de l'avatar (réglage `showDice`, bouton Cacher/Voir) ; petit zoom caméra à chaque révélation ; bannière PALIFICO ; gobelet renversé pour les éliminés ; gobelin commentateur (Dudo raté, Exact réussi, élimination, victoire — après révélation seulement).
  - Vérifié en paysage 844×390 / 932×430, portrait 390×844, bureau 1440×900 : aucun bouton hors écran.
- [~] P4 Maps (abandonné à la demande de Tom : une seule map, travaillée au maximum) : 8 maps (3 nouvelles), décors HD manquants (fournis par Tom).
- [x] P5 Progression : nouveaux gains, formule de niveau, paliers, 3 défis/j + 1 hebdo, classements amis, succès.
  - `lib/economy.ts` (valeurs § 40–42, `levelRewardsUpTo`), `lib/progression.ts` (`grantLevelRewards`, `challengeReward`), cadres de palier `bronze-gobelin` / `gold-anim` (reward: jamais vendus), `lib/ranking.ts` + `lib/ranking-server.ts` (`srv5 rank_stats`). Toute partie terminée compte (bots compris), invités exclus.
  - Restes : affichage des classements = P8 (amis) ; fragments au choix / conversions 30 Doblons = P6.
- [x] P6 Boutique : coffres (3 niveaux, tirage serveur atomique), prestige, pack de base gratuit, roue (nouveaux lots), fragments au choix.
  - Coffres Classique/Rare/Épique (`openChest`, `srv5 chest_open` atomique : débit + objet + journal ; objet obtenu entre-temps → compensation). Raretés sur cadres/animations. Repli sur la rareté la plus proche puis compensation 75/200/500.
  - Sons/phrases/réactions offerts (prix 0, plus vendus). Prestige : Émeraude 8 000, Saphir 12 000, Améthyste 20 000, Onyx 25 000 (illustrations PROVISOIRES, recoloration du Royal).
  - Roue : lots § 58, cosmétique non possédé, 24 h glissantes ; fragments au choix (6) ; tous mystères possédés → 30 Doblons/fragment, mystère roue → 100.
  - Aperçu 3D = CSS (plateau tournant), animations de coffre CSS légères.
- [x] P7 Admin : droits cosmétiques admin, XP/objets aux joueurs (jamais à soi), coffres/probabilités.
  - Accès admin = compte connecté (jeton Supabase vérifié + profil lié + `srv5 owner_check`), revérifié à chaque appel ; plus de mot de passe admin séparé ni de code d'activation. Bouton « Administration » visible seulement si `isAdmin`.
  - Droits cosmétiques admin calculés à la lecture (`wallet()` → inventaire virtuel source « admin ») : rien n'est écrit, succès/stats/niveaux réels ; `usable` (gobelets utilisables) ≠ `unlocked` (succès).
  - Ajustements joueurs : Doblons, fragments, XP (jamais sur son propre compte, refusé aussi en base), objet offert, raison + confirmation + journal. Réinit. mot de passe retirée (le joueur passe par « Mot de passe oublié »).
  - Sons/phrases/réactions : prix verrouillé à 0. Tableau de bord : comptes, Doblons en circulation, coffres, tours de roue, récompenses.
- [x] P8 Social : amis, invitations, présence, blocage/signalement, notifications.
  - `srv6` + tables `friendships`, `blocks`, `reports`, `notifications`, `presence` ; `app/api/social` ; `components/Friends.tsx` (Amis / Classements / Notifications / Moi). Demande par identifiant public, demande croisée = acceptée, présence (en ligne < 2 min, en partie = code du salon, masquable), invitations depuis la salle d'attente, blocage (retire l'amitié, bloque demandes et invitations), signalements visibles dans l'admin (tableau de bord), vitrine de 3 gobelets possédés.
- [ ] P9 PWA + validation finale.

## Interface de partie V2 (brief « REFONTE DE L'INTERFACE DE JEU V2 »)
- Trois bandes (haut / scène / bas) dans `app/partie/[code]/page.tsx` (`.gv2`) ; seule la scène (table + joueurs, géométrie `LAND` 1400×640 dans `GameStage.tsx`) est mise à l'échelle (ResizeObserver, marge 6 %, max ×1,2) ; la barre `Bar2` (`GameBar.tsx`) est en HTML responsive (`--b` selon la hauteur d'écran).
- Gobelet central supprimé ; enchère centrale compacte `Center2` ; décors `bg2-{casino,beach}.webp` (table et barre intégrées retirées, la table propre est posée par-dessus).
- Bruitages manuels retirés des parties (plus de bouton Sons ; lot « Son » de la roue traité comme cosmétique ; réglage « Bruitages des joueurs » retiré). Phrases / Réactions : 2 boutons ronds en haut, panneau compact dans la scène.
- `components/RotatePrompt.tsx` : « Tourne ton téléphone ! » en CSS pur (portrait + écran tactile ≤ 1024 px), salle d'attente / partie / révélation / victoire seulement ; n'agit que sur l'affichage.
- Version de secours : tag Git `before-ui-v2`.
