# Research — 028 Le dossier du nœud

Sources : `docs/brainstorm/L3-dossier-{rangement, carte, claude-actions, reprise-012}.md` (conception validée le
2026-10-12), code lu le 2026-10-12 après le commit `41585b3` (`DeliverableTracker`, `DocumentService`,
`DocumentTools`, `PlanRepository.node`, `buildGraph` / `planLayout` (`documentNodeId`), `sidePanelStore` (spec 027),
`NeuronTools.context`, `ConfidentialityGuard` (élargie par la spec 017 T035), `HistoryService` (`historyHandlers`),
dernière migration `0046_reprise_edge_candidates`).

## R1 — Rangement : une table, des sources calculées
- **Décision** : table `folder_entries` (documents, ajouts à la main, écrits en conversation ; plus les fichiers
  couverts masqués ou épinglés) et table `folder_places` (place du dossier), migration `0047_folder_entries` avec son
  `down`. Les fichiers **couverts** d'un élément (spec 017 US7, `ElementFilesService`) ne sont pas stockés : calculés
  à la lecture depuis ses chemins. Fusion et dédoublonnage par `path_key` (minuscules, Windows), priorité
  `document > manual > conversation > covered`.
- **Pourquoi** : un seul endroit pour le rangement ; les chemins d'un élément changent (Claude, réanalyse), une copie
  serait vite fausse.
- **Écartés** : colonne JSON sur `neurons` (pas d'unicité ni d'index, annulation ligne à ligne impossible) ; table
  par source (quatre lectures, fusion dupliquée).

## R2 — Source « conversation » : le hook d'écriture existant
- **Décision** : `DeliverableTracker` (spec 014 R5) reçoit un troisième débouché, `folder.record(neuronId, relative,
  'conversation')`, appelé dans `after()` sur une écriture **réussie**, pour **toute** conversation d'un nœud lié à un
  projet (genesis, étape, élément, nœud Workflow), en plus des débouchés actuels (livrable d'une action finale,
  chemins d'un élément). Le hook `ecriture_avant` est déjà posé sur toutes les conversations
  (`ConversationService`, `hookSettings`) : rien à changer côté CLI.
- **Garde** : `checkProjectPath` + `realpath` sous le projet + liste des fichiers sensibles (déjà dans le suivi) ;
  plafond de 500 lignes par dossier (au-delà, plus rien n'est rangé, journalisé sans chemin).
- **Conversation du genesis** (L1n question 3, tranchée par défaut dans la spec) : rangée sans borne particulière ;
  le plafond de 500 et « Tout voir » absorbent le volume.

## R3 — Documents de Claude pour tout nœud
- **Décision** : `DocumentService.create` lit le nœud par une lecture **générique** (`ConversationRepository.neuron` :
  `id`, `kind`, `genesisId`) au lieu de `PlanRepository.node` (genesis et étapes seulement) ; `DocumentTools.write`
  retire le refus `kind = 'element'` du 2026-10-12 (`b509fbd`) ; la consigne `frame.ts` et la description de
  `document_ecrire` disent que le document est rangé dans le dossier du nœud. Le document et sa ligne de rangement
  naissent dans **la même transaction et le même lot** d'Historique.
- **Nœud Workflow** : sa conversation a un neurone propre (`WorkflowChats`, spec 023 D6) ; c'est ce neurone qui porte
  le dossier. Sur la carte, le dossier se pose à côté du nœud Workflow de même clé.

## R4 — Les documents de la spec 012 passent dans le dossier (D4)
- **Décision** : reprise au démarrage `FolderBackfill.run()` après les migrations, marqueur
  `migration.documentFolders` dans les réglages, transaction, `INSERT OR IGNORE` (idempotente). Un document **déplacé
  ou redimensionné** (offset ≠ 0 ou taille ≠ 360 × 280) devient **épinglé** (`pin_*` repris pour que l'écran ne
  bouge pas). La table `documents` n'est pas touchée.
- **Rendu d'un épinglé** : le nœud document actuel (`DocumentNode`, cadre de lecture de la spec 012 D3) est réutilisé
  tel quel ; la vue de la carte ne porte plus que les documents **épinglés** dans `documents`, les autres passent par
  `folders`. Conséquence de livraison : la reprise est faite **dès le premier lot** (sinon anciens documents en nœuds
  et nouveaux dans le dossier) ; le menu « Épingler / Désépingler » arrive avec US5.
- **Retour arrière** : `down` de la migration (tables supprimées, marqueur retiré) : la carte retrouve les nœuds
  documents de la spec 012.

## R5 — Le dossier sur la carte : réécriture de la référence
- **Licence** de « Glassmorphism Folder Cards » (21st.dev, `kedhareswer`, composant 21070) : code lu le 2026-10-12
  (récupération gratuite de mentalyas) ; **aucune licence déclarée**, ni dans le code ni dans les métadonnées
  (`isPublic: true` seulement). Sans licence, rien n'autorise la recopie dans un dépôt public. **Décision : réécriture
  inspirée, sans copie de code**, aux jetons du thème ; le code lu reste hors du dépôt (dossier temporaire de session).
  Les techniques reprises sont des procédés connus et libres (bruit de gradient en octaves, déformation du domaine,
  générateur `mulberry32`, chemins `clip-path`), réécrits à notre façon. L1n question 1 close.
- **Ce que la référence fait, et ce qu'on en garde** :
  - **Géométrie** : une scène de taille fixe mise à l'échelle par `transform: scale()` ; panneau arrière et verre
    avant découpés par `clip-path: path(...)` (onglet du dossier) ; un liseré SVG du même tracé ; ombre floue dessous.
    → gardé, avec nos propres tracés et une scène de ~180 px de large (D6).
  - **États par variables CSS** : `--hinge` (bascule du verre : 0°, −11° au survol ou au focus, −24° ouvert), `--lift`,
    `--spread`, `--fan`, `--stack`, recalculées par sélecteur (`:hover`, `:focus-within`, `[data-open]`) ; chaque
    feuille reçoit `--slot` (−1 … 1), `--depth` et un petit décalage aléatoire stable (graine = nom du fichier).
    → gardé : aucun état React pour l'animation, seulement `data-open`.
  - **Parallaxe et reflet** : `pointermove` écrit `--px` / `--py` dans un `requestAnimationFrame` (pas de rerendu).
    → gardé, coupé pendant que la carte bouge et en animations réduites.
  - **Illustration** : bruit de gradient en octaves, déformation du domaine deux fois, normalisation par centiles,
    éclairage d'une « surface liquide » (pente → normale → diffus + spéculaire), stries, veines ; calcul sur une
    demi-grille puis agrandi ; peinture partagée par une **file unique** qui dépense ~7 ms par image, priorité aux
    panneaux arrière, **cache** par (recette, graine, taille). → gardé dans `folderArt.ts` (fonctions pures testées),
    recette tirée de la couleur du nœud (D5).
  - **Accessibilité** : bouton plein cadre `aria-expanded`, feuilles en liste de boutons rendues `inert` quand le
    dossier est fermé, Échap et clic dehors referment en rendant le focus, menu `role="menu"` piloté par flèches,
    Début, Fin, Tab. → gardé.
  - **Animations** : feuille qui tombe (`@keyframes`), poche qui cède, compteur qui roule, entrée « s'assemble »
    au premier affichage (`IntersectionObserver`) ; `prefers-reduced-motion` coupe tout. → gardé, branché aussi sur le
    réglage « réduire les animations » de l'app.
- **Ce qu'on retire ou change** : `<style>` injecté par instance (→ une feuille `folder.css`) ; couleurs codées en dur
  et police système (→ jetons du thème) ; images (`image`) et liens (`href`) (→ aucun : un fichier s'ouvre dans le
  lecteur de l'app) ; ajout « Untitled » local (→ « + » ouvre le sélecteur du projet, le main range) ; liste de
  fichiers possédée par le composant (→ contrôlée par la vue de la carte).
- **Performance** (SC-005, 30 dossiers) : *(2026-10-12, retour de mentalyas : couper le verre pendant que la carte
  bouge le faisait « s'animer » à chaque clic dans le vide et à chaque zoom — retiré ; la mesure à 30 dossiers, US6,
  dira s'il faut une autre parade)* ; pas de peinture tant que le dossier est
  hors écran ou en pastille ; mesure e2e comme `reprise-bench.e2e.ts` (écarts entre images).
- **Pastille** : sous le zoom 0,45, le dossier n'est pas un nœud React Flow : une pastille « 📁 N » est dessinée par
  le nœud porteur (moins de nœuds, pas de verre au loin).

## R6 — Placement (dans `buildGraph`)
- **Décision** : nœud React Flow `folder` (id `folder:<neuronId>`) + arête fine `folder-link:<neuronId>`.
  Place par défaut selon la sorte : genesis / étape → la place des anciens documents dans `planLayout` (sous le nœud) ;
  élément et nœud Workflow → **à gauche** (corrigé à l'e2e du lot 1 : à droite, le dossier couvrait les enfants, qui
  partent à droite en vue Progression comme en Workflow) ; idée simple → dessous. Décalage gardé (`folder_places.offset`), `moved = 1` dès un glissement ;
  « Réorganiser » ne remet que `moved = 0`. Le dossier suit la visibilité du nœud (vue affichée, plan replié).
- **Données** : `IdeasCanvasView.folders` calculé par le main avec la vue (un aller-retour), aperçu des 4 fichiers
  inclus ; « Tout voir » lit le reste à la demande (`folder:list`).

## R7 — « Tout voir » dans le panneau de droite
- **Décision** : le `TabReader` de `sidePanelStore` (spec 027) gagne une cible `folder` (vue Dossier dans l'onglet du
  nœud, à la place de la conversation, comme un lecteur) ; un fichier ouvert depuis la vue garde un retour « ← Dossier »
  (pile d'un niveau) et la position de défilement. Lecture d'un fichier : lecteurs existants (`.md` mis en forme,
  code coloré) via un canal `folder:file` gardé comme `structure:file` (1 Mo, sensibles et binaires refusés).
- **Liste** : arborescence par dossier du disque, filtre de sorte, recherche nom et chemin ; virtualisée au-delà de
  200 lignes (fenêtrage simple maison, comme les longues listes existantes ; pas de dépendance).

## R8 — Claude lit le dossier
- **Décision** : outil MCP `dossier_lire` (`writes: false`) : liste (200 lignes au plus, filtre `sorte`) ou contenu
  d'un fichier (200 Ko, tronqué et signalé). Ne lit **que** les entrées rangées dans un nœud de l'arbre de la
  conversation (`conversationTarget`) ; codes d'erreur existants (`INTROUVABLE`, `NON_MODIFIABLE`, `ENTREE_INVALIDE`,
  `SECRET_REFUSE`). `neurone_contexte` ajoute une section `Dossier :` (30 premières entrées).
- **Confidentialité** : aucun cas particulier (décision de mentalyas, 2026-10-12 : le Brainstormer travaille avec
  l'IA ; un code interdit d'IA est signalé au début du brainstorm). FR-023 et SC-004 retirés de la spec ; rien n'est
  ajouté à la garde existante du pont.
- **Injection** : contenu préfixé comme donnée (préfixe existant des outils de lecture).
- **Entretien** : `tests/integration/reprise/local-only-end-to-end.test.ts` énumère tous les outils publics du pont ;
  `dossier_lire` y reçoit une ligne d'arguments (sinon ce test échoue), sans comportement nouveau.

## R9 — Annulation
- **Décision** : nouveau type d'entité `folder_entry` dans les `historyHandlers` (créée → retirée, retirée →
  restaurée, masquée ↔ visible, épinglée ↔ rangée). Annuler une écriture de Claude en conversation retire la ligne si
  elle avait été créée par ce tour ; le fichier reste sur le disque (le rangement ne gère pas les fichiers).

## R10 — Dépendances
- **Aucune dépendance nouvelle** : React Flow, zustand, TanStack Query, Tailwind, `motion` (animations, réglage
  « réduire les animations ») déjà présents ; illustration en `canvas` 2D maison.

## R11 — Simplification à l'implémentation (2026-10-12, lot 1)
- **Constat** (code relu) : la table `documents` porte déjà le nœud de rattachement (`neuron_id`), la suppression
  annulable (`deleted_at`) et la place arrangée (`offset_*`, `width`, `height`). Recopier chaque document dans
  `folder_entries` dupliquerait ces données et demanderait de synchroniser l'annulation.
- **Décision** : les documents sont, comme les fichiers couverts, une **source calculée** du dossier (documents vivants
  du nœud, non épinglés). La table de place devient `folders` (`neuron_id`, `offset_x`, `offset_y`, `moved`,
  `seen_at` : « nouveau » se juge par dossier, à sa dernière ouverture). La reprise de la spec 012 se fait **dans la
  migration** `0047` : colonne `documents.pinned` (défaut 0), mise à 1 pour les documents arrangés à la main, et une
  ligne `folders` (`seen_at` = maintenant) par nœud qui a des documents, pour qu'aucun ancien document ne soit
  « nouveau ». Plus de `FolderBackfill` ni de marqueur `migration.documentFolders` ; `down` : colonne et table
  retirées.
- `folder_entries` (sources « ajouté », « conversation », masquage des couverts) arrive au lot 2 (migration `0048`),
  avec les sources qui en ont besoin. Remplace R1 (pour les documents) et R4 (mécanisme de reprise).

## R12 — Mise en pause (2026-10-12, après le lot 1)
- **Décision de mentalyas** : « les dossiers c'est joli mais inutile sur les nœuds, car ils sont déjà autosuffisants
  avec leur scroller intégré ; on les désactive pour le moment, on les réutilisera plus tard si nécessaire dans un autre
  cas de besoin ».
- **Comment** : un interrupteur unique, `FOLDERS_ENABLED = false` (`src/shared/ipc/folders.ts`). Coupé, l'app se
  comporte comme avant la spec : documents dessinés en nœuds (spec 012 D3, D4 — l'amendement de la 028 ne s'applique
  pas), `document_ecrire` pour un genesis ou une étape avec le refus guidé pour un élément, ni dossier, ni rangement
  depuis les conversations, ni canaux `folder:*`.
- **Gardé** : le code des lots 1 et 2 (rangement, sources, garde des chemins, annulation, verre, illustration,
  placement), ses tests (l'e2e `node-folder.e2e.ts` ne tourne que dossiers allumés) et les migrations 0047-0048 (la
  0047 a déjà tourné sur la base de mentalyas ; la colonne `documents.pinned` et les tables restent sans effet).
- **Pour rallumer** : passer l'interrupteur à `true`, relire la spec (US3 à US7 restent à coder), relancer l'e2e.
