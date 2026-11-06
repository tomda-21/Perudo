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

### V2 — décor du Casino du Gobelin (05/11/2026)
- Fond fourni par Tom posé en plein écran, net (sans flou) : `public/art/game/casino-bg.webp` (+ `casino-bg-m.webp` mobile).
- La table est posée sur le dallage (ombre au sol + ombre portée) ; l'ancien calque de map flouté est retiré pour le casino.
- Map unique : la plage n'est plus tirée au sort (base + valeurs par défaut). Seul le Casino du Gobelin reste dans le tirage.
- Vérifié au simulateur : 667×375, 844×390, 1366×768, 1920×1080, 2560×1350. Aucun bouton hors écran, aucun chevauchement. Typecheck OK, 89 tests OK.

### Accueil — nouveau décor (05/11/2026)
- Illustration panoramique de Tom en fond plein écran (cover, sans déformation) : `public/art/home/bg2.webp` + `bg2-m.webp` (téléphone). Point focal palais/ciel, recadré selon l'écran.
- Composants inchangés et toujours interactifs (logo, gobelin, Jouer, profil, Doblons, menus, 5 cartes). Anciens effets calés sur l'ancien fond retirés (cascade, halos, dés posés).
- « Roue du » en double : le texte fantôme incrusté dans `card-wheel.webp` a été effacé du ruban → « Roue du Gobelin » une seule fois.
- Logo : l'image ne contient que PERUDO. Le « TOMDA » venait du badge de profil qui recouvrait le logo sur écran bas → les infos du haut se calent aux bords et rétrécissent dès qu'elles toucheraient le logo ; en paysage téléphone : menus du haut en icônes (doublons masqués), bulle masquée.
- Paysage téléphone : l'accueil garde la scène (plus de colonne à défiler). Portrait : colonne, lien invité raccourci.
- Vérifié au simulateur : 360×740, 390×844, 430×932, 667×375, 740×360, 844×390, 932×430, 1024×600, 1024×768, 1280×1024, 1366×768, 1920×1080, 2348×1284, 2560×1080, 3840×2160. Aucun bouton hors écran, pas de défilement horizontal. Tag de retour : `before-home-bg`.
- Gobelin de l'accueil (05/11/2026) : il est désormais assis derrière une table de jeu du casino (`public/art/home/goblin-table.webp`, faite à partir de la table du Casino du Gobelin + ombre au sol + un dé sur le tapis). Sa main repose sur le rebord, le bas du corps est caché. Couches : fond → gobelin → table → boutons. Le gobelin et la table bougent ensemble (même repère), sur ordinateur comme en colonne téléphone. Restes de l'ancien fond autour du gobelin (taches roses derrière les oreilles, planche à droite) effacés de `goblin.webp`.

### Partie V2 — proportions en paysage téléphone (06/11/2026)
- Uniquement pour les écrans de 500 px de haut ou moins (téléphones en paysage) ; ordinateur et tablette inchangés.
- Barre de commandes sur une seule ligne : 75 → 54 px à 844×390 (−28 %). L'œil remplace le libellé « Cacher mes dés », le tour + chrono deviennent une pastille sur le bord haut de la barre. Toutes les commandes restent (œil, − / +, 6 faces, Enchérir, Dudo !, Exact !).
- Place récupérée : la scène passe aussi sous la barre du haut (ses coins restent libres). Table +12 % à 844×390, fiches des joueurs +20 %.
- Vérifié au simulateur : 667×375, 740×360, 844×390, 915×412, 932×430, 1024×500, avec 2 à 6 joueurs, plus la révélation et la salle d'attente. Aucun chevauchement entre joueurs, avec la barre du haut ou celle du bas, et aucun bouton hors écran.

### Conseil paysage à l'accueil + traînée jaune (06/11/2026)
- Accueil : `components/LandscapeTip.tsx`, un panneau en bois doré « 🎲 Profite pleinement de PERUDO ! » avec un téléphone qui pivote. C'est seulement un conseil.
  - Visible uniquement sur téléphone en portrait. Disparaît seul en paysage. Jamais sur ordinateur.
  - Se ferme avec la croix, « Compris ! » ou un tap à côté. Ne revient plus pendant la visite (sessionStorage).
  - Le « Tourne ton téléphone ! » obligatoire des parties est inchangé.
- Partie : la traînée de points jaunes venait des particules d'ambiance « sparkles » du casino (couche `g2-ambient`, 40 points). Elle n'est plus affichée sur le décor du casino ; les autres lumières et effets sont intacts.
- Vérifié au simulateur : portrait, rotation, retour portrait, fermeture, rechargement, ordinateur. En partie, 0 particule et les mêmes proportions qu'avant.

### Icône officielle + installation sur l'écran d'accueil (06/11/2026)
- Logo officiel de Tom décliné sans retouche de l'illustration :
  - `public/apple-touch-icon.png` (180), plus `icons/apple-touch-icon-152/167` : coins noirs comblés par le prolongement du cadre doré, car iOS arrondit lui-même.
  - `icons/icon-192.png` et `icon-512.png` (coins transparents), `favicon.ico` (16 à 64) et `icons/favicon-16/32.png`.
- `app/manifest.ts` : name et short_name « Perudo », display standalone, start_url « / », thème #2a1640, fond #1c0a30, orientation libre (le paysage reste imposé seulement en partie, par le système existant).
- `app/layout.tsx` : titre de l'onglet « Perudo », applicationName, appleWebApp (capable, titre « Perudo », barre noire), apple-touch-icon, favicons.
