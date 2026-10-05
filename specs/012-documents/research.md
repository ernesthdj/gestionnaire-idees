# Research — 012 Documents

## R1 — Un document fait partie de l'arbre de son neurone (disposition)
- **Décision** : un document est rattaché à un neurone (genesis ou étape) et se place **dans la colonne de ses enfants**,
  avant les étapes : `planLayout` le traite comme un enfant sans rang (cadre de la taille choisie par mentalyas). Il suit
  son neurone et son plan ; aucune position libre à stocker, seulement sa taille.
- **Pourquoi** : « en extension d'un nœud » ; le main ne connaît pas la place des étapes (disposées par l'interface) ;
  une disposition déterministe garde la carte stable (spec 011 R4).
- **Écartées** : bloc libre positionné par le main (impossible de viser une étape) ; placement par l'interface puis
  enregistrement (deux sources de vérité).

## R2 — Tables dédiées plutôt que `canvas_blocks` ou `neurons`
- **Décision** : `documents` (neurone, genesis, titre, emplacement, nom de fichier, taille du cadre, auteur, version
  courante, retrait) et `document_versions` (contenu complet, empreinte SHA-256, auteur `user` | `claude` | `externe`).
- **Pourquoi** : un document n'a ni conversation ni fiche (≠ neurone) ni position libre (≠ bloc) ; les versions
  servent à l'annulation et à recréer un fichier disparu. La base reste chiffrée ; seul le fichier est en clair (D1).

## R3 — Fichiers : emplacement, nom, écriture sûre
- **Dossier** : `<dossier du projet lié au genesis>/docs/brainstormer/`, sinon `<profil>/documents/`. Choisi par le
  main uniquement. Le chemin réel du dossier (`realpath`) MUST rester sous le chemin réel du projet (un lien symbolique
  `docs/brainstormer` vers ailleurs est refusé).
- **Nom** : slug du titre (`a-z0-9-`, accents retirés), 60 caractères au plus, noms réservés Windows suffixés
  (`con` → `con-doc`), `.md` ajouté ; collision → `-2`, `-3`… ; contrôle final `path.relative` (aucun `..`, pas absolu).
- **Écriture** : fichier temporaire dans le même dossier puis `rename` (atomique) ; borne 500 Ko (Zod + contrôle main).
- **Corbeille** : annuler une création déplace le fichier vers `<profil>/documents/.corbeille/<horodatage>-<nom>` ;
  rétablir le remet (ou le recrée depuis la dernière version).

## R4 — Fichier source de vérité, modifications extérieures
- **Décision** : à chaque lecture (`document:get`), le main lit le fichier ; si son empreinte diffère de la version
  courante, il enregistre une version `externe` (sans Historique : ce n'est pas une écriture de l'app) et la renvoie.
  Fichier absent → `missing: true` + contenu de la dernière version (bouton « Recréer »).
- **Suivi** : `fs.watch` (non récursif) sur chaque dossier qui contient des documents ; événement `document:changed`
  débouncé (300 ms) → l'interface relit. Aucune dépendance nouvelle (pas de chokidar).
- **Édition concurrente** : `document:save` porte l'empreinte de départ ; si le disque a changé entre-temps, réponse
  `CONFLICT` avec le contenu du disque ; mentalyas choisit « Garder ma version » (`force`) ou « Recharger ».

## R5 — Historique
- Entités `document` (création : `null` ↔ `{ title }` ; annuler = retrait + corbeille) et `document_version`
  (`{ versionId }` avant/après ; annuler = réécrire le fichier avec la version précédente). Contrôle de conflit
  habituel : l'annulation est refusée si la version courante n'est plus celle du lot. Kinds : `mcp_write` (Claude),
  `manual_edit` → nouveau kind `document` annulable pour mentalyas (le kind `manual_edit` ne l'est pas).

## R6 — Claude
- Outils MCP `document_ecrire` `{ id?, document?, titre, contenu, mode: 'remplacer' | 'ajouter' }` (neurone de la
  conversation par défaut ; `document` pour réécrire) et `document_lire` `{ document }`. `neurone_contexte` liste les
  documents du nœud. Bouton de chat « Rédiger un document » (`DOC_MESSAGE`, outil nommé) — même leçon que la spec 011.
- Le cadre des conversations dit : un document détaille UN neurone ; structure en titres ; pas de HTML.

## R7 — Rendu
- Réutilise `chat/Markdown.tsx` (déjà sûr : `skipHtml`, liens https vers le navigateur, images non chargées) avec une
  variante « document » (titres hiérarchisés h1–h4, tableaux à bordures, blocs de code). Nœud `document` :
  `NodeResizer`, défilement interne `nowheel nodrag`, en-tête icône + titre + nom de fichier, boutons Modifier /
  Terminé ; édition dans un `textarea` monospace (pas d'éditeur riche : YAGNI).
