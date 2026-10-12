# L1n — Le dossier du nœud : un dossier de verre flottant, relié au nœud, pour parcourir ses documents (idée, 2026-10-12)

> Brainstorm de niveau 1, mené avec Claude Code dans le terminal. Les points listés en « Décisions » sont validés par
> mentalyas au fil de la session ; ce qui reste ouvert est listé à la fin. Aucune spec n'est écrite.
> **Suite (2026-10-12) :** niveau 2 validé (`L2-dossier-rangement`, `-carte`, `-tout-voir`, `-claude-actions`,
> `-reprise-012`), niveau 3 écrit (`L3-dossier-rangement`, `-carte`, `-claude-actions`, `-reprise-012`), parcours
> écran ajouté à `L4b-neurones.md` §7.

## Idée de mentalyas (2026-10-12)

> « Quand je demande à Claude de générer de la doc par rapport à un nœud, comme je suis en train de le faire, j'aimerais
> qu'en connexion à ce nœud apparaisse un dossier flottant lié à ce nœud, qui me permet de parcourir les documents
> associés (doc, fichiers, code, etc.). »

**Déclencheur :** cours PLGI (projet « cours de PLGI »), élément « Actif = Passif » de la carte de structure : Claude
a rédigé un cours `.md`, mais `document_ecrire` a refusé l'élément (« Neurone introuvable », corrigé le 2026-10-12 par
un refus clair, commit `b509fbd`). Le fichier existe dans le projet ; rien ne le montre sur la carte à côté du nœud.

## Référence visuelle

**« Glass Folder Cards »** (21st.dev, auteur `kedhareswer`), apportée par mentalyas, avec sa commande d'installation
`npx shadcn@latest add "https://21st.dev/r/kedhareswer/glass-folder-cards"`. Le dépôt n'est pas un projet shadcn (pas
de `components.json`) : la commande ne sera pas lancée, le composant sera **réadapté à la main** aux jetons et règles
de l'app (comme toute référence 21st.dev). Licence à vérifier avant toute reprise dans ce dépôt public. Ce que le
composant fait :

| État | Rendu |
|---|---|
| Repos | Dossier fermé, à plat ; le haut des fichiers dépasse à peine de la poche. |
| Survol / focus | Le panneau de verre avant bascule vers soi sur sa charnière basse ; les fichiers remontent un peu. |
| Ouvert (clic, Entrée, Espace) | Le panneau tombe plus en avant ; les fichiers sortent et s'étalent en éventail, chacun est un bouton à son nom. |
| Ajout (`+`) | Un fichier tombe dans le dossier, la poche cède un peu, le compteur roule. |
| Menu (`···`) | Menu givré pilotable au clavier. |

Trois couches : panneau arrière (illustration générée : bruit déformé rendu comme une surface liquide, peint une fois
dans un `canvas` et partagé), fichiers, panneau avant en verre dépoli (`backdrop-filter: blur`). Parallaxe et reflet
suivent le pointeur. Entrée animée au premier affichage. Animations coupées si les animations sont réduites. Aucune
dépendance hors React, CSS embarqué, ton clair (verre laiteux) ou sombre (verre fumé).

## Ce qui existe déjà (vérifié dans le code le 2026-10-12)

| Besoin | Dans l'app |
|---|---|
| Document rédigé par Claude pour un nœud | `document_ecrire` (spec 012 US1, livrée) : vrai `.md` (`docs/brainstormer/` du projet lié, sinon profil), versions, annulable ; **genesis et étapes seulement** |
| Document dessiné sur la carte | Nœud fichier sous son neurone, relié (spec 012 D4), disposé autour du plan d'attaque (`planLayout`) |
| Fichiers d'un élément de structure | Ses chemins développés en fichiers du projet (spec 017 US7) : liste « Fichiers » de sa carte de détails, lecteur dans le panneau de droite |
| Fichiers écrits par Claude dans une étape | Livrable de l'action finale (spec 013) : nœud livrable, différences, lecteur |
| Lecture d'un `.md` | Mis en forme par défaut, encadrés, schémas Mermaid (2026-10-12) |

## Décisions (validées par mentalyas)

| # | Sujet | Décision |
|---|-------|----------|
| D1 | Périmètre | **Tout nœud** (genesis, étape, élément de structure, nœud Workflow…) peut avoir son **porte-documents**, mais **seulement s'il a des documents associés** : pas de dossier vide sur la carte. |
| D2 | Contenu | Quatre sources, réunies dans le même dossier : **(a)** les documents rédigés par Claude pour le nœud (`document_ecrire`, étendu à tout nœud) ; **(b)** les fichiers que le nœud couvre déjà (chemins d'un élément de structure) ; **(c)** les fichiers que Claude crée ou modifie dans la conversation du nœud ; **(d)** les fichiers ajoutés à la main par mentalyas (« + »). |
| D3 | Parcourir | **Éventail + panneau.** Ouvert sur la carte, le dossier montre en éventail les **4 fichiers les plus récents** (documents d'abord) ; **« Tout voir (N) »** ouvre le dossier entier dans un **onglet du panneau de droite** (spec 027) : arborescence, filtre par sorte (Docs, Code, Autres), recherche ; un fichier s'y lit dans le lecteur (`.md` mis en forme, code coloré). |
| D4 | Nœuds documents (spec 012) | **Rangés dans le dossier** : plus de nœuds documents séparés sur la carte, un seul rendu partout. Un document peut être **épinglé** hors du dossier pour rester ouvert à côté du nœud (le cadre de lecture de la spec 012 D3 sert alors). Amende la spec 012 (D3, D4). |
| D5 | Illustration | L'**encre liquide générée** du composant, **teintée de la couleur du nœud** (module, catégorie) et **déclinée par son identifiant** : chaque dossier est unique, et son module se reconnaît d'un coup d'œil. Peinte une fois, gardée en cache. |
| D6 | Placement | Le dossier **naît à côté de son nœud**, relié par un **lien fin** ; il se déplace, sa place est gardée. Taille modeste (~180 px de large). **Dézoomé loin**, il se réduit en **pastille « 📁 N » sur le nœud**, pour ne pas encombrer la vue d'ensemble. |
| D7 | Actions et Claude | **(a)** Claude **lit le dossier** : dans la conversation du nœud, il connaît la liste et lit les fichiers (outil MCP en lecture). **(b)** Menu **« ··· »** d'un fichier : ouvrir dans l'éditeur, épingler sur la carte (D4), retirer du dossier (le fichier reste sur le disque), demander à Claude de le compléter. **(c)** **Glisser** un fichier de l'éventail sur un autre nœud ou dossier pour l'y ranger aussi. **(d)** Pastille **« nouveau »** sur un fichier ajouté par Claude depuis la dernière ouverture ; l'animation « tombe dans le dossier » joue quand Claude écrit. |

## Sécurité (cadre, sans question)

- Un dossier ne contient que des fichiers **du dossier du projet lié** ou du dossier `documents` du profil : chemin
  relatif contrôlé par le main (pas de `..`, pas de lien symbolique qui sort), comme le lecteur actuel.
- L'ajout à la main (« + », glisser depuis l'explorateur) passe par la même garde ; un fichier hors projet est refusé.
- Retirer un fichier du dossier ne le supprime jamais du disque ; seuls les documents de Claude gardent leurs versions
  et l'annulation (Historique).
- Lecture : `.md` mis en forme (HTML ignoré, schémas Mermaid en image), code coloré sans interprétation ; les fichiers
  binaires ou trop gros ne s'ouvrent pas dans l'app.
- Le composant de référence est réécrit aux jetons du thème ; ni script ni ressource externe (CSP inchangée).

## Hors périmètre

- Pas de gestionnaire de fichiers général (renommer, déplacer sur le disque, supprimer) : le dossier **range**, il ne
  **gère** pas les fichiers du projet.
- Pas de nouveau stockage des fichiers eux-mêmes : seul le **rangement** (quel fichier dans quel dossier, sa source,
  sa date d'entrée) est nouveau.

## Questions ouvertes

1. **Licence** du composant « Glass Folder Cards » (21st.dev) : à vérifier avant d'en reprendre le code dans ce dépôt
   public ; sinon, réécriture inspirée, sans copie.
2. **Volume** : la source (b) d'un module large (120 fichiers) remplit le dossier ; l'éventail montre les 4 plus
   récents, « Tout voir » le reste (D3). À mesurer : coût du verre dépoli (`backdrop-filter`) et de l'illustration
   avec 30 dossiers à l'écran.
3. **Conversation du genesis** : la source (c) y rangerait tout ce que Claude code depuis le genesis ; faut-il la
   borner (livrables seulement) ?
4. **Ordre de livraison** : après la spec 017 (finitions) ou avant ? La spec 012 (en pause, US2 et US3) est amendée
   par D4.
