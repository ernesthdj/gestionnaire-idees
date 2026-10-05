# Feature Specification: Documents — nœuds fichiers Markdown rédigés par Claude

**Feature Branch**: `012-documents` · **Created**: 2026-10-05 · **Status**: Draft — à valider par mentalyas

**Input**: demande de mentalyas (2026-10-05) : « un lecteur de .md comme dans Obsidian ; avec Claude, en extension d'un
nœud, générer un .md documenté qui détaille le nœud, et l'avoir en nœud fichier comme dans les .canvas d'Obsidian ».

## Décisions (2026-10-05)
| # | Sujet | Décision |
|---|-------|----------|
| D1 | Stockage | **Un vrai fichier `.md`** : dans le dossier de projet lié au genesis s'il y en a un (sous-dossier dédié `docs/brainstormer/`), sinon dans le dossier `documents` du profil de l'app. Ouvrable dans Obsidian ou VS Code, versionnable, non chiffré (comme les fichiers d'un projet). |
| D2 | Édition | **Claude écrit** (crée, réécrit, complète) ; **mentalyas lit** le rendu et peut **basculer en Markdown brut** pour éditer, comme dans Obsidian. Chaque version est gardée ; une modification est annulable. |
| D3 | Lecture | **Dans le nœud** : un cadre redimensionnable qui affiche le document rendu et défile à l'intérieur, comme un fichier dans un `.canvas` d'Obsidian. |
| D4 | Placement (2026-10-05) | **Annexe** : le document se place juste **sous** son neurone (sous le genesis pour les siens), relié par une connectique bas → haut ; il se glisse (au-dessus ou ailleurs) et se redimensionne ; sa place et sa taille sont gardées. |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Claude rédige le document d'un nœud (Priority: P1) 🎯 MVP

Dans la conversation d'un neurone (genesis ou étape d'un plan d'attaque), mentalyas demande un document qui le détaille
(spécification, recherche, décision argumentée, guide…). Claude le rédige ; il apparaît sur la carte comme un nœud
fichier, relié à son neurone, placé à côté de lui ; le fichier `.md` existe sur le disque, au bon endroit.

**Why this priority**: c'est la raison d'être de la feature : passer de la conversation à un livrable écrit,
lisible et réutilisable hors de l'app.

**Independent Test**: dans le chat d'une étape, « rédige-moi le document de cette étape » → un nœud document apparaît,
relié à l'étape ; le fichier existe dans `docs/brainstormer/` du projet lié (ou dans `documents` du profil) et s'ouvre
dans Obsidian avec le même contenu.

**Acceptance Scenarios**:

1. **Given** la conversation d'un neurone, **When** mentalyas demande un document (par le chat ou par un bouton
   « Rédiger un document » dans l'en-tête du chat), **Then** Claude produit un document Markdown structuré (titre,
   sections) et un nœud document relié au neurone apparaît, avec la mention « par Claude ».
2. **Given** un genesis lié à un dossier de projet, **When** un document est créé pour lui ou pour une de ses étapes,
   **Then** le fichier est écrit dans `docs/brainstormer/` de ce projet ; sans dossier lié, dans `documents` du profil.
3. **Given** un document créé, **When** l'opération est annulée dans l'Historique, **Then** le nœud disparaît de la
   carte et le fichier créé est retiré (mis de côté, jamais effacé sans trace — voir FR-008).
4. **Given** un neurone qui a déjà un document, **When** Claude en rédige un second, **Then** les deux nœuds coexistent,
   chacun relié au neurone, avec des noms de fichier distincts.

---

### User Story 2 — Lire le document dans son nœud, comme dans Obsidian (Priority: P1)

Le nœud document affiche le Markdown rendu — titres, listes, listes à cocher, tableaux, blocs de code, citations,
liens — dans un cadre redimensionnable qui défile à l'intérieur. Son en-tête montre une icône fichier, le titre et
le nom du fichier.

**Why this priority**: un document qu'on ne peut pas lire confortablement sur la carte ne sert à rien.

**Independent Test**: un document de 3 écrans avec titres, tableau, code et cases à cocher : tout est rendu
lisiblement dans le nœud, le défilement reste dans le nœud (la carte ne bouge pas), le nœud se redimensionne et garde
sa taille à la réouverture.

**Acceptance Scenarios**:

1. **Given** un nœud document, **When** il est affiché, **Then** le Markdown est rendu (pas de texte brut) et aucun
   HTML brut contenu dans le fichier n'est exécuté ni interprété.
2. **Given** un document plus long que son cadre, **When** mentalyas fait défiler la molette sur le nœud, **Then** le
   document défile dans le nœud et la carte ne zoome pas.
3. **Given** un lien web dans le document, **When** mentalyas clique dessus, **Then** il s'ouvre dans le navigateur
   du système (jamais dans l'app).
4. **Given** le fichier modifié dans Obsidian, **When** mentalyas revient sur la carte, **Then** le nœud affiche le
   contenu à jour.

---

### User Story 3 — Éditer en Markdown brut et revenir en arrière (Priority: P2)

Un bouton « Modifier » bascule le nœud en édition Markdown brute ; « Terminé » enregistre dans le fichier et revient au
rendu. Chaque enregistrement, de mentalyas ou de Claude, crée une version ; l'Historique permet d'annuler la dernière.

**Why this priority**: corriger une coquille ou ajouter une ligne sans passer par Claude est le geste attendu
d'Obsidian ; sans lui, le document reste utilisable mais rigide.

**Independent Test**: modifier une phrase, « Terminé » → le fichier sur le disque est à jour ; annuler dans
l'Historique → l'ancienne version revient dans le fichier et dans le nœud.

**Acceptance Scenarios**:

1. **Given** un document en lecture, **When** mentalyas clique « Modifier », édite et clique « Terminé », **Then** le
   fichier est réécrit et une version est enregistrée.
2. **Given** une modification enregistrée, **When** elle est annulée dans l'Historique, **Then** le contenu précédent
   revient (fichier et nœud).
3. **Given** le fichier modifié hors de l'app pendant que mentalyas l'édite, **When** il clique « Terminé »,
   **Then** l'app le prévient et lui laisse choisir entre garder sa version ou recharger celle du disque — rien n'est
   écrasé en silence.
4. **Given** Claude qui complète un document, **When** il réécrit le fichier, **Then** une version « par Claude » est
   créée, annulable de la même façon.

---

### Edge Cases

- Fichier supprimé ou déplacé hors de l'app : le nœud indique « fichier introuvable » et propose de le recréer à
  partir de la dernière version connue.
- Dossier de projet lié devenu inaccessible : le document ne peut pas être créé ; le message dit pourquoi ; rien
  n'est écrit ailleurs sans accord.
- Nom de fichier déjà pris dans le dossier : un suffixe numéroté est ajouté (`plan-du-studio-2.md`), aucun fichier
  existant n'est écrasé.
- Titre avec caractères interdits sous Windows ou très long : le nom de fichier est assaini et borné ; le titre
  affiché reste intact.
- Document très volumineux (au-delà de 500 Ko) : refusé à l'écriture avec un message ; le rendu reste fluide jusqu'à
  cette borne.
- Neurone verrouillé (spec 011) : on peut toujours lui rédiger des documents (le verrou fige sa fiche, pas ses
  documents) ; le document d'un neurone verrouillé reste éditable.
- Neurone ou genesis retiré de la carte : ses nœuds documents disparaissent avec lui de la carte ; les fichiers
  restent sur le disque.
- Nœud document retiré par mentalyas : le nœud quitte la carte (annulable) ; le fichier reste sur le disque.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Claude MUST pouvoir créer, depuis la conversation d'un neurone, un document Markdown rattaché à ce
  neurone (titre + contenu), et MUST pouvoir réécrire ou compléter un document existant de cet arbre.
- **FR-002**: L'emplacement du fichier MUST être choisi par l'app : `docs/brainstormer/` du dossier de projet lié au
  genesis de l'arbre s'il existe, sinon `documents` du profil ; ni Claude ni l'interface ne fournissent de chemin. Le
  nom de fichier est dérivé du titre, assaini, borné, et ne peut jamais sortir du dossier choisi.
- **FR-003**: Un document MUST apparaître sur la carte comme un nœud fichier relié à son neurone, placé près de lui
  sans chevaucher les objets existants, marqué « par Claude » s'il a été créé par Claude.
- **FR-004**: Le nœud MUST afficher le Markdown rendu (titres, listes, cases à cocher, tableaux, code, citations,
  liens) dans un cadre redimensionnable à défilement interne ; le HTML brut du fichier MUST NOT être interprété ; les
  liens web s'ouvrent dans le navigateur du système.
- **FR-005**: mentalyas MUST pouvoir basculer un document en édition Markdown brute et l'enregistrer dans le fichier.
- **FR-006**: Chaque écriture (création, réécriture par Claude, enregistrement par mentalyas) MUST créer une version
  et une opération d'Historique annulable ; l'annulation remet la version précédente dans le fichier.
- **FR-007**: Le nœud MUST refléter le contenu actuel du fichier sur le disque (modifié hors de l'app compris) ; un
  enregistrement MUST détecter une modification extérieure concurrente et laisser mentalyas choisir.
- **FR-008**: Aucun fichier MUST être effacé définitivement par l'app : annuler une création met le fichier de côté
  (corbeille du profil) ; retirer un nœud laisse le fichier en place.
- **FR-009**: Le chat d'un neurone MUST offrir un bouton « Rédiger un document » qui demande à Claude, sans
  ambiguïté, un document détaillant ce neurone (même principe que « Proposer un plan d'attaque »).
- **FR-010**: Un document MUST être borné (500 Ko) ; au-delà, l'écriture est refusée avec un message.

### Key Entities

- **Document** : nœud de la carte ; neurone de rattachement, titre, emplacement du fichier (dossier choisi par l'app +
  nom de fichier), taille du cadre, auteur (mentalyas ou Claude), dernière version connue.
- **Version de document** : contenu complet à un instant, auteur, date ; sert à l'annulation et à la recréation d'un
  fichier disparu.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: D'une demande dans le chat à un document lisible sur la carte : un seul geste de mentalyas (le bouton ou
  une phrase).
- **SC-002**: 100 % des documents créés existent sur le disque, dans le dossier attendu, et s'ouvrent à l'identique
  dans un autre éditeur Markdown.
- **SC-003**: Aucune écriture hors du dossier choisi, quel que soit le titre fourni (testé avec des titres hostiles :
  `..`, `/`, `\`, noms réservés Windows).
- **SC-004**: Un document de 3 écrans se lit entièrement dans son nœud sans faire bouger la carte.
- **SC-005**: Toute écriture d'un document s'annule d'un geste depuis l'Historique, contenu du fichier compris.

## Assumptions

- Le rendu Markdown du chat (spec 008) est réutilisé et étendu (tableaux, cases à cocher) ; mêmes règles de sûreté.
- Les cases à cocher sont affichées ; les cocher dans le rendu relève de l'édition (US3), pas d'un clic direct (v1).
- Hors périmètre v1 : liens internes `[[…]]` entre documents, images intégrées, export PDF, recherche plein texte
  dans les documents, documents non rattachés à un neurone.
- Un document est rattaché à un seul neurone ; un neurone peut en avoir plusieurs.
- Le profil démo reçoit un document fictif d'exemple (repo public : aucune donnée réelle).
