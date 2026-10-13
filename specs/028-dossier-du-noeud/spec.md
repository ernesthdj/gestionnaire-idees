# Feature Specification: Le dossier du nœud (spec 028)

**Feature Branch**: `main` · **Created**: 2026-10-12 · **Status**: Abandonnée (2026-10-13) — lot 1 livré puis désactivé (`FOLDERS_ENABLED = false`) ; code et tables retirés le 2026-11-12 s'ils n'ont pas resservi
**Input**: idée de mentalyas du 2026-10-12 : « Quand je demande à Claude de générer de la doc par rapport à un nœud,
j'aimerais qu'en connexion à ce nœud apparaisse un dossier flottant lié à ce nœud, qui me permet de parcourir les
documents associés (doc, fichiers, code, etc.). » Brainstorm : `docs/brainstorm/L1n-dossier-du-noeud.md` (D1–D7),
`L2-dossier-{rangement, carte, tout-voir, claude-actions, reprise-012}.md`, `L3-dossier-{rangement, carte,
claude-actions, reprise-012}.md`, parcours `L4b-neurones.md` §7 ; `docs/FOUNDATION.md` §00000000. Référence visuelle :
« Glass Folder Cards » (21st.dev), réécrite aux jetons du thème.
Déclencheur : cours PLGI, élément « Actif = Passif » d'une carte de structure ; Claude a rédigé un cours `.md`, mais
rien ne le montre à côté du nœud (et `document_ecrire` refusait les éléments, refus clair depuis le commit `b509fbd`).

## Décisions (2026-10-12, validées par mentalyas)

| # | Sujet | Décision |
|---|-------|----------|
| D1 | Périmètre | **Tout nœud** (genesis, étape, élément de carte de structure, nœud Workflow, idée) peut avoir son dossier, **seulement s'il contient au moins un fichier** : jamais de dossier vide sur la carte. |
| D2 | Contenu | Quatre sources dans le même dossier : **(a)** documents rédigés par Claude pour le nœud (`document_ecrire`, étendu à tout nœud) ; **(b)** fichiers que le nœud couvre déjà (chemins d'un élément de structure) ; **(c)** fichiers que Claude crée ou modifie dans la conversation du nœud ; **(d)** fichiers ajoutés à la main par mentalyas. |
| D3 | Parcourir | **Éventail + panneau** : ouvert sur la carte, le dossier montre les **4 fichiers les plus récents** (documents d'abord) ; « **Tout voir (N)** » ouvre le dossier entier dans l'**onglet du nœud du panneau de droite** (spec 027 « Conversation en panneau fixe ») : arborescence, filtre par sorte (Docs, Code, Autres), recherche ; un fichier s'y lit dans le lecteur. |
| D4 | Documents de la spec 012 | Les documents de la spec 012 (« Documents » : `.md` rédigés par Claude) sont **rangés dans le dossier** : plus de nœuds documents séparés sur la carte. Un document peut être **épinglé** hors du dossier, en cadre de lecture à côté de lui. **Amende la spec 012 D3** (lecture dans le cadre du nœud) **et D4** (placement sous le neurone). |
| D5 | Illustration | Encre liquide générée, **teintée de la couleur du nœud** (module, catégorie, étape) et **déclinée par son identifiant** : chaque dossier est unique et son module se reconnaît d'un coup d'œil. Verre laiteux en thème clair, fumé en thème sombre. |
| D6 | Placement | Le dossier naît **à côté de son nœud**, relié par un **lien fin** ; il se déplace, sa place est gardée ; il suit son nœud. Taille modeste. **Dézoomé loin**, il se réduit en **pastille « 📁 N » sur le nœud**. |
| D7 | Claude et actions | **(a)** Claude **lit le dossier** dans la conversation du nœud (liste et contenu, en lecture seule). **(b)** Menu « ··· » d'un fichier : ouvrir dans l'éditeur, épingler sur la carte, retirer du dossier (le fichier reste sur le disque), demander à Claude de le compléter. **(c)** **Glisser** un fichier sur un autre nœud le range **aussi** là. **(d)** Pastille « **nouveau** » sur un fichier ajouté par Claude depuis la dernière ouverture ; le fichier « tombe dans le dossier » quand Claude écrit. |
| D8 | Précisions L2 | Un fichier couvert (source b) ne se retire pas, il se **masque** (« Ne plus afficher dans le dossier », réversible) ; glisser **ajoute** sans retirer de l'origine ; la recherche de « Tout voir » porte sur les **noms et chemins**, pas sur le contenu. |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Retrouver à côté du nœud les documents que Claude a rédigés (Priority: P1) 🎯 MVP

Dans la conversation de l'élément « Actif = Passif », mentalyas demande un cours à Claude. Le document est créé et un
dossier de verre apparaît à côté de l'élément, relié à lui, teinté de la couleur de son module. Un clic l'ouvre en
éventail ; un clic sur « cours.md » l'ouvre, mis en forme, dans le panneau de droite.

**Why this priority**: c'est la demande d'origine ; sans elle, un document rédigé pour un nœud reste invisible sur la
carte.

**Independent Test**: sur le profil démo, demander un document dans la conversation d'un élément de carte de
structure : un dossier « 1 fichier » apparaît relié à l'élément ; l'ouvrir puis cliquer sur le fichier l'affiche dans
le lecteur ; relancer l'app : le dossier est toujours là, à la même place.

**Acceptance Scenarios**:

1. **Given** un élément de carte de structure sans fichier, **When** Claude rédige un document pour lui, **Then** le
   document est créé, un dossier apparaît à côté de l'élément, relié par un lien fin, et l'élément n'en a qu'un.
2. **Given** un genesis, une étape, un nœud Workflow ou une idée, **When** Claude rédige un document pour lui,
   **Then** le même dossier apparaît (plus aucun refus de sorte de nœud).
3. **Given** un dossier fermé, **When** mentalyas le survole ou lui donne le focus, **Then** il s'entrouvre ;
   **When** il clique ou appuie sur Entrée ou Espace, **Then** l'éventail montre au plus 4 fichiers, documents
   d'abord puis du plus récent au plus ancien, chacun avec son nom et sa sorte ; Échap ou un clic ailleurs le
   referme et rend le focus au dossier.
4. **Given** l'éventail ouvert, **When** mentalyas clique sur un fichier, **Then** il s'ouvre dans le lecteur de
   l'onglet du nœud du panneau de droite (`.md` mis en forme par défaut).
5. **Given** un dossier glissé ailleurs sur la carte, **When** l'app est relancée ou le nœud déplacé, **Then** le
   dossier garde sa place relative au nœud et le suit.
6. **Given** deux dossiers de nœuds de couleurs différentes, **Then** leurs illustrations diffèrent et reprennent la
   couleur de leur nœud ; en thème clair le verre est laiteux, en thème sombre il est fumé.
7. **Given** le réglage « réduire les animations », **Then** le dossier s'ouvre et se ferme sans mouvement ni
   parallaxe.
8. **Given** l'annulation du document dans l'Historique, **Then** il quitte le dossier, et le dossier disparaît s'il
   est vide.

---

### User Story 2 — Le dossier réunit tout ce qui touche le nœud (Priority: P1)

Le dossier d'un élément montre aussi les fichiers de code qu'il couvre ; celui d'une étape montre les fichiers que
Claude a écrits pendant sa conversation ; mentalyas y ajoute à la main la fiche d'énoncé du cours. Quand Claude écrit
un nouveau fichier, il tombe dans le dossier et porte la pastille « nouveau ».

**Why this priority**: D2 ; un dossier qui ne montre que les documents de Claude manquerait le code et les fichiers
qu'on vient chercher.

**Independent Test**: sur un élément qui couvre des fichiers, le dossier apparaît sans action ; dans la conversation
d'une étape, demander à Claude de créer un fichier : il rejoint le dossier de l'étape avec « nouveau » ; « + » sur un
fichier hors du projet est refusé avec un message clair.

**Acceptance Scenarios**:

1. **Given** un élément de structure qui couvre des fichiers du projet, **Then** son dossier les montre (source
   « couvert ») et suit ses chemins quand ils changent, sans que rien ne soit copié.
2. **Given** la conversation d'un nœud, **When** Claude crée ou modifie un fichier du projet et que l'écriture
   réussit, **Then** le fichier entre dans le dossier du nœud (source « conversation ») marqué « nouveau » ; une
   écriture refusée ou échouée ne range rien.
3. **Given** un fichier hors du projet, binaire ou sensible (`.env`, clés) écrit par Claude, **Then** il n'est pas
   rangé.
4. **Given** le bouton « + » du dossier, **When** mentalyas choisit un fichier du projet lié, **Then** il est rangé
   (source « ajouté ») sans être copié ni déplacé ; **When** le fichier est hors du projet ou le nœud n'a pas de
   projet lié, **Then** l'ajout est refusé : « Seuls les fichiers du projet peuvent être rangés ».
5. **Given** un fichier venu de deux sources (rédigé par Claude puis modifié en conversation), **Then** il apparaît
   une seule fois, avec la source la plus forte (document > ajouté > conversation > couvert).
6. **Given** « Retirer du dossier » sur un fichier ajouté ou écrit en conversation, **Then** il quitte le dossier, le
   fichier reste sur le disque, et c'est annulable ; sur un fichier couvert, l'action s'appelle « Ne plus afficher
   dans le dossier » et se défait.
7. **Given** un fichier ajouté par Claude depuis la dernière ouverture du dossier, **Then** il porte « nouveau » et le
   dossier fermé montre un point d'accent ; ouvrir le dossier les efface.

---

### User Story 3 — Tout voir : le dossier entier dans le panneau de droite (Priority: P2)

Le dossier du module « Comptabilité » range 120 fichiers. « Tout voir (120) » ouvre la vue Dossier dans l'onglet du
nœud : arborescence, filtre « Code », recherche « bilan ». mentalyas lit un fichier puis revient à la liste, à la même
place.

**Why this priority**: l'éventail ne montre que 4 fichiers ; un module large doit rester parcourable.

**Independent Test**: sur un élément qui couvre plus de 100 fichiers, « Tout voir » ouvre la vue, le filtre et la
recherche se combinent, un fichier s'ouvre et « ← Dossier » revient à la liste au même défilement.

**Acceptance Scenarios**:

1. **Given** un dossier ouvert, **When** mentalyas clique sur « Tout voir (N) », **Then** l'onglet du nœud du panneau
   de droite s'ouvre sur la vue Dossier avec les comptes par sorte (« 2 docs · 9 code · 1 autre »).
2. **Given** la carte de détails d'un nœud qui a un dossier, **Then** une entrée « Dossier » ouvre la même vue.
3. **Given** la vue Dossier, **Then** les fichiers sont rangés par dossier du disque, repliables, chacun avec son nom,
   sa source, sa date et « nouveau » le cas échéant.
4. **Given** le filtre Tout / Docs / Code / Autres et la recherche, **Then** ils se combinent ; la recherche porte
   sur les noms et chemins ; sans résultat, « Aucun fichier ne correspond » et un bouton « Effacer ».
5. **Given** un fichier ouvert depuis la vue, **When** mentalyas clique sur « ← Dossier », **Then** la liste revient
   à la même place de défilement.
6. **Given** un fichier binaire ou trop gros, **Then** un message s'affiche avec « Ouvrir dans l'éditeur ».
7. **Given** un fichier rangé devenu introuvable sur le disque, **Then** il est montré grisé « introuvable » dans la
   vue (hors éventail) et « Retirer » le nettoie.

---

### User Story 4 — Claude connaît et lit le dossier (Priority: P2)

mentalyas écrit : « complète le cours avec ce qu'il y a dans le dossier ». Claude voit la liste du dossier dans le
contexte du nœud, lit les fichiers utiles, puis complète le document.

**Why this priority**: D7 (a) ; le dossier devient la mémoire de travail du nœud pour Claude.

**Independent Test**: dans la conversation d'un nœud dont le dossier contient un fichier de code, demander à Claude de
le résumer : il le lit par le pont ; lui demander un fichier du projet non rangé : refus clair.

**Acceptance Scenarios**:

1. **Given** la conversation d'un nœud qui a un dossier, **Then** le contexte du nœud donné à Claude liste ses
   fichiers (30 premiers, puis « et N autres »).
2. **Given** un fichier rangé dans un nœud de l'arbre de la conversation, **When** Claude demande à le lire, **Then**
   il reçoit son contenu, borné en taille, présenté comme une donnée.
3. **Given** un fichier du projet qui n'est rangé dans aucun dossier de l'arbre, ou un fichier d'un autre arbre,
   **Then** la lecture est refusée.
4. **Given** un fichier sensible (`.env`, clés), même rangé à la main, **Then** la lecture est refusée.
5. **Given** un fichier dont le contenu contient des consignes (« ignore tes règles… »), **Then** Claude le reçoit
   comme une donnée de mentalyas, jamais comme une instruction.

---

### User Story 5 — Les documents existants rejoignent leur dossier, et s'épinglent (Priority: P2)

Après la mise à jour, les documents déjà rédigés (spec 012) ne sont plus des nœuds séparés : ils sont dans le dossier
de leur nœud. Celui que mentalyas avait agrandi et posé à droite de son genesis y reste, épinglé.

**Why this priority**: D4 ; un seul rendu des documents partout, sans perdre ce que mentalyas avait arrangé.

**Independent Test**: sur une base fictive avec trois documents (un intact, un déplacé et agrandi, un retiré), lancer
la version : le premier est dans le dossier, le deuxième est épinglé à sa place et à sa taille, le troisième n'est
nulle part ; relancer ne change rien.

**Acceptance Scenarios**:

1. **Given** des documents existants, **When** l'app démarre pour la première fois après la mise à jour, **Then**
   chaque document vivant est rangé dans le dossier de son nœud, non « nouveau », sans perte de fichier ni de
   version.
2. **Given** un document qui avait été déplacé ou redimensionné à la main, **Then** il reste affiché à la même place
   et à la même taille, épinglé et relié à son dossier.
3. **Given** un document retiré (corbeille), **Then** il n'est pas rangé ; annuler son retrait le range.
4. **Given** une relance de l'app, **Then** la reprise ne se refait pas.
5. **Given** le menu « ··· » d'un document, **When** mentalyas choisit « Épingler sur la carte », **Then** le
   document sort en cadre de lecture à côté du dossier, redimensionnable ; « Désépingler » le range ; place et
   taille sont gardées après relance.
6. **Given** un retour en arrière de la mise à jour, **Then** la carte retrouve les nœuds documents d'avant.

---

### User Story 6 — Une grande carte reste lisible et fluide (Priority: P3)

Sur la carte du projet comptable, trente nœuds ont un dossier. Dézoomé, chacun devient une pastille « 📁 N » sur son
nœud ; mentalyas glisse et zoome la carte sans à-coups. Un clic sur une pastille zoome sur le dossier.

**Why this priority**: D6 ; sans elle, les dossiers encombrent la vue d'ensemble et alourdissent la carte.

**Independent Test**: profil démo avec 30 dossiers visibles : dézoomer sous le seuil, vérifier les pastilles ; glisser
et zoomer la carte en mesurant la fluidité.

**Acceptance Scenarios**:

1. **Given** la carte dézoomée sous le seuil, **Then** chaque dossier devient une pastille « 📁 N » posée sur son
   nœud ; au-dessus du seuil, il redevient dossier.
2. **Given** une pastille, **When** mentalyas clique dessus, **Then** la carte zoome et se centre sur le dossier.
3. **Given** 30 dossiers visibles, **When** mentalyas glisse ou zoome la carte, **Then** le mouvement reste fluide.
4. **Given** un nœud masqué (replié dans son plan, ou absent de la vue affichée), **Then** son dossier est masqué
   aussi.
5. **Given** « Réorganiser », **Then** seuls les dossiers jamais déplacés à la main reprennent leur place par défaut.

---

### User Story 7 — Ranger ailleurs et agir sur un fichier (Priority: P3)

Le cours « Actif = Passif » sert aussi à l'élément « Bilan ». mentalyas glisse sa feuille de l'éventail sur « Bilan » :
il y est rangé aussi. Depuis le menu « ··· », il ouvre un fichier dans son éditeur ou prépare une demande à Claude.

**Why this priority**: D7 (b, c) ; confort de travail, après le socle.

**Independent Test**: glisser un fichier d'un dossier sur un autre nœud du même projet : il apparaît dans les deux ;
le glisser sur un nœud d'un autre projet : refus clair ; « Demander à Claude de le compléter » prépare la consigne
sans l'envoyer.

**Acceptance Scenarios**:

1. **Given** une feuille de l'éventail ou une ligne de « Tout voir », **When** mentalyas la lâche sur un nœud ou un
   dossier du même projet, **Then** le fichier y est rangé aussi (source « ajouté ») et reste dans le dossier
   d'origine ; lâchée dans le vide, rien ne se passe.
2. **Given** un nœud d'un autre projet, **Then** le dépôt est refusé : « Ce fichier appartient à un autre projet ».
3. **Given** le clavier seul, **Then** l'entrée « Ranger aussi dans… » du menu propose les nœuds du même projet.
4. **Given** « Ouvrir dans l'éditeur », **Then** le fichier s'ouvre dans l'éditeur par défaut du système.
5. **Given** « Demander à Claude de le compléter », **Then** l'onglet du nœud s'ouvre sur la conversation avec une
   consigne préparée dans le champ (« Complète `chemin` : … ») ; rien n'est envoyé sans geste de mentalyas.
6. **Given** le menu « ··· », **Then** il se pilote au clavier (flèches, Début, Fin, Échap).

---

### Edge Cases

- **Nœud supprimé ou archivé** : son dossier disparaît ; son rangement est gardé et revient avec une restauration.
- **Nœud sans projet lié** : seuls les documents de Claude (dans `documents` du profil) peuvent y être rangés ; « + »
  est refusé avec le message de US2.
- **Conversation du genesis** : les fichiers que Claude y écrit sont rangés dans le dossier du genesis, comme pour
  tout nœud (voir Assumptions).
- **Fichier renommé ou supprimé hors de l'app** : montré « introuvable » dans « Tout voir », absent de l'éventail ;
  le dossier ne compte que les fichiers présents ; un dossier dont aucun fichier n'est présent disparaît de la carte.
- **Volume** : au-delà de 500 fichiers par dossier, rien de plus n'est rangé et « Tout voir » le signale.
- **Écritures répétées** de Claude sur le même fichier : une seule entrée, date mise à jour, de nouveau « nouveau ».
- **Annuler une écriture de Claude** : retire le fichier du dossier s'il n'y était pas avant ; ne supprime jamais le
  fichier du disque (hors document de Claude, qui suit la spec 012).
- **Nom de fichier hostile** (balises, très long) : affiché comme du texte, tronqué.
- **Fenêtre étroite ou panneau de droite fermé** : « Tout voir » ouvre le panneau (spec 027).

## Requirements *(mandatory)*

### Functional Requirements

**Rangement (socle)**
- **FR-001**: L'app MUST tenir, pour chaque nœud, la liste des fichiers de son dossier, avec leur source (document,
  ajouté, conversation, couvert), leur date d'entrée et de mise à jour, et leur état « nouveau ».
- **FR-002**: Un fichier rangé MUST être un chemin relatif au dossier du projet lié (ou au dossier `documents` du
  profil pour un document sans projet) ; tout chemin qui sort de ce dossier (`..`, chemin absolu, lien symbolique
  sortant) ou désigne un fichier sensible MUST être refusé avant toute lecture.
- **FR-003**: Ranger, retirer ou masquer un fichier MUST NOT copier, déplacer ni supprimer de fichier sur le disque,
  sauf le retrait d'un document de Claude, qui suit la spec 012 (corbeille de l'app, annulable).
- **FR-004**: Un même fichier MUST pouvoir être rangé dans plusieurs dossiers et MUST n'apparaître qu'une fois par
  dossier, avec la source la plus forte (document > ajouté > conversation > couvert).
- **FR-005**: Claude MUST pouvoir rédiger un document pour tout nœud (genesis, étape, élément de structure, nœud
  Workflow, idée) ; le document MUST être rangé dans le dossier de ce nœud dans la même opération annulable.
- **FR-006**: Un fichier créé ou modifié avec succès par Claude dans la conversation d'un nœud MUST être rangé dans le
  dossier de ce nœud, marqué « nouveau » ; les règles actuelles (chemins d'un élément, livrable d'une action finale)
  MUST rester inchangées.
- **FR-007**: Les fichiers couverts par un élément de structure MUST apparaître dans son dossier, calculés depuis ses
  chemins à chaque lecture ; ils MUST pouvoir être masqués et démasqués.
- **FR-008**: Toute entrée ou sortie de fichier due à Claude ou à mentalyas MUST être une opération d'Historique
  annulable ; les écritures de Claude MUST être marquées « par Claude ».
- **FR-009**: Un fichier MUST être « nouveau » s'il a été ajouté ou modifié par Claude après la dernière ouverture du
  dossier par mentalyas ; ouvrir le dossier (éventail ou « Tout voir ») MUST effacer cet état.

**Dossier sur la carte**
- **FR-010**: Un nœud dont le dossier contient au moins un fichier présent MUST montrer un dossier à côté de lui, relié
  par un lien fin ; un dossier vide MUST NOT être affiché.
- **FR-011**: Le dossier MUST avoir trois états (fermé, entrouvert au survol ou au focus, ouvert) ; ouvert, il MUST
  montrer au plus 4 fichiers, documents d'abord puis du plus récent au plus ancien, et « Tout voir (N) ».
- **FR-012**: Un clic sur un fichier MUST l'ouvrir dans le lecteur de l'onglet du nœud du panneau de droite.
- **FR-013**: Le dossier MUST se déplacer, garder sa place relative à son nœud entre deux ouvertures de l'app et
  suivre son nœud ; « Réorganiser » MUST ne replacer que les dossiers jamais déplacés à la main.
- **FR-014**: Sous un seuil de zoom, le dossier MUST se réduire en pastille « 📁 N » sur son nœud ; un clic sur la
  pastille MUST zoomer sur le dossier.
- **FR-015**: L'illustration du dossier MUST reprendre la couleur de son nœud et varier selon le nœud ; le verre MUST
  suivre le thème (clair, sombre, carbone).
- **FR-016**: Le dossier MUST suivre la visibilité de son nœud (vues Progression, Architecture, Workflow ; plan
  replié).
- **FR-017**: Le dossier fermé MUST laisser glisser la carte ; seuls ses fichiers et boutons captent les gestes quand
  il est ouvert.

**Tout voir**
- **FR-018**: « Tout voir » MUST ouvrir une vue Dossier dans l'onglet du nœud du panneau de droite : comptes par sorte,
  arborescence repliable par dossier du disque, filtre Tout / Docs / Code / Autres, recherche par nom et chemin.
- **FR-019**: Lister un dossier MUST NOT lire le contenu des fichiers (nom, taille, date seulement) ; la liste MUST
  rester fluide jusqu'à 500 fichiers.
- **FR-020**: Lire un fichier depuis la vue puis revenir MUST rendre la liste à la même place de défilement.

**Claude**
- **FR-021**: Le contexte d'un nœud donné à Claude MUST lister son dossier (30 premiers fichiers, puis le nombre
  restant).
- **FR-022**: Claude MUST disposer d'un outil en lecture seule qui liste le dossier d'un nœud (filtrable par sorte)
  ou rend le contenu d'un de ses fichiers, borné en taille ; il MUST refuser tout fichier qui n'est pas rangé dans un
  nœud de l'arbre de la conversation, tout fichier sensible et tout fichier binaire.
- **FR-023**: *(retirée le 2026-10-12, décision de mentalyas : le Brainstormer travaille avec l'IA ; le dossier n'a
  aucun cas particulier de confidentialité. Un code interdit d'IA est signalé par mentalyas au début du brainstorm.)*
- **FR-024**: Le contenu d'un fichier rendu à Claude MUST être présenté comme une donnée, jamais comme une consigne.

**Actions sur un fichier**
- **FR-025**: Chaque fichier (éventail et « Tout voir ») MUST offrir un menu : ouvrir dans l'éditeur, épingler sur la
  carte, retirer du dossier (ou « Ne plus afficher dans le dossier » pour un fichier couvert), demander à Claude de
  le compléter, ranger aussi dans un autre nœud.
- **FR-026**: Épingler MUST afficher le fichier en cadre de lecture redimensionnable à côté du dossier, relié à lui ;
  place et taille MUST être gardées ; « Désépingler » le range.
- **FR-027**: Glisser un fichier sur un nœud ou un dossier du même projet MUST l'y ranger aussi, sans le retirer de
  l'origine ; vers un autre projet, MUST être refusé avec un message clair.
- **FR-028**: « Demander à Claude de le compléter » MUST préparer une consigne dans la conversation du nœud sans
  l'envoyer.

**Documents existants (spec 012)**
- **FR-029**: Au premier démarrage de la version, chaque document vivant MUST être rangé dans le dossier de son nœud,
  non « nouveau » ; ceux déplacés ou redimensionnés à la main MUST être épinglés à leur place et à leur taille ;
  aucun document, fichier ni version MUST être supprimé.
- **FR-030**: Cette reprise MUST être faite une seule fois, MUST être tout ou rien, et MUST pouvoir être défaite
  (retour aux nœuds documents d'avant).

**Transverses**
- **FR-031**: Le dossier, l'éventail, la vue Dossier et les menus MUST être accessibles au clavier (dossier bouton
  avec état ouvert/fermé, fichiers en liste de boutons, fichiers fermés hors de la tabulation, focus visible) et sans
  violation axe.
- **FR-032**: Avec « réduire les animations », aucun mouvement (ouverture, parallaxe, fichier qui tombe) ne MUST
  jouer ; seules la pastille « nouveau » et le point d'accent restent.
- **FR-033**: Le dossier MUST NOT charger de script ni de ressource externe ; un nom de fichier MUST être affiché
  comme du texte.

### Key Entities

- **Entrée de dossier** : un fichier rangé dans le dossier d'un nœud ; nœud, emplacement (projet ou profil), chemin
  relatif, source, document lié (s'il s'agit d'un document de Claude), auteur (mentalyas ou Claude), dates d'entrée,
  de mise à jour et de dernière vue, masqué, épinglé (place et taille). Les fichiers couverts n'ont d'entrée que s'ils
  sont masqués ou épinglés.
- **Place du dossier** : décalage du dossier par rapport à sa place par défaut à côté du nœud, et s'il a été déplacé
  à la main.
- **Document** (spec 012, inchangé) : le fichier `.md` rédigé par Claude et ses versions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: D'une demande de document dans la conversation d'un nœud à sa lecture : le dossier apparaît sans geste
  de mentalyas, puis 2 clics (ouvrir le dossier, cliquer sur le fichier) suffisent, pour 100 % des sortes de nœuds.
- **SC-002**: 100 % des fichiers écrits avec succès par Claude dans le projet depuis la conversation d'un nœud se
  retrouvent dans le dossier de ce nœud.
- **SC-003**: 0 fichier hors du projet lié rangé ou lu, testé avec des chemins hostiles (`..`, absolus, lecteurs
  Windows, liens symboliques sortants, `.env`).
- **SC-004**: *(retiré le 2026-10-12 avec FR-023.)*
- **SC-005**: Avec 30 dossiers visibles, glisser et zoomer la carte reste fluide (60 images par seconde visées, aucune
  image au-delà de 50 ms) sur le poste de mentalyas.
- **SC-006**: « Tout voir » d'un dossier de 500 fichiers s'affiche en moins d'1 seconde et défile sans à-coup.
- **SC-007**: Après la reprise, 100 % des documents vivants sont retrouvables dans un dossier, et ceux que mentalyas
  avait arrangés sont à la même place à l'écran (capture avant / après identique).
- **SC-008**: Retirer ou masquer un fichier ne modifie jamais le disque, et chaque action se défait d'un geste dans
  l'Historique.

## Assumptions

- **Conversation du genesis** (question 3 du L1n) : les fichiers que Claude y écrit sont rangés dans le dossier du
  genesis, sans borne particulière ; « Tout voir » et la limite de 500 fichiers absorbent le volume. À revoir si le
  dossier d'un genesis devient illisible à l'usage.
- **Ordre de livraison** (question 4 du L1n) : la spec 017 « Reprise — Voir » est fermée d'abord (finitions T035–T037),
  puis la 028 est planifiée ; la spec 012 reste en pause, amendée (D3, D4) le 2026-10-12.
- **Licence de la référence** « Glass Folder Cards » : vérifiée avant de reprendre du code ; à défaut, réécriture
  inspirée, sans copie. Aucune dépendance nouvelle prévue.
- Le lecteur de fichiers existant (`.md` mis en forme, code coloré, schémas Mermaid) et le panneau de droite à onglets
  (spec 027) sont réutilisés tels quels.
- Les sortes : Docs = `.md`, `.txt`, `.pdf` ; Code = langages reconnus par le lecteur ; Autres = le reste.
- Le seuil de zoom de la pastille et le comportement du verre pendant que la carte bouge sont fixés au plan (L3 :
  zoom < 0,45, verre allégé pendant un glissement).
- Le profil démo (`npm run seed:demo`) reçoit des dossiers fictifs (document, fichiers couverts, fichier ajouté) ;
  dépôt public : aucune donnée réelle.
- Hors périmètre : gestionnaire de fichiers (renommer, déplacer, supprimer sur le disque), recherche dans le contenu
  des fichiers, dossiers sans nœud.
