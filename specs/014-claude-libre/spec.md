# Feature Specification: Claude libre — parité avec le terminal

**Feature Branch**: `014-claude-libre` · **Created**: 2026-10-06 · **Status**: Draft — à valider par mentalyas

**Input**: demande de mentalyas (2026-10-06) : « je veux quand même avoir la main sur des modifs via le chat avec
Claude, il ne doit pas être aussi restreint, il doit être libre comme toi depuis l'IDE ; l'interface est utile que pour
moi pour la structuration d'idées et l'organisation, mais Claude ne doit pas être aussi bridé ; il doit avoir accès même
au code source de l'app elle-même si je le demande, car plus tard l'idée est de permettre à l'app de s'automodifier via
Claude ».

**Constat (test guidé spec 013, 2026-10-06)** : après une exécution, mentalyas demande « corrige ça » dans le chat de
l'action ; Claude ne peut ni écrire ni lancer de commande (pas d'exécution en cours), le fil affiche « fichier modifié »
alors que l'écriture a été refusée, et Claude tente de reproposer une action finale sur une action finale.

## Décisions (2026-10-06)
| # | Sujet | Décision |
|---|-------|----------|
| D1 | Modes | Trois **modes de permission** par conversation, comme Maj+Tab dans le terminal : **Demander** (défaut : chaque écriture ou commande apparaît dans le chat avec « Autoriser », « Toujours pour ce projet », « Refuser »), **Accepter les modifications** (écritures sans demande, commandes demandées), **Libre** (aucune demande). |
| D2 | Dossiers | Claude travaille dans le dossier du projet lié (sinon l'espace de travail du profil) ; mentalyas peut **autoriser d'autres dossiers** pour une conversation, y compris le code source de l'app. |
| D3 | Réglages | Option pour charger **ses réglages Claude Code** (règles d'autorisation, hooks, instructions globales), comme dans le terminal ; ceux d'un dépôt lié ne sont chargés que si mentalyas le marque **de confiance**. |
| D4 | Fin de la cage | Remplace, dans la spec 013, les outils d'écriture maison, la règle « écriture seulement pendant une exécution » et la liste de scripts approuvés (D2, D2 bis). Les actions finales gardent leur rôle : contexte de la branche, livrable, revue. Le livrable est reconstitué à partir des **modifications réelles**. |
| D5 | Fil fidèle | Le fil d'une conversation dit ce qui s'est **réellement** passé : un outil refusé ou en erreur apparaît « refusé » / « échoué », jamais comme réussi. |
| D6 | Après exécution | mentalyas demande des modifications **directement dans le chat** de l'action ; elles s'ajoutent à son livrable. |
| D7 (2026-10-06) | Commit par étape | Claude peut **commiter** depuis l'app (git est une commande comme une autre, D1). Une action finale gagne « Commiter l'étape » : Claude prépare un commit des seuls fichiers de son livrable, message au format Conventional Commits rattaché au rang de l'étape ; en mode Demander, la commande exacte s'affiche et attend l'accord de mentalyas. Jamais de push sans demande explicite. |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Demander une modification à Claude depuis le chat, et la valider (Priority: P1) 🎯 MVP

Dans la conversation d'un neurone lié à un projet, mentalyas demande « corrige l'import de `external.test.ts` puis
lance les tests ». En mode Demander, Claude prépare la modification ; une carte apparaît dans le chat (fichier, aperçu
du changement, ou commande exacte) avec Autoriser / Toujours pour ce projet / Refuser. Autorisée, l'action a lieu et
Claude continue.

**Why this priority**: c'est le geste qui manquait au test de la spec 013 : parler à Claude et qu'il agisse, sous
contrôle de mentalyas.

**Independent Test**: projet test lié ; dans le chat, « remplace node:test par vitest dans external.test.ts et lance
npm test » → une carte d'écriture (aperçu du remplacement) puis une carte de commande (`npm test`) ; autoriser les deux
→ le fichier change sur le disque, la sortie des tests apparaît dans le fil ; refuser la commande → Claude le dit et
s'arrête proprement.

**Acceptance Scenarios**:

1. **Given** une conversation en mode Demander, **When** Claude veut écrire, modifier un fichier ou lancer une
   commande, **Then** le chat affiche une demande lisible (chemin et aperçu du changement, ou commande exacte et
   dossier) et attend la réponse de mentalyas ; rien n'a lieu avant.
2. **Given** une demande affichée, **When** mentalyas clique « Autoriser », **Then** l'action a lieu une fois et
   Claude poursuit ; **When** il clique « Refuser », **Then** rien n'a lieu, Claude en est informé et le fil affiche
   « refusé ».
3. **Given** une demande, **When** mentalyas clique « Toujours pour ce projet », **Then** l'action a lieu et les
   demandes de même nature (même outil, même commande ou même motif de commande) ne sont plus posées pour ce projet ;
   la règle est visible et révocable dans les réglages du projet.
4. **Given** une demande en attente, **When** mentalyas ferme le chat, change de neurone ou arrête la conversation,
   **Then** la demande est refusée d'office et le fil le dit.
5. **Given** une conversation, **When** Claude lit des fichiers du projet, **Then** aucune demande n'est posée
   (lecture libre dans les dossiers autorisés, comme dans le terminal).

---

### User Story 2 — Choisir le mode de la conversation (Priority: P1) 🎯 MVP

mentalyas choisit, dans l'en-tête du chat, le mode de la conversation : Demander, Accepter les modifications ou Libre.
Le mode est visible en permanence et retenu pour cette conversation.

**Why this priority**: D1 — la liberté de Claude se règle comme dans le terminal, au cas par cas.

**Independent Test**: passer une conversation en « Accepter les modifications » → une écriture se fait sans carte, une
commande demande encore ; passer en « Libre » (avertissement à confirmer) → ni écriture ni commande ne demandent ;
rouvrir l'app → la conversation a gardé son mode ; une nouvelle conversation démarre en Demander.

**Acceptance Scenarios**:

1. **Given** une nouvelle conversation, **When** elle s'ouvre, **Then** elle est en mode Demander, sauf si mentalyas
   a choisi un autre mode par défaut dans les réglages.
2. **Given** le mode Accepter les modifications, **When** Claude écrit ou modifie un fichier dans un dossier autorisé,
   **Then** aucune demande n'est posée ; **When** il lance une commande, **Then** une demande est posée (sauf règle
   « Toujours »).
3. **Given** mentalyas qui choisit Libre, **When** il le choisit, **Then** l'app l'avertit une fois par conversation
   (Claude pourra écrire et lancer n'importe quelle commande sans demander ; un fichier piégé peut en profiter) et
   attend sa confirmation.
4. **Given** un changement de mode pendant que Claude travaille, **When** mentalyas le fait, **Then** le nouveau mode
   s'applique au plus tard au message suivant, et l'interface dit lequel.
5. **Given** une conversation, **When** mentalyas regarde le chat, **Then** le mode courant est affiché en permanence,
   et Libre est visuellement distinct.

---

### User Story 3 — Un fil qui dit la vérité (Priority: P1) 🎯 MVP

Chaque action de Claude dans le fil montre son vrai résultat : réussie, refusée (par mentalyas ou par une règle) ou
échouée (erreur), avec la raison courte.

**Why this priority**: D5 — un fil qui affiche « fichier modifié » pour une écriture refusée trompe mentalyas sur
l'état de son projet.

**Independent Test**: refuser une écriture → le fil affiche « écriture refusée : <fichier> » ; une commande qui sort en
erreur → « commande échouée (code 1) » ; une écriture réussie → « fichier modifié : <fichier> ».

**Acceptance Scenarios**:

1. **Given** un outil de Claude refusé ou en erreur, **When** le fil l'affiche, **Then** il le marque « refusé » ou
   « échoué » avec la raison courte, jamais avec le libellé d'une réussite.
2. **Given** un outil en cours (demande en attente, commande longue), **When** le fil l'affiche, **Then** il le marque
   « en attente » ou « en cours » jusqu'à son résultat.

---

### User Story 4 — Les actions finales sur le nouveau socle (Priority: P1)

Exécuter une action finale lance Claude avec le contexte de la branche, dans le mode de la conversation de l'action.
Tout ce que Claude modifie dans le projet pendant l'exécution, puis dans les échanges qui suivent dans ce même chat,
s'ajoute au livrable de l'action, que mentalyas revoit comme prévu par la spec 013.

**Why this priority**: D4 et D6 — les actions finales restent l'outil de structuration ; elles ne doivent plus être le
seul moyen d'écrire.

**Independent Test**: exécuter une action → les fichiers modifiés apparaissent au livrable ; dans le même chat,
« corrige l'import » → la modification s'ajoute au livrable ; une modification faite par une commande de Claude
(ex. un formateur) apparaît aussi au livrable (projet sous git).

**Acceptance Scenarios**:

1. **Given** une action finale prête, **When** mentalyas clique « Exécuter », **Then** Claude reçoit le contexte de la
   branche et travaille dans le mode de la conversation de l'action ; aucune liste de scripts à approuver n'est exigée.
2. **Given** une exécution puis des échanges dans le chat de l'action, **When** Claude modifie des fichiers du projet,
   **Then** chacun figure au livrable (créé, modifié ou supprimé) avec sa différence depuis l'état d'avant la première
   exécution.
3. **Given** un projet sous gestion de versions, **When** une commande lancée par Claude modifie des fichiers,
   **Then** ces fichiers figurent aussi au livrable ; sans gestion de versions, seuls les fichiers modifiés par les
   outils d'écriture de Claude y figurent, et le livrable le signale.
4. **Given** une action finale, **When** Claude reçoit son contexte, **Then** il sait qu'elle est déjà une action
   finale et ne propose ni une nouvelle action finale ni un plan sur elle.

---

### User Story 5 — Autoriser d'autres dossiers, dont le code de l'app (Priority: P2)

Depuis le chat, mentalyas autorise un dossier supplémentaire pour la conversation (par exemple le dépôt de l'app
elle-même) ; Claude peut alors y lire et, selon le mode, y écrire.

**Why this priority**: D2 — préalable à l'automodification de l'app, et utile pour travailler sur deux dépôts liés.

**Independent Test**: « Autoriser un autre dossier » → choisir le dépôt de l'app → Claude lit un fichier de l'app et,
en mode Demander, propose une modification avec une carte ; retirer le dossier → Claude n'y a plus accès au message
suivant.

**Acceptance Scenarios**:

1. **Given** une conversation, **When** mentalyas autorise un dossier, **Then** il apparaît dans la liste des dossiers
   de la conversation et Claude y a accès dès le message suivant.
2. **Given** un dossier autorisé, **When** mentalyas le retire, **Then** Claude n'y a plus accès au message suivant.
3. **Given** le dossier des données de l'app (profil : base chiffrée, secrets), **When** mentalyas tente de
   l'autoriser, **Then** l'app refuse avec la raison.

---

### User Story 6 — Mes réglages Claude Code et les dépôts de confiance (Priority: P3)

mentalyas active dans Réglages « Utiliser mes réglages Claude Code » : ses règles d'autorisation, hooks et instructions
globales s'appliquent aux conversations de l'app comme dans le terminal. Il peut marquer un dossier lié « de
confiance » pour que les réglages de ce dépôt s'appliquent aussi.

**Why this priority**: D3 — confort et cohérence avec le terminal ; pas nécessaire pour agir.

**Independent Test**: activer l'option → une commande autorisée par ses réglages ne pose plus de demande ; un dépôt non
marqué de confiance qui contient un hook → le hook ne s'exécute pas ; marqué de confiance → il s'exécute.

**Acceptance Scenarios**:

1. **Given** l'option désactivée (défaut), **When** une conversation démarre, **Then** aucun réglage ni hook de
   mentalyas ni du dépôt ne s'applique.
2. **Given** l'option activée, **When** une conversation démarre, **Then** les réglages utilisateur de mentalyas
   s'appliquent ; ceux d'un dépôt lié seulement s'il est marqué de confiance.
3. **Given** un dépôt marqué de confiance, **When** mentalyas retire la confiance, **Then** ses réglages cessent de
   s'appliquer à la conversation suivante.

---

### User Story 7 — Commiter chaque étape d'action (Priority: P1)

Une action finale est revue et acceptée. mentalyas clique « Commiter l'étape » (ou le demande dans le chat) : Claude
ajoute explicitement les fichiers du livrable, propose un message (ex. `feat(budget): tableau des postes (①.1.2)`)
et lance le commit ; en mode Demander, mentalyas voit la commande exacte et la liste des fichiers avant d'autoriser.

**Why this priority**: D7 — un historique git qui suit le plan d'attaque, étape par étape, sans quitter la carte.

**Independent Test**: action finale acceptée dont le livrable a 2 fichiers, projet sous git → « Commiter l'étape » →
carte de demande « git add <2 fichiers> » puis « git commit -m … » ; autoriser → `git log` du projet montre le commit,
avec seulement ces 2 fichiers ; l'action affiche « commité » avec le court identifiant du commit.

**Acceptance Scenarios**:

1. **Given** une action finale dont le livrable a des fichiers, dans un projet sous git, **When** mentalyas clique
   « Commiter l'étape », **Then** Claude ajoute **nommément** les fichiers du livrable (jamais tout le dossier) et
   propose un message Conventional Commits qui cite le rang et le titre de l'étape.
2. **Given** le mode Demander, **When** Claude lance `git add` puis `git commit`, **Then** chaque commande s'affiche
   exactement (fichiers et message) et attend l'accord de mentalyas ; un refus n'a aucun effet.
3. **Given** un commit réussi, **When** il se termine, **Then** l'action finale affiche « commité » et l'identifiant
   court du commit ; le fil de la conversation le trace.
4. **Given** des fichiers modifiés hors du livrable, **When** Claude prépare le commit, **Then** ils ne sont pas inclus
   et Claude les signale.
5. **Given** une demande de push, **When** mentalyas ne l'a pas explicitement demandée, **Then** Claude ne pousse pas.
6. **Given** un projet sans git, ou un livrable vide, **When** mentalyas ouvre l'action, **Then** « Commiter l'étape »
   est indisponible avec la raison.

---

### Edge Cases

- L'app fermée avec une demande en attente : à la réouverture, la demande est caduque (refusée), le fil le dit.
- Plusieurs demandes en rafale : elles s'affichent dans l'ordre, une à la fois ; refuser l'une n'autorise pas les
  suivantes.
- Commande longue ou bloquée : mentalyas peut arrêter la conversation ; la commande est arrêtée avec ses
  sous-processus.
- Mode Libre et contenu piégé (un fichier du projet ou une fiche qui demande de lancer une commande) : Claude peut
  agir sans demander ; c'est le risque assumé du mode ; l'avertissement de US2 le dit.
- Demande sur un chemin hors des dossiers autorisés : refusée d'office par Claude Code, sans carte.
- Dossier lié devenu inaccessible : la conversation démarre sans lui et le dit.
- Livrable d'une action dont des fichiers sont supprimés par Claude : ils apparaissent « supprimé » et un retour
  arrière les recrée.
- Écriture de Claude sur la carte (outils du pont) : inchangée — directe, marquée « par Claude », annulable.
- Tâches automatiques de l'app (catégorisation, etc.) : inchangées, sans outils.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Dans toute conversation d'un neurone, Claude MUST pouvoir lire, créer, modifier, supprimer des fichiers
  et lancer des commandes dans les dossiers autorisés de la conversation, à tout moment, selon le mode courant.
- **FR-002**: Chaque conversation MUST avoir un mode parmi Demander, Accepter les modifications et Libre ; Demander
  est le défaut (réglable) ; le mode est retenu par conversation et affiché en permanence.
- **FR-003**: En mode Demander, toute écriture et toute commande MUST attendre une réponse explicite de mentalyas dans
  le chat ; en mode Accepter les modifications, seules les commandes l'attendent ; en mode Libre, aucune.
- **FR-004**: Une demande MUST montrer ce qui va se passer (chemin et aperçu du changement ; commande exacte et
  dossier) ; sans réponse (chat fermé, conversation arrêtée, app fermée), elle MUST être refusée.
- **FR-005**: « Toujours pour ce projet » MUST créer une règle par projet lié, visible et révocable dans l'app ; les
  règles MUST NOT être écrites dans les fichiers du projet.
- **FR-006**: Passer en mode Libre MUST être confirmé après un avertissement, une fois par conversation.
- **FR-007**: mentalyas MUST pouvoir autoriser et retirer des dossiers supplémentaires par conversation ; le dossier
  de données de l'app MUST NOT pouvoir être autorisé.
- **FR-008**: Le fil MUST refléter le résultat réel de chaque outil : réussi, refusé, échoué (raison courte), en
  attente, en cours.
- **FR-009**: Exécuter une action finale MUST transmettre le contexte de la branche (spec 013 FR-004) et se dérouler
  dans le mode de la conversation de l'action, sans liste de scripts approuvés.
- **FR-010**: Le livrable d'une action finale MUST cumuler les fichiers créés, modifiés ou supprimés pendant ses
  exécutions et les échanges qui suivent dans sa conversation, avec la différence depuis l'état d'avant la première
  exécution ; dans un projet sous gestion de versions, les changements faits par des commandes MUST y figurer.
- **FR-011**: Le contexte d'une conversation d'action finale MUST indiquer à Claude son état (action finale, livrable
  en cours) pour qu'il ne propose ni action finale ni plan sur elle.
- **FR-012**: Une option de réglage MUST permettre d'appliquer les réglages Claude Code de mentalyas (désactivée par
  défaut) ; les réglages d'un dépôt lié MUST s'appliquer seulement s'il est marqué de confiance.
- **FR-013**: Les écritures de Claude sur la carte (pont MCP) MUST rester inchangées : directes, marquées « par
  Claude », annulables.
- **FR-015**: Une action finale dont le livrable a des fichiers, dans un projet sous git, MUST offrir « Commiter
  l'étape », qui demande à Claude un commit des seuls fichiers du livrable, nommés explicitement, avec un message
  Conventional Commits citant le rang et le titre de l'étape, sans ligne de co-auteur.
- **FR-016**: Un commit MUST suivre le mode de permission de la conversation (en mode Demander : commande exacte
  affichée et autorisée) ; Claude MUST NOT pousser sans demande explicite de mentalyas.
- **FR-017**: L'action finale MUST afficher l'état « commité » et l'identifiant court du dernier commit de son livrable.
- **FR-014**: Chaque demande, réponse et changement de mode MUST être tracé localement (date, conversation, nature,
  décision) sans contenu de fichier ni de commande dans les logs.

### Key Entities

- **Mode de conversation** : Demander, Accepter les modifications ou Libre ; par conversation ; défaut réglable.
- **Demande de permission** : outil, chemin ou commande, aperçu, état (en attente, autorisée, refusée, caduque),
  décision et date.
- **Règle « Toujours »** : par projet lié ; outil et motif ; date ; révocable.
- **Dossier autorisé** : par conversation ; chemin ; date d'ajout.
- **Dépôt de confiance** : dossier lié marqué par mentalyas ; date.
- **Livrable** (spec 013, étendu) : fichiers créés, modifiés ou supprimés ; origine (outil d'écriture ou commande).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Depuis le chat, une modification demandée à Claude aboutit sur le disque en un message et, en mode
  Demander, un clic.
- **SC-002**: 0 écriture ou commande sans réponse de mentalyas en mode Demander, vérifié avec des demandes hostiles
  (fichier du projet qui demande une commande, fiche qui demande d'écrire ailleurs).
- **SC-003**: 100 % des outils refusés ou en erreur apparaissent comme tels dans le fil.
- **SC-004**: 100 % des fichiers changés pendant une exécution et dans les échanges qui suivent figurent au livrable
  (projet sous gestion de versions).
- **SC-006**: Une étape d'action acceptée se commite en un clic plus une autorisation, avec 100 % des fichiers du
  livrable et 0 fichier hors livrable.
- **SC-005**: Ce que mentalyas fait dans le terminal se fait depuis le chat : sur 5 tâches courantes
  (corriger un fichier, lancer les tests, installer une dépendance, lire un autre dépôt, modifier l'app), 5 sont
  faisables depuis le chat (validé en test guidé).

## Assumptions

- Claude reste joint uniquement par le CLI officiel `claude` de mentalyas (abonnement) ; les modes et demandes sont
  ceux de Claude Code lui-même, relayés par l'app.
- Les tâches automatiques de l'app restent sans outils, sans serveur MCP et sans réglage utilisateur.
- Le filet pour le code est la gestion de versions du projet ; l'app ne fait aucun commit elle-même ; l'Historique de
  l'app couvre la carte et le livrable.
- La spec 013 garde US1 (proposer l'action finale), US3 (revue du livrable, D4 visionneuse) et US4 (tests du livrable,
  désormais lancés comme une commande ordinaire depuis l'action) ; ses D2 et D2 bis sont remplacés.
- Hors périmètre : automodification orchestrée de l'app (branche ou copie de travail dédiée, redémarrage, retour au
  dernier état sain) — spec ultérieure ; partage de règles entre projets ; modes par neurone plutôt que par
  conversation.
- Impose la constitution 4.0.0 : principe II (les écritures de Claude dans les fichiers suivent le mode choisi par
  mentalyas), III (contrôle par le mode et les demandes plutôt que par des outils maison), IV (conversations : outils
  et réglages selon les choix de mentalyas).
