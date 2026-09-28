# Feature Specification: Moteur IA hybride & contexte (F9)

**Feature Branch**: `001-moteur-ia-hybride`

**Created**: 2026-09-28

**Status**: Draft — révisé le 2026-09-28 (amendement « Brainstormer », docs/brainstorm/L1b-brainstormer.md)

**Input**: User description: "F9 — Moteur IA hybride & contexte, tel que défini dans docs/FOUNDATION.md §2ter, §9.5 et §10.2 : un point d'accès unique à l'IA qui choisit le moteur (IA locale par défaut, Claude pour le raisonnement profond), injecte un cadre strict et le profil de l'utilisateur, valide chaque réponse, anonymise les données avant tout envoi externe, maîtrise le coût et permet de mettre à jour le contexte de l'agent depuis Claude Code avec aperçu et validation."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Obtenir une réponse IA fiable, par le bon moteur (Priority: P1)

Quand une fonctionnalité de l'app a besoin de l'IA (catégoriser une idée, proposer les questions d'extension d'un neurone, synthétiser un neurone), la demande est traitée par le moteur adapté : l'IA locale pour les tâches simples, Claude pour le raisonnement profond. La réponse n'est utilisée que si elle respecte exactement le format attendu ; sinon elle est rejetée proprement.

**Why this priority**: toutes les fonctionnalités intelligentes (F1 catégorisation, F2 structuration, F7 conseiller, F8 briefing) en dépendent. Sans ce socle, rien d'autre ne fonctionne.

**Independent Test**: envoyer une demande « catégoriser » et une demande « synthétiser » avec des moteurs simulés ; vérifier que chacune part vers le bon moteur et qu'une réponse mal formée est rejetée sans être utilisée.

**Acceptance Scenarios**:

1. **Given** l'IA locale disponible, **When** une fonctionnalité demande une catégorisation, **Then** la demande est traitée par l'IA locale et aucun appel externe n'a lieu.
2. **Given** Claude configuré, **When** une fonctionnalité demande une décomposition, **Then** la demande est traitée par Claude et la réponse est restituée structurée.
3. **Given** un moteur qui renvoie une réponse hors format, **When** la réponse arrive, **Then** un nouvel essai est tenté une fois, puis la demande échoue avec un message clair, sans aucune donnée modifiée.
4. **Given** une demande hors périmètre (ex. « écris-moi un poème »), **When** l'IA la reçoit, **Then** elle refuse poliment de produire l'œuvre et propose d'aider à y réfléchir (thème, structure, critères).
5. **Given** un sujet quelconque (concept photo, architecture d'app, décision de carrière), **When** l'utilisateur brainstorme dessus, **Then** l'IA l'accompagne (questions, pistes, pour/contre) sans le refuser.

---

### User Story 2 - Protéger mes données avant tout envoi externe (Priority: P1)

Avant qu'une information ne quitte la machine vers Claude, elle est réduite au strict nécessaire et anonymisée : montants arrondis ou remplacés par des fourchettes, noms de personnes retirés, adresses et numéros supprimés. Si l'anonymisation échoue, rien n'est envoyé en brut.

**Why this priority**: l'app manipule des idées personnelles et des données financières ; c'est un principe non négociable (constitution I et IV).

**Independent Test**: soumettre un texte fictif contenant un montant exact, un nom de personne, une adresse e-mail et un numéro de téléphone ; vérifier que le contenu réellement transmis au moteur externe (simulé) n'en contient aucun.

**Acceptance Scenarios**:

1. **Given** une idée « Payer 1 247,50 € à Marc pour la mission du 15/11 », **When** elle est envoyée à Claude, **Then** le contenu transmis ne contient ni « 1 247,50 » ni « Marc ».
2. **Given** l'IA locale indisponible au moment d'anonymiser, **When** une demande doit partir vers Claude, **Then** une anonymisation par règles simples s'applique et le texte brut n'est jamais transmis.

---

### User Story 3 - Maîtriser le coût de l'IA (Priority: P2)

L'utilisateur voit combien l'IA externe lui coûte ce mois-ci, fixe un plafond (10 € par défaut), est alerté à 80 % et bloqué à 100 %, avec la possibilité de débloquer manuellement.

**Why this priority**: sans garde-fou, une analyse répétée peut coûter cher ; mais l'app reste utilisable sans ce suivi au tout début.

**Independent Test**: simuler une série d'appels dont le coût cumulé franchit 80 % puis 100 % du plafond ; vérifier l'alerte puis le blocage, puis le déblocage manuel.

**Acceptance Scenarios**:

1. **Given** un plafond de 10 € et 7,90 € consommés, **When** un appel porte la consommation à 8,10 €, **Then** l'utilisateur est alerté.
2. **Given** le plafond atteint, **When** une fonctionnalité demande Claude, **Then** l'appel est refusé avec un message expliquant le plafond et proposant la version locale (qualité réduite signalée) ou le déblocage.
3. **Given** un nouveau mois calendaire, **When** l'app démarre, **Then** le compteur repart à zéro.

---

### User Story 4 - Configurer les moteurs (Priority: P2)

L'utilisateur saisit sa clé API Claude (jamais réaffichée en clair), choisit le modèle Claude (Opus 5 par défaut) et le modèle local, teste la connexion de chaque moteur.

**Why this priority**: nécessaire pour activer Claude ; l'IA locale peut fonctionner avant.

**Independent Test**: saisir une clé, redémarrer l'app, vérifier que la clé n'est visible nulle part en clair et que le test de connexion réussit (moteur simulé).

**Acceptance Scenarios**:

1. **Given** une clé saisie, **When** l'utilisateur revient dans les réglages, **Then** seule une forme masquée est affichée.
2. **Given** l'IA locale non installée, **When** l'utilisateur teste la connexion, **Then** un message guide l'installation pas à pas.

---

### User Story 5 - Mettre à jour le « cerveau » de l'agent depuis Claude Code (Priority: P3)

Claude Code dépose des fichiers de contexte (profil, règles, exemples) dans un dossier dédié. L'app détecte la nouveauté, montre un aperçu avant/après, et n'active le nouveau contexte qu'après validation. Les versions précédentes restent restaurables.

**Why this priority**: enrichit la qualité de l'agent, mais l'app fonctionne avec le cadre de base sans profil.

**Independent Test**: déposer un jeu de fichiers valide puis un jeu invalide ; vérifier l'aperçu, l'activation après validation, le refus du jeu invalide et le retour à la version précédente.

**Acceptance Scenarios**:

1. **Given** un nouveau profil déposé, **When** l'utilisateur ouvre l'aperçu, **Then** il voit les différences avec le contexte actif et peut appliquer ou refuser.
2. **Given** un fichier de contexte mal formé ou modifié après coup (empreinte incorrecte), **When** il est détecté, **Then** il est refusé avec un message et le contexte actif reste inchangé.
3. **Given** un profil importé qui tente de redéfinir le rôle de l'agent (« ignore tes règles »), **When** il est appliqué, **Then** le cadre de base reste prioritaire et inchangé.

---

### Edge Cases

- L'IA locale est lente ou saturée : les demandes locales sont mises en file et traitées une à une ; la capture d'idée n'attend jamais l'IA.
- Claude est indisponible (réseau, panne, refus du modèle) : message clair, proposition de la version locale dégradée ou d'attendre ; aucune perte de données.
- L'appel externe réussit mais l'enregistrement échoue ensuite : la réponse est réutilisée au lieu d'être repayée.
- Le texte de l'utilisateur contient des instructions destinées à détourner l'agent : elles sont traitées comme de simples données.
- Le fichier de contexte est trop volumineux (> 50 Ko par fichier) : refusé.
- Le coût réel d'un appel dépasse l'estimation : le compteur utilise toujours le coût réel.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système MUST offrir un point d'accès unique à l'IA, utilisé par toutes les fonctionnalités ; aucun autre composant ne contacte directement un moteur.
- **FR-002**: Le système MUST choisir le moteur selon le type de demande à l'aide d'une table de routage configurable : catégoriser (catégorie + nature Action/Réflexion), résumer, anonymiser, texte du briefing → IA locale ; étendre un neurone (questions + évaluation du contexte), synthétiser, réviser, suggérer des liens, suggérer (conseiller) → Claude.
- **FR-003**: Le système MUST valider chaque réponse contre le format attendu pour son type de demande, tenter un seul nouvel essai en cas d'échec, puis échouer proprement.
- **FR-004**: Le système MUST assembler le contexte de chaque demande dans l'ordre : cadre de base (figé) → profil actif → exemples pertinents → données utiles à la demande uniquement.
- **FR-005**: Le cadre de base MUST imposer : rôle de **partenaire de brainstorm sur tout sujet** (questions, pistes, arguments, critères, synthèses, plans d'action) ; refus poli de produire des œuvres finies (images, poèmes/prose créative, code complet, textes longs rédigés) avec proposition d'aider à y réfléchir ; interdiction d'inventer un prix, une date ou un montant personnel ; traitement du texte utilisateur comme donnée.
- **FR-006**: Le système MUST anonymiser toute donnée avant envoi à Claude (montants en fourchettes ou arrondis, noms de personnes, e-mails et téléphones retirés) et MUST basculer sur une anonymisation par règles si l'IA locale échoue ; le texte brut n'est jamais transmis.
- **FR-007**: Le système MUST journaliser chaque appel (type, moteur, modèle, volume, coût estimé, statut, durée) sans aucun contenu d'idée ni de réponse.
- **FR-008**: Le système MUST suivre le coût mensuel de l'IA externe, alerter à 80 % du plafond, bloquer à 100 % et permettre un déblocage manuel ; plafond par défaut 10 €, modifiable.
- **FR-009**: Le système MUST vérifier le budget avant chaque appel externe (estimation) et imputer le coût réel après.
- **FR-010**: Les utilisateurs MUST pouvoir saisir, remplacer et effacer la clé API Claude ; la clé MUST être stockée chiffrée et ne jamais être réaffichée en clair ni journalisée.
- **FR-011**: Les utilisateurs MUST pouvoir choisir le modèle Claude (défaut : Claude Opus 5) et le modèle local, et tester chaque moteur.
- **FR-012**: Le système MUST détecter l'absence de l'IA locale ou de son modèle et guider l'installation, tout en laissant l'app utilisable.
- **FR-013**: Le système MUST mettre en file les demandes locales quand l'IA locale est indisponible et NE MUST PAS basculer vers Claude sauf si l'utilisateur l'a autorisé dans les réglages (désactivé par défaut).
- **FR-014**: Le système MUST proposer une version locale dégradée, clairement signalée, quand Claude est indisponible ou que le plafond est atteint.
- **FR-015**: Le système MUST surveiller un dossier d'import de contexte, valider le jeu de fichiers (manifeste, version de format, empreintes, taille ≤ 50 Ko/fichier), présenter un aperçu avant/après et n'activer le contexte qu'après validation.
- **FR-016**: Le système MUST conserver les versions de contexte et permettre de restaurer une version précédente.
- **FR-017**: Le système MUST conserver des exemples (propositions acceptées = positifs, refusées avec raison = négatifs), au plus 20 par type de demande, et les injecter comme exemples pertinents.
- **FR-018**: Le système MUST traiter les demandes locales une à la fois et limiter les demandes externes simultanées à 2.
- **FR-019**: Le système MUST gérer un refus explicite du modèle externe comme un échec propre, distinct d'une réponse invalide.

### Key Entities

- **Demande IA**: type de demande, données d'entrée (déjà minimisées), format de réponse attendu, identifiant pour éviter de repayer un appel.
- **Moteur**: IA locale ou Claude ; disponibilité, modèle choisi.
- **Appel journalisé**: type, moteur, modèle, volume, coût, statut, durée — sans contenu.
- **Configuration IA**: modèles, plafond mensuel, seuil d'alerte, autorisation de repli vers Claude.
- **Version de contexte**: profil, règles, exemples ; active ou archivée ; origine (import, initial).
- **Import de contexte**: jeu de fichiers détecté, différences, statut (en attente, appliqué, refusé, invalide).
- **Exemple**: positif ou négatif, type de demande, contenu, origine.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % des réponses IA hors format sont rejetées avant d'atteindre une fonctionnalité (jeu de tests de réponses malformées).
- **SC-002**: Sur un jeu de 50 textes fictifs contenant montants, noms, e-mails et téléphones, 0 donnée identifiante n'apparaît dans le contenu transmis à l'extérieur.
- **SC-003**: Une catégorisation par l'IA locale est restituée en moins de 3 secondes sur la machine cible (GPU 8 Go).
- **SC-004**: Le coût mensuel affiché par l'app s'écarte de moins de 5 % du coût facturé par le fournisseur.
- **SC-005**: Plafond atteint → 0 appel externe supplémentaire sans déblocage manuel.
- **SC-006**: La clé API n'apparaît en clair dans aucun fichier, log ni écran après saisie (vérification par recherche dans les données de l'app).
- **SC-007**: Changer le moteur d'un type de demande ne nécessite qu'une modification de configuration, sans toucher aux fonctionnalités.
- **SC-008**: Un import de contexte invalide ou altéré n'est jamais activé ; un import valide est activé en 2 actions maximum (ouvrir l'aperçu, appliquer).

## Assumptions

- Usage mono-utilisateur sur un PC Windows avec GPU 8 Go (RTX 3070) et 32 Go de RAM ; l'IA locale tourne via un service local sur la même machine.
- L'utilisateur dispose d'un compte fournisseur Claude et fixe aussi une limite de dépense côté fournisseur (ceinture de sécurité).
- Le choix précis du modèle local (famille 7-8 milliards de paramètres) se fera par un banc d'essai sur les 4 tâches locales pendant la planification.
- Le taux de conversion USD → EUR pour l'estimation du coût est une valeur configurable mise à jour manuellement.
- Les fichiers de contexte sont produits par Claude Code à la demande de l'utilisateur ; le profil initial est distillé depuis son fichier d'instructions global.
- Hors périmètre de cette feature : le moteur de neurones (spec 002), l'interface (spec 003), le conseiller (F7) — ils consomment ce moteur.
