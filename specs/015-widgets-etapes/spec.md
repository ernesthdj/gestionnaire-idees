# Feature Specification: Widgets branchés sur les étapes de plan

**Feature Branch**: `015-widgets-etapes` · **Created**: 2026-10-06 · **Status**: En pause (2026-10-09) — US4 faite par la spec 026 (2026-10-10), US5 à reprendre

**Input**: demande de mentalyas (2026-10-06) : « les widgets il faut les revoir car ils n'acceptent en source d'entrée
qu'une idée alors qu'avec l'évolution de l'app je veux qu'ils acceptent en source surtout des étapes de plans » ;
« en gros son contexte complet pour que le widget soit performant et bien cadré ».

**Constat** : les entrées des widgets (spec 005) datent de l'ancien moteur, retiré par la spec 010. Une source est une
idée (titre, texte d'origine, questions et réponses, arbre de sous-neurones, document éclos) ou la « prochaine étape »
d'un document éclos. Les étapes des plans d'attaque (spec 011), leurs fiches et leurs documents (spec 012) ne peuvent
pas être branchées.

## Décisions (2026-10-06)
| # | Sujet | Décision |
|---|-------|----------|
| D1 | Source | Une **étape de plan** (y compris une action finale) peut être branchée sur un widget, comme une idée. |
| D2 | Contenu | Une étape transmet son **contexte complet**, en quatre parties cochées par défaut et décochables : identité, fiche, chemin depuis le genesis, sous-étapes et annexes. |
| D3 | Ancien | Les parties d'une idée sont **remplacées** par celles du moteur actuel (identité, fiche, plan d'attaque, annexes). L'ancienne source « prochaine étape » ne se crée plus ; un branchement existant reste lisible (archive). |
| D4 | Ordre | Réalisée **avant** la spec 014. |
| D5 (2026-10-06) | Sens du lien | Le lien sert d'abord à **construire** le widget le plus utile pour le nœud lié : Claude lit le contexte complet du nœud (valeurs comprises, plus seulement la structure) et écrit le widget en conséquence. Le canal de données brutes reste, pour ce que le nœud contient vraiment. |
| D6 (2026-10-06) | Construction | Brancher un nœud sur un widget **vide** lance aussitôt la construction par Claude ; sur un widget déjà écrit, l'app propose « Adapter au nœud » et ne touche au code qu'avec l'accord de mentalyas. La nouvelle version arrive « À revoir » comme toujours. |
| D7 (2026-10-06) | Contexte préparé | Quand le nœud n'a pas les données brutes utiles au widget, celui-ci reçoit un **contexte préparé par Claude** (données structurées extraites du nœud selon une consigne que Claude écrit avec le widget). Il est actualisé **sur demande** : le widget signale « le nœud a changé », un clic sur « Actualiser » relance Claude. |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Brancher une étape de plan sur un widget (Priority: P1) 🎯 MVP

mentalyas tire un lien d'une étape de plan (ou d'une action finale) vers un widget. L'étape devient une entrée du
widget ; la revue s'ouvre comme pour une idée ; une fois autorisé, le widget reçoit le contexte de l'étape.

**Why this priority**: c'est la demande ; les étapes sont désormais le cœur du travail sur la carte.

**Independent Test**: un genesis avec un plan de 2 niveaux et une étape « 1.2 Chiffrer le budget » qui a une fiche et
un document annexé ; tirer un lien de 1.2 vers un widget → l'entrée « 1.2 Chiffrer le budget » apparaît avec ses 4
parties cochées ; autoriser → le widget affiche le titre, la fiche, les fiches du chemin et le document.

**Acceptance Scenarios**:

1. **Given** une étape de plan et un widget, **When** mentalyas tire un lien de l'étape vers le widget, **Then**
   l'étape devient une entrée du widget, un trait les relie sur la carte, et la revue du widget s'ouvre.
2. **Given** une étape branchée, **When** la revue s'affiche, **Then** elle montre l'étape (rang et titre) et ses
   quatre parties transmises, toutes cochées, avec leur libellé.
3. **Given** une étape déjà branchée sur ce widget, **When** mentalyas la branche de nouveau, **Then** c'est refusé
   avec un message clair.
4. **Given** une proposition d'étape (fantôme) ou un livrable, **When** mentalyas tire un lien vers un widget,
   **Then** rien n'est branché : seules une idée et une étape existante sont des sources.
5. **Given** une étape branchée, **When** elle est retirée de la carte, **Then** l'entrée devient vide (« source
   retirée ») sans casser le widget, comme pour une idée retirée.

---

### User Story 2 — Le widget reçoit le contexte complet de l'étape (Priority: P1) 🎯 MVP

Une fois la version du widget autorisée, il reçoit pour chaque étape branchée les parties cochées : identité, fiche,
chemin depuis le genesis, sous-étapes et annexes.

**Why this priority**: D2 — un widget bien cadré a besoin du contexte de la branche, pas seulement d'un titre.

**Independent Test**: décocher « Chemin depuis le genesis » → la revue redemande l'autorisation ; après autorisation,
le widget ne reçoit plus les fiches du chemin ; les autres parties sont inchangées.

**Acceptance Scenarios**:

1. **Given** une étape branchée et autorisée, **When** le widget lit ses entrées, **Then** il reçoit : **identité**
   (identifiant, titre, rang, statut, profondeur, « pourquoi », action finale éventuelle avec son livrable annoncé et
   son état), **fiche** (sections et contenu de la fiche de l'étape), **chemin** (genesis puis étapes parentes, chacun
   avec son titre, son rang et sa fiche), **sous-étapes et annexes** (sous-arbre de l'étape avec titres, rangs et
   statuts ; documents annexés à l'étape avec titre et contenu ; fichiers du livrable s'il y en a, chemin et statut).
2. **Given** une partie décochée, **When** le widget lit ses entrées, **Then** cette partie est absente ; l'identifiant
   de l'étape est toujours présent.
3. **Given** un changement de parties cochées, **When** il est enregistré, **Then** l'autorisation est redemandée
   (même règle que la spec 005 : ce qu'un widget lit fait partie de ce que mentalyas autorise).
4. **Given** une fiche, une sous-étape ou un document modifiés après l'autorisation, **When** le widget relit ses
   entrées, **Then** il reçoit le contenu à jour, sans nouvelle autorisation (la nature des données n'a pas changé).
5. **Given** un contexte très volumineux (documents longs), **When** il est transmis, **Then** il est borné ; ce qui
   dépasse est tronqué et signalé au widget.

---

### User Story 3 — Une idée transmet ce qu'elle a aujourd'hui (Priority: P2)

Une idée (genesis) branchée transmet les parties du moteur actuel : identité, fiche, plan d'attaque, annexes. Les
parties de l'ancien moteur ne sont plus proposées.

**Why this priority**: D3 — les cases « Questions et réponses » et « Document éclos » sont vides ou périmées depuis la
spec 010 et brouillent la revue.

**Independent Test**: brancher un genesis → 4 parties cochées (identité, fiche, plan d'attaque, annexes) ; le widget
reçoit la fiche du genesis et son arbre d'étapes ; un ancien branchement sur une idée garde ses données sans erreur.

**Acceptance Scenarios**:

1. **Given** une idée branchée, **When** la revue s'affiche, **Then** ses parties sont : identité (titre, nature,
   catégorie, état, texte d'origine), fiche, plan d'attaque (arbre des étapes avec rangs et statuts), annexes
   (documents du genesis).
2. **Given** un branchement d'idée créé avant cette spec, **When** il est relu, **Then** ses anciennes parties sont
   converties vers les nouvelles (identité ← identité et texte d'origine ; plan d'attaque ← arbre ; annexes ←
   document) et l'autorisation est redemandée une fois.
3. **Given** un ancien branchement « prochaine étape », **When** le widget lit ses entrées, **Then** il reçoit le
   texte d'archive s'il existe, la revue le marque « ancienne source » et propose de le remplacer par une étape de
   plan ; aucun nouveau branchement de ce type ne peut être créé.

---

### User Story 4 — Le widget se construit à partir du nœud lié (Priority: P1) 🎯

mentalyas branche une étape « Chiffrer le budget » sur un widget vide. Claude lit le contexte de l'étape (fiche,
chemin, documents, sous-étapes) et construit l'outil le plus utile pour elle (ici, un tableau de budget avec les postes
cités), sans qu'on lui décrive quoi faire. Sur un widget déjà écrit, « Adapter au nœud » fait la même chose à partir
du code existant.

**Why this priority**: D5 — c'est le sens du lien : un widget cadré par son contexte, pas un canal générique.

**Independent Test**: widget vide ; brancher l'étape « 1.2 Chiffrer le budget » dont la fiche cite 3 postes → Claude
construit un widget qui les affiche ; la version arrive « À revoir », avec un résumé qui dit d'où viennent les
informations ; brancher une autre étape sur un widget déjà écrit → bouton « Adapter au nœud », le code ne change
qu'après ce clic.

**Acceptance Scenarios**:

1. **Given** un widget sans code, **When** mentalyas y branche une étape ou une idée, **Then** Claude construit le
   widget à partir du contexte complet de la source (valeurs comprises) ; la version arrive « À revoir ».
2. **Given** un widget déjà écrit, **When** mentalyas y branche une source, **Then** rien n'est réécrit ; la revue et
   le widget proposent « Adapter au nœud », qui lance la construction en partant du code existant.
3. **Given** une construction, **When** Claude l'écrit, **Then** il choisit lui-même la forme la plus utile (outil,
   tableau, check-list, calculateur…) et dit dans le résumé ce qu'il a tiré du nœud.
4. **Given** plusieurs sources branchées, **When** Claude construit, **Then** il reçoit le contexte de chacune.
5. **Given** une construction en cours, **When** mentalyas regarde le widget, **Then** il voit « Claude construit… » ;
   une erreur (limite atteinte, Claude indisponible) est dite sans perdre le code précédent.

---

### User Story 5 — Contexte préparé par Claude, actualisé sur demande (Priority: P2)

Quand le nœud ne contient pas les données brutes dont le widget a besoin (par exemple des postes de budget écrits en
phrases dans la fiche), Claude écrit avec le widget une **consigne d'extraction** et un premier **contexte** (données
structurées). Le widget reçoit ce contexte avec ses entrées. Quand le nœud change, le widget l'indique ; « Actualiser »
relance l'extraction.

**Why this priority**: D7 — un widget utile même quand l'information du nœud est du texte, sans relancer Claude à
chaque modification.

**Independent Test**: après la construction de US4, le widget reçoit le contexte (postes et montants) ; modifier la
fiche de l'étape → le widget affiche « Le nœud a changé — Actualiser » ; cliquer → le contexte est à jour ; aucun appel
à Claude sans ce clic.

**Acceptance Scenarios**:

1. **Given** une construction, **When** Claude juge qu'un contexte préparé est utile, **Then** il fournit une consigne
   d'extraction et un contexte initial (données JSON bornées) ; le widget les reçoit avec ses entrées.
2. **Given** un contexte préparé, **When** le nœud source change (fiche, documents, sous-étapes), **Then** le widget est
   marqué « le nœud a changé » et propose « Actualiser » ; rien n'est relancé automatiquement.
3. **Given** « Actualiser », **When** mentalyas clique, **Then** Claude réapplique la consigne au contexte actuel du nœud,
   sans toucher au code ; le nouveau contexte est validé (JSON, borne) puis transmis.
4. **Given** une version du widget non autorisée, **When** un contexte existe, **Then** il n'est pas transmis (même règle
   que les entrées, spec 005 FR-002).

---

### Edge Cases

- Étape d'un genesis retiré, ou genesis retiré : entrée vide, comme une idée retirée.
- Étape déplacée dans le plan (rang changé) : le widget reçoit le nouveau rang à la lecture suivante.
- Fiche vide, aucun document, aucune sous-étape : la partie est présente mais vide (liste vide), jamais absente.
- Chemin : profondeur maximale du plan (4) ; le genesis est toujours le premier élément.
- Documents dont le fichier a disparu (spec 012) : titre transmis, contenu de la dernière version connue, signalé.
- Contenu d'un document ou d'une fiche fourni par Claude ou par un projet : transmis comme donnée ; le widget reste
  dans son bac à sable (spec 004/005), sans autre accès.
- Plusieurs étapes et idées branchées sur un même widget : chacune est une entrée distincte, dans l'ordre de
  branchement.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: mentalyas MUST pouvoir brancher une étape de plan existante (ordinaire ou action finale) sur un widget en
  tirant un lien sur la carte ; une proposition d'étape, un document, un livrable ou un bloc ne sont pas des sources.
- **FR-002**: Une étape branchée MUST transmettre quatre parties, cochées par défaut et décochables : identité, fiche,
  chemin depuis le genesis, sous-étapes et annexes, avec le contenu décrit en US2.
- **FR-003**: Une idée branchée MUST transmettre quatre parties : identité (texte d'origine compris), fiche, plan
  d'attaque, annexes ; les parties de l'ancien moteur MUST NOT être proposées.
- **FR-004**: Les branchements existants MUST être convertis (parties d'idée) ou gardés en archive (« prochaine
  étape ») sans perte ni erreur ; la conversion redemande l'autorisation une fois.
- **FR-005**: Les parties transmises MUST faire partie de ce que mentalyas autorise : changer une source ou ses parties
  redemande l'autorisation (règle spec 005 FR-002 inchangée).
- **FR-006**: Le widget MUST recevoir le contenu à jour à chaque lecture, et rien tant que sa version n'est pas
  autorisée pour exactement ces entrées.
- **FR-007**: Le contexte transmis MUST être borné (taille totale par entrée) ; une troncature MUST être signalée au
  widget dans ses données.
- **FR-008**: La carte MUST dessiner le trait entre une étape branchée et son widget, et la revue MUST afficher la
  source avec son rang et son titre.
- **FR-010**: Brancher une source sur un widget sans code MUST lancer sa construction par Claude à partir du contexte
  complet des sources (valeurs comprises) ; sur un widget avec code, la construction MUST attendre « Adapter au nœud ».
- **FR-011**: La tâche de construction MUST rester une tâche automatique de l'app (sans outils, cadre figé, contexte du
  nœud transmis comme donnée délimitée) ; son résultat suit le circuit existant (validation, version « À revoir »).
- **FR-012**: Une construction MAY produire une consigne d'extraction et un contexte initial ; le contexte MUST être du
  JSON validé et borné (50 Ko), transmis au widget dans ses entrées seulement si la version est autorisée.
- **FR-013**: Un changement du nœud source MUST marquer le contexte « à actualiser » ; « Actualiser » MUST relancer
  seulement l'extraction (pas le code) ; aucune relance automatique.
- **FR-014**: La règle de la spec 005 « Claude ne voit que la structure des entrées » est levée pour la construction
  (constitution 3.0 : plus d'anonymisation) ; les valeurs restent invisibles des widgets non autorisés.
- **FR-009**: L'aide aux widgets fournie à Claude (description de `widget_poser` et du format des entrées) MUST décrire
  la nouvelle forme des entrées, pour que Claude écrive des widgets qui les exploitent.

### Key Entities

- **Entrée de widget** : widget, nature de la source (idée, étape de plan, ancienne prochaine étape en archive),
  source, parties transmises.
- **Contexte préparé** : par widget ; consigne d'extraction (écrite par Claude), données JSON, empreinte du contexte
  source au moment de l'extraction (pour savoir s'il est à actualiser), date.
- **Contexte d'étape transmis** : identité, fiche, chemin (genesis et étapes parentes avec leurs fiches),
  sous-étapes, documents annexés, fichiers du livrable ; indicateur de troncature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Brancher une étape sur un widget prend un geste (tirer un lien) puis une autorisation, comme une idée.
- **SC-002**: 100 % des parties cochées d'une étape sont présentes dans les entrées du widget, 0 partie décochée.
- **SC-003**: 100 % des branchements existants restent lisibles après la mise à jour (aucune erreur au chargement d'un
  widget).
- **SC-005**: Un widget vide branché sur une étape avec une fiche remplie est construit sans autre consigne et affiche
  au moins une information tirée de cette fiche (validé en test guidé).
- **SC-006**: 0 appel à Claude sans geste de mentalyas après la construction (actualisation sur demande seulement).
- **SC-004**: Un widget écrit par Claude à partir de la description des entrées exploite le contexte d'une étape
  (titre, fiche, chemin) du premier coup (validé en test guidé).

## Assumptions

- Le bac à sable et le pont de capacités des widgets (specs 004, 005) sont inchangés ; seule la forme des entrées
  évolue.
- « Fiche » = la fiche du neurone tenue par Claude et mentalyas (spec 010) ; « documents » = documents Markdown de la
  spec 012 ; « livrable » = fichiers du livrable d'une action finale (spec 013), chemins et statuts seulement — pas le
  contenu des fichiers du projet.
- Borne par défaut : 200 Ko de texte par entrée (les documents et fiches les plus éloignés de l'étape sont tronqués
  d'abord).
- Hors périmètre : actualisation automatique du contexte préparé ; un widget qui écrit dans une étape (sortie vers une fiche), des sources « document » ou « livrable »
  seules, les widgets proposés au verrouillage (spec 006) qui gardent leur fonctionnement.
