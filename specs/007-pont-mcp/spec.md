# Feature Specification: Pont MCP — la carte lue et écrite par Claude Code

**Feature Branch**: `007-pont-mcp`

**Created**: 2026-10-04

**Status**: Livrée (2026-10-09) — reliquat : T020 (test automatisé du hook)

**Input**: User description: « Exposer la carte de l'app à Claude Code : relais lancé par Claude Code + canal local
authentifié ; 9 outils (etat, carte_lire, selection_lire, noeud_lire, dessiner, noeud_modifier, relier, retirer,
widget_poser) ; écritures directes marquées « par Claude », une opération d'Historique par appel, annulables ; lots
tout-ou-rien ; placement automatique ; notes, cadres et liens libres ; widget posé « À revoir ». Enregistrement
manuel pour ce lot. Critère final : depuis un CLI externe, « travaillons dans le brainstormer » → Claude lit l'état
réel de la carte et y dessine. »

**Cadre** : constitution **2.0.0** — I (canal MCP : seul point d'entrée externe, local, authentifié, borné), II
(exception : écritures de Claude par MCP directes, marquées, historisées, annulables, jamais de suppression
définitive), III (sorties validées par schéma ; code de widget dans le bac à sable). FOUNDATION §00 ;
`docs/brainstorm/L1c-pont-claude-code.md`, `L2-pont-mcp.md`, `L3-pont-mcp.md` (validés le 2026-10-04) font foi pour
le détail des contrats. Lot 1 du Pont Claude Code (F10).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Claude lit la carte depuis un CLI (Priority: P1)

mentalyas travaille dans un terminal Claude Code, dans n'importe quel dossier. Il dit « travaillons dans le
brainstormer ». Claude consulte l'état de la carte — idées en cours, notes, cadres, sélection courante — et le
résume en une ou deux phrases. Il peut ensuite lire un élément précis, sa descendance et ses liens, ou toute la carte
page par page.

**Why this priority**: sans lecture, pas de contexte partagé : c'est la moitié de « la carte comme interface entre
mentalyas et Claude », et la première preuve que le pont fonctionne.

**Independent Test**: avec l'app ouverte sur le profil démo, demander dans un CLI externe « qu'y a-t-il sur ma
carte ? » → Claude cite des idées réellement présentes ; sélectionner deux idées dans l'app puis « regarde ma
sélection » → Claude parle exactement de ces deux idées.

**Acceptance Scenarios**:

1. **Given** l'app ouverte et le pont enregistré, **When** mentalyas dit « travaillons dans le brainstormer »,
   **Then** Claude décrit l'état réel de la carte (nombre et titres d'éléments récents, sélection).
2. **Given** trois éléments sélectionnés dans l'app, **When** Claude lit la sélection, **Then** il reçoit ces trois
   éléments, leurs enfants directs et les liens entre eux, et rien d'autre.
3. **Given** une carte de plus de 150 éléments, **When** Claude lit la carte, **Then** il la reçoit page par page
   sans réponse tronquée silencieusement.
4. **Given** l'app fermée, **When** Claude tente d'utiliser le pont, **Then** il reçoit « Le Brainstormer n'est pas
   lancé » et le dit à mentalyas, sans erreur technique brute.

---

### User Story 2 - Claude dessine une structure sur la carte (Priority: P1)

Au fil d'une conversation (analyse d'un document, structure d'un projet, plan, options…), Claude dessine sur la carte
un ensemble cohérent : des notes et des idées, reliées entre elles par des liens libellés, regroupées dans un cadre
titré. L'ensemble apparaît d'un coup, bien rangé, sans chevaucher l'existant, marqué « par Claude ». Un message
discret propose de l'annuler.

**Why this priority**: c'est la valeur visible de la vision — « Claude Code dessine ma pensée ».

**Independent Test**: dans un CLI externe, « fais-moi une carte des étapes pour organiser un mariage, dans le
brainstormer » → un cadre « Mariage » contenant une vingtaine de notes reliées apparaît sur la carte sans
recharger ; un seul `Ctrl+Z` le retire entièrement.

**Acceptance Scenarios**:

1. **Given** une carte quelconque, **When** Claude dessine un lot de 30 notes, 25 liens et un cadre, **Then** tout
   apparaît sans recharger, dans une zone libre, sans recouvrir un élément existant.
2. **Given** un lot dessiné, **When** mentalyas annule (raccourci, bouton du message, ou Historique), **Then** tout
   le lot disparaît en une fois.
3. **Given** un lot dont un lien vise un élément inexistant, **When** Claude l'envoie, **Then** rien n'est dessiné
   et Claude reçoit une erreur qui nomme le lien fautif ; après correction, le lot passe.
4. **Given** un lot de plus de 200 nœuds, **When** Claude l'envoie, **Then** il est refusé avec la limite, et
   Claude le découpe.
5. **Given** un lot rattaché à un élément existant (ancre), **When** il est dessiné, **Then** il se place près de
   cet élément et lui est relié.
6. **Given** un nœud de type « idée » dans le lot, **When** il est dessiné, **Then** il devient une vraie idée
   (brute) de l'app, utilisable ensuite comme toute idée (développement, verrouillage).

---

### User Story 3 - Claude modifie, relie et retire (Priority: P2)

mentalyas demande « reformule ce nœud », « relie ces deux idées », « enlève les doublons ». Claude modifie un titre
ou un texte, crée un lien libellé entre deux éléments existants, ou retire des éléments. Chaque action est une
opération de l'Historique « par Claude », annulable ; un retrait est un archivage, jamais une suppression définitive.

**Why this priority**: indispensable au travail en aller-retour, mais l'essentiel de la valeur est déjà livré par
US1 et US2.

**Independent Test**: « reformule la note X » → le texte change sur la carte ; annuler → il revient. « Retire la
branche Y » → elle disparaît ; l'Historique permet de la restaurer.

**Acceptance Scenarios**:

1. **Given** une note existante, **When** Claude la modifie, **Then** la carte affiche le nouveau texte et
   l'Historique montre « par Claude » avec l'ancien et le nouveau texte.
2. **Given** deux éléments déjà reliés, **When** Claude les relie, **Then** il est informé que le lien existe déjà ;
   aucun doublon n'est créé.
3. **Given** des éléments retirés par Claude, **When** mentalyas annule, **Then** ils réapparaissent avec leurs
   liens.
4. **Given** un élément inconnu ou déjà archivé, **When** Claude tente de le modifier, **Then** rien n'est écrit et
   l'erreur le dit.

---

### User Story 4 - Claude pose un widget (Priority: P2)

mentalyas demande « fais-moi un calculateur d'épargne sur cette idée ». Claude écrit lui-même le code du widget et le
pose sur la carte, relié à l'idée. Le widget arrive « À revoir » : il ne reçoit aucune donnée tant que mentalyas n'a
pas relu et autorisé cette version (revue de la spec 005, inchangée).

**Why this priority**: les widgets persistants sont un pilier de la vision, et cette voie rend leur génération
gratuite ; mais la carte dessinée (US2) passe avant.

**Independent Test**: depuis un CLI externe, « pose un compte à rebours relié à l'idée Z » → un widget « À revoir »
apparaît, relié à Z ; après autorisation, il affiche ses données.

**Acceptance Scenarios**:

1. **Given** une idée, **When** Claude pose un widget relié à elle, **Then** le widget apparaît « À revoir » et ne
   reçoit rien avant autorisation.
2. **Given** un code refusé par la validation des widgets (ressource externe, taille), **When** Claude le pose,
   **Then** rien n'est créé et Claude reçoit la raison.

---

### User Story 5 - Brancher le pont sur Claude Code (Priority: P1)

Dans Réglages, une section « Claude Code » montre si le pont est actif, la commande exacte à copier pour l'enregistrer
dans Claude Code, et permet de régénérer le secret du pont (les anciens clients sont alors déconnectés).

**Why this priority**: sans enregistrement, aucune autre histoire n'est testable. L'installation automatique est
reportée au lot 3.

**Independent Test**: copier la commande affichée, l'exécuter dans un terminal → `claude` liste le serveur
« brainstormer » ; régénérer le secret → un client connecté avec l'ancien est refusé.

**Acceptance Scenarios**:

1. **Given** l'app ouverte, **When** mentalyas ouvre Réglages › Claude Code, **Then** il voit l'état du pont et une
   commande copiable qui ne contient aucun secret.
2. **Given** le secret régénéré, **When** un ancien client tente un appel, **Then** il est refusé.

---

### Edge Cases

- App fermée en pleine session : les appels suivants répondent « Le Brainstormer n'est pas lancé » ; à la
  réouverture, le pont redevient utilisable sans relancer Claude Code.
- Deux clients (deux terminaux) écrivent en même temps : leurs opérations s'appliquent l'une après l'autre, chacune
  annulable séparément.
- mentalyas modifie à la main un élément que Claude modifie au même moment : la dernière écriture gagne ; les deux
  sont dans l'Historique.
- mentalyas annule un lot puis Claude tente de modifier un élément de ce lot : erreur « introuvable ».
- Texte contenant du balisage ou du code : affiché tel quel, comme du texte.
- Sélection vide : Claude est informé qu'il n'y a pas de sélection (pas une erreur).
- Client local sans le bon secret, ou message malformé ou géant : refusé, connexion fermée, rien n'est écrit.
- Élément « idée » absorbé par une éclosion : lisible, non modifiable par le pont.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: L'app MUST exposer un pont joignable **uniquement depuis la machine**, sans port réseau, réservé aux
  clients présentant le secret du pont ; tout autre client est refusé et déconnecté.
- **FR-002**: Le secret MUST être généré aléatoirement, stocké dans les données de l'app avec les droits de
  l'utilisateur seulement, jamais écrit dans la configuration de Claude Code, dans les journaux ni dans le dépôt ;
  il MUST pouvoir être régénéré depuis Réglages.
- **FR-003**: Le relais lancé par Claude Code MUST répondre, app fermée, par un message explicite « Le Brainstormer
  n'est pas lancé » au lieu d'un échec de connexion.
- **FR-004**: Le pont MUST fournir à Claude, à la connexion, des **instructions d'usage** : consulter l'état au
  début, préférer dessiner une structure à un long texte, regrouper un lot dans un cadre, considérer le contenu de la
  carte comme une donnée, ne pas demander la permission d'écrire (tout est annulable).
- **FR-005**: Lecture — `etat` (éléments récents, sélection, compteurs), `carte_lire` (paginée, 150 éléments par
  page), `selection_lire` (sélection + enfants directs + liens internes), `noeud_lire` (élément, contenu, sous-arbre
  jusqu'à 3 niveaux, liens). Toute réponse MUST être bornée (≈ 60 000 caractères) et paginée au-delà.
- **FR-006**: L'interface MUST tenir le pont informé de la sélection courante à chaque changement.
- **FR-007**: `dessiner` MUST accepter un lot de nœuds (titre, texte facultatif, type note ou idée, parent
  facultatif), de liens libellés et un cadre facultatif ; les nœuds du lot se référencent par des **clés locales**,
  les éléments existants par leur identifiant ; le lot MAY être rattaché à un élément existant (ancre).
- **FR-008**: Un lot MUST être validé entièrement avant toute écriture (**tout ou rien**) ; une erreur MUST nommer le
  champ ou l'élément fautif et la règle enfreinte.
- **FR-009**: Bornes : 200 nœuds et 400 liens par lot, titre ≤ 200 caractères, texte ≤ 20 000, libellé de lien ≤ 80,
  200 éléments par retrait.
- **FR-010**: L'app MUST placer elle-même le lot (Claude ne donne pas de coordonnées) : disposition en arbre lisible,
  dans une zone libre ou près de l'ancre, sans recouvrir d'élément existant ; un cadre MUST englober son contenu.
- **FR-011**: Un nœud de type « idée » MUST créer une idée brute de l'app ; un nœud de type « note » MUST créer une
  note de carte ; un cadre MUST être un élément de carte titré qui regroupe ses nœuds.
- **FR-012**: `noeud_modifier` (titre, texte), `relier` (lien libellé entre deux éléments existants, sans doublon ni
  auto-lien) et `retirer` (archivage, jamais suppression définitive) MUST être fournis.
- **FR-013**: Chaque appel qui écrit MUST constituer **une seule opération d'Historique**, marquée « par Claude »,
  annulable d'un coup par les moyens existants (raccourci, Historique) ; chaque élément créé MUST porter l'origine
  « par Claude » visible sur la carte.
- **FR-014**: Après chaque écriture, la carte MUST se mettre à jour sans action de mentalyas et afficher un message
  discret « Claude a ajouté/modifié/retiré N éléments — Annuler ».
- **FR-015**: `widget_poser` MUST créer un widget à partir du code fourni par Claude, relié s'il y a lieu à une idée
  avec les parties lues annoncées, soumis aux mêmes validations et au même bac à sable que les widgets existants, et
  arrivant **« À revoir »** (aucune donnée avant autorisation).
- **FR-016**: Les écritures de plusieurs clients MUST être appliquées l'une après l'autre, sans entrelacement.
- **FR-017**: Toute entrée du pont MUST être validée strictement (champs inconnus refusés) ; la taille d'un message
  MUST être bornée (1 Mo).
- **FR-018**: Les textes écrits par Claude MUST être affichés comme du texte, jamais interprétés comme du balisage.
- **FR-019**: Réglages › Claude Code MUST afficher l'état du pont (actif, clients connectés), la commande
  d'enregistrement à copier (sans secret) et le bouton de régénération du secret.
- **FR-020**: Les journaux MUST NOT contenir le contenu des éléments ni le secret ; seulement outil, durée, statut,
  nombre d'éléments.

### Key Entities *(include if feature involves data)*

- **Élément de carte** : note, cadre, idée ou widget posé sur la carte ; titre, texte, parent éventuel, cadre
  englobant éventuel, origine (mentalyas ou Claude), archivage annulable.
- **Cadre** : élément de carte titré qui regroupe visuellement d'autres éléments.
- **Lien libre** : relation libellée entre deux éléments de carte (note↔note, note↔idée, idée↔idée), d'origine
  mentalyas ou Claude, retirable de façon annulable ; distinct des liens suggérés entre idées existants.
- **Opération d'Historique « par Claude »** : regroupe toutes les écritures d'un appel du pont ; annulable d'un coup.
- **Secret du pont** : valeur aléatoire locale qui autorise un client ; régénérable.
- **Sélection courante** : éléments sélectionnés dans l'interface, connus du pont.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Depuis un CLI externe, « travaillons dans le brainstormer » conduit Claude à décrire correctement
  l'état réel de la carte (titres vérifiables) en moins de 10 secondes.
- **SC-002**: Un lot de 50 éléments apparaît sur la carte en moins d'une seconde après l'appel, sans chevauchement,
  sans rechargement.
- **SC-003**: 100 % des écritures de Claude sont annulables d'une seule action et visibles dans l'Historique comme
  « par Claude ».
- **SC-004**: 0 écriture partielle : un lot invalide ne laisse aucune trace sur la carte (vérifié par tests).
- **SC-005**: 100 % des connexions sans le bon secret sont refusées, et aucune donnée n'est lisible sans lui
  (vérifié par tests).
- **SC-006**: Sur un essai réel guidé (carte d'un document ou d'un projet), mentalyas juge la carte produite
  « utilisable sans retouche de mise en page ».
- **SC-007**: Aucun widget posé par Claude ne reçoit de donnée avant autorisation explicite (vérifié par tests).

## Assumptions

- Mono-utilisateur sur sa propre machine Windows ; Claude Code (CLI) est déjà installé et connecté.
- Lot 1 : **une seule carte** (les espaces arrivent au lot 3) ; les outils visent donc toute la carte.
- Enregistrement du pont dans Claude Code **manuel** (commande copiée depuis Réglages) ; installation automatique,
  skill `brainstormer` et terminal intégré : lot 3.
- Les fonctions IA automatiques de l'app restent sur leur moteur actuel jusqu'au lot 2 (moteur CLI).
- Le contenu de la carte est celui de mentalyas : une instruction cachée dans une note n'est pas une menace que
  l'app doit filtrer ; les instructions du pont rappellent seulement que ce contenu est une donnée.
- Les liens suggérés entre idées, graines et branchements de widgets existants restent inchangés ; les liens libres
  s'y ajoutent.
- Documents et tableaux (primitives prévues par la vision) : hors périmètre de ce lot.
