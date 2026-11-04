# 🎲 Perudo entre potes

Le Perudo en ligne avec nos règles maison : **menteur**, **pax**, **exact**, **palifico**.

## Comment c'est construit

| Outil | Rôle |
|---|---|
| **Next.js** | le site (pages + serveur) |
| **Supabase** | garde les parties et prévient tout le monde en temps réel |
| **Vercel** | met le site en ligne à chaque envoi sur GitHub |

## Les bots

Dans la salle d'attente, l'hôte peut ajouter jusqu'à 7 bots (8 joueurs max). Un bot ne voit que ses propres dés, comme un vrai joueur : il calcule si l'annonce est probable, puis surenchérit, crie « Menteur ! » ou « Exact ! », et bluffe de temps en temps.

## Où est quoi

```
app/
  page.tsx                ← page d'accueil (créer / rejoindre)
  partie/[code]/page.tsx  ← la table de jeu
  globals.css             ← TOUT le design (couleurs, polices, dés…)
  api/                    ← le serveur : créer, rejoindre, jouer
components/Die.tsx        ← le dessin d'un dé
lib/
  rules.ts                ← les règles du jeu (le cœur)
  bids.ts                 ← ce qui rend une annonce valable ou non
  bot.ts                  ← le cerveau des bots
tests/                    ← vérifie que les règles et les bots marchent
```

**Pour changer le look** : commence par `app/globals.css`, tout en haut il y a les couleurs et les polices.

**Sécurité** : chaque joueur ne reçoit que ses propres dés. Les dés sont tirés par le serveur, personne ne peut tricher en fouillant la page.

## Travailler sur son Mac

1. Installer [Node.js](https://nodejs.org) (version LTS) et [VS Code](https://code.visualstudio.com)
2. Récupérer le projet : `git clone https://github.com/tomda-21/perudo.git`
3. Dans le dossier : copier `.env.example` en `.env.local` et remplir `APP_SECRET`
4. `npm install` puis `npm run dev` → ouvrir http://localhost:3000
5. Les tests des règles : `npm test`

Chaque `git push` sur GitHub remet le site à jour automatiquement sur Vercel.
