# 🎨 Illustrations à créer pour Perudo Tomda

Je n'ai pas d'outil de génération d'images, donc **les décors et les gobelets actuels sont des dessins provisoires en code** (SVG animé / CSS). Pour atteindre le niveau de tes maquettes, il faut de vraies illustrations. Le jeu est prêt à les recevoir : tu déposes le fichier, tu passes un interrupteur à `true`, et c'est tout.

## Comment ajouter une image (3 étapes)

1. Génère l'image avec ton outil (celui de tes maquettes) en utilisant le prompt ci-dessous.
2. Convertis-la en **.webp** (par ex. sur squoosh.app, qualité 80) et nomme-la **exactement** comme indiqué.
3. Sur GitHub : ouvre le dossier indiqué → **Add file → Upload files** → dépose l'image → **Commit**.
   Puis ouvre `lib/catalog.ts`, passe le `art: false` correspondant à `art: true` → **Commit**.
   Une minute plus tard, c'est en ligne.

**Style commun à ajouter à chaque prompt :**
> stylized 3D cartoon, vibrant saturated colors, warm cinematic lighting, high detail, mobile game key art, family board game feel, no text, no logo, no watermark

---

## 1. Accueil — `public/art/home/`

| Fichier | Taille | Interrupteur |
|---|---|---|
| `background.webp` | 2560 × 1440 | `HOME_ART.art` |
| `mascot.webp` (fond transparent → exporter en .webp avec transparence) | 900 × 1300 | `HOME_ART.art` |

**background.webp**
> Fantasy tropical casino at sunset, palm trees, purple-orange sky, a glowing "casino" building with marquee lights on the right, tiki huts with lanterns on the left, string lights, ocean in the background, a wooden counter in the foreground with scattered white dice, depth and atmosphere, **empty central area for a menu panel**, wide 16:9 composition. + style commun

**mascot.webp**
> Mischievous green goblin mascot laughing out loud, sunglasses on his head, purple bandana, red Hawaiian shirt with white flowers, gold earring and necklace, raising a wooden dice cup in one hand, full upper body, **transparent background**. + style commun

## 2. Les 4 maps — `public/art/maps/`

Taille : **2560 × 1440**. Important : **laisser le centre de l'image dégagé** (la table s'y pose), avec un sol cohérent au premier plan.

| Fichier | Interrupteur dans `MAPS` |
|---|---|
| `beach.webp` | `beach` → `art: true` |
| `hell.webp` | `hell` → `art: true` |
| `heaven.webp` | `heaven` → `art: true` |
| `street.webp` | `street` → `art: true` |

- **beach** : *Tropical beach bar at sunset, ocean and waves, palm trees, sand, bamboo tiki huts with warm lanterns, string lights, wooden deck in the foreground where a game table would stand, empty center.* + style commun
- **hell** : *Cartoon hell landscape, volcanoes, rivers and falls of glowing lava, flames, dark volcanic rocks, red and orange lighting, floating embers, humorous rather than scary, rocky platform in the foreground, empty center.* + style commun
- **heaven** : *Heavenly sky kingdom, fluffy clouds, golden floating temples and palaces, sun rays, bright pastel sky, sparkles, cloud platform in the foreground, empty center.* + style commun
- **street** : *Cartoon city street at night, colorful buildings with lit windows, neon signs, hanging lanterns, cobblestones, festive atmosphere, cobblestone square in the foreground, empty center.* + style commun

## 3. Les 6 gobelets — `public/art/cups/`

Taille : **512 × 512**, **fond transparent**, gobelet vu de 3/4, posé à l'envers, centré en bas de l'image.

| Fichier | Prompt (à compléter par le style commun) | Interrupteur dans `CUPS` |
|---|---|---|
| `classic.webp` | carved brown wooden dice cup with a dark band | `classic` |
| `royal.webp` | shiny gold dice cup topped with a small crown and a red gem | `royal` |
| `crystal.webp` | translucent blue crystal dice cup, faceted, sparkling | `crystal` |
| `infernal.webp` | black volcanic stone dice cup with glowing lava cracks | `infernal` |
| `celestial.webp` | white porcelain and gold dice cup with small angel wings | `celestial` |
| `tropical.webp` | turquoise dice cup with golden tropical patterns and a pink hibiscus flower | `tropical` |

## 4. Avatars par défaut — `public/art/avatars/` ✅ déjà faits

Les 6 portraits (gobelin, Lola, Pablo, Max, Julie, Hugo) viennent de **tes maquettes**, recadrés en cercle. Pour les remplacer par des versions plus nettes : 512 × 512, même nom de fichier.

## 5. Sons et voix — `public/sounds/` et `public/voices/`

Les bruitages sont aujourd'hui **fabriqués par le navigateur** (synthèse), et les phrases sont lues par la **voix de synthèse du téléphone / de l'ordi**. Ce ne sont pas vos voix.

Pour mettre de vrais sons :
1. Enregistre un fichier court (.mp3, moins de 3 secondes, moins de 100 Ko).
2. Dépose-le dans `public/sounds/` (bruitages) ou `public/voices/` (phrases).
3. Dans `lib/catalog.ts`, ajoute `file: "/sounds/prout.mp3"` (bruitage) ou `audio: "/voices/chauffer.mp3"` (phrase) sur la bonne ligne.

Sources gratuites de bruitages (vérifie la licence de chaque son) : freesound.org (licence CC0), pixabay.com/sound-effects.
