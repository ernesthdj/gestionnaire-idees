# Feature Specification: Widgets proposés au verrouillage

**Feature Branch**: `006-widgets-au-verrouillage`

**Created**: 2026-09-30

**Status**: Draft (à valider par mentalyas)

**Input**: User description: « Quand on verrouille une idée et que Claude fait la synthèse finale (actions à mener,
questions ouvertes…), si le contexte le permet et qu'il est utile, Claude peut aussi proposer directement un outil
widget associé à cette idée, un ou plusieurs. L'utilisateur coche le ou les outils qu'il veut avoir, et à l'éclosion,
quand le nœud absorbe ses nœuds enfants, Claude génère en même temps le ou les widgets associés, avec la connexion
directe au nœud et une sortie de données structurée dans un autre nœud conteneur si besoin. »

**Cadre** : constitution 1.2.0, principes II (rien n'est appliqué sans acceptation, application atomique et annulable)
et III (toute capacité impose la revue du code avant exécution) ; spec 003 (verrouillage, aperçu, éclosion) ;
spec 004 (widgets isolés) ; spec 005 (branchement d'entrée, revue, cadre résultat).
Décisions du 2026-09-30 (mentalyas) : **la revue de la spec 005 est conservée sans exception** — cocher une
proposition ne vaut pas autorisation ; **cette spec se livre après le lot 2 de la spec 005** (cadre résultat).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Claude propose des outils dans l'aperçu de synthèse (Priority: P1)

L'utilisateur verrouille une idée. L'aperçu de synthèse s'affiche comme aujourd'hui, avec en plus, quand l'idée s'y
prête, une section « Outils proposés » : jusqu'à trois outils, chacun avec un titre, une phrase sur ce qu'il fait, ce
qu'il lira de l'idée et s'il produit un résultat. Aucun n'est coché par défaut. Beaucoup d'idées n'ont besoin d'aucun
outil : la section est alors absente.

**Independent Test**: verrouiller une idée « Budget du mariage » → l'aperçu propose par exemple « Tableau des
dépenses » ; verrouiller une idée « Faut-il changer de métier ? » → aucune section « Outils proposés ».

**Acceptance Scenarios**:

1. **Given** une idée verrouillée, **When** la synthèse revient avec des propositions d'outils valides, **Then** l'aperçu les affiche (titre, description, parties lues, « produit un résultat » le cas échéant), toutes décochées.
2. **Given** une synthèse sans proposition, **Then** l'aperçu est identique à celui d'aujourd'hui.
3. **Given** une proposition mal formée parmi d'autres, **Then** elle seule est écartée ; la synthèse et les autres propositions restent affichées.
4. **Given** plus de trois propositions reçues, **Then** seules les trois premières sont affichées.
5. **Given** l'utilisateur coche un ou plusieurs outils, **Then** l'aperçu indique le nombre de générations qui seront lancées à la confirmation (une par outil coché).
6. **Given** l'aperçu est refait ou abandonné, **Then** ses propositions disparaissent avec lui ; rien n'est créé.
7. **Given** une idée qui porte déjà des widgets branchés, **When** elle est verrouillée à nouveau (cycle suivant), **Then** ces outils ne sont pas reproposés.

### User Story 2 - Les outils cochés apparaissent à l'éclosion (Priority: P1)

L'utilisateur confirme. Pendant que l'idée absorbe ses sous-neurones, un cadre de widget apparaît pour chaque outil
coché, à côté de l'idée, déjà relié à elle et titré. Le cadre affiche « Claude prépare cet outil… » puis, une fois
généré, l'outil lui-même avec le bandeau « À revoir ». Annuler l'éclosion retire aussi ces cadres et leurs liens.

**Independent Test**: cocher deux outils, confirmer → deux cadres reliés à l'idée apparaissent aussitôt, se
remplissent l'un après l'autre ; « Annuler » dans la notification d'éclosion les fait disparaître avec le reste.

**Acceptance Scenarios**:

1. **Given** des outils cochés, **When** « Confirmer », **Then** l'éclosion crée, dans la même opération qu'elle, un cadre par outil coché et son lien d'entrée vers l'idée ; ils sont visibles dès la fin de l'animation.
2. **Given** les cadres créés, **Then** la génération de chaque outil démarre sans autre action, en arrière-plan ; la carte reste utilisable et chaque cadre montre l'indicateur IA.
3. **Given** aucun outil coché, **Then** l'éclosion est identique à celle d'aujourd'hui et aucun appel de génération n'est lancé.
4. **Given** une éclosion avec outils, **When** elle est annulée (notification ou Historique), **Then** les cadres et leurs liens disparaissent avec elle ; une génération encore en cours est abandonnée et son résultat ignoré.
5. **Given** les cadres posés, **Then** ils ne recouvrent ni l'idée, ni sa prochaine étape, ni les autres objets de la carte, et se déplacent ensuite comme tout widget.
6. **Given** une proposition qui ne lit aucune partie de l'idée, **Then** le cadre est posé à côté de l'idée sans lien d'entrée et fonctionne comme un widget de la spec 004.

### User Story 3 - Revue avant que l'outil lise l'idée (Priority: P1)

Un outil généré arrive branché mais « À revoir » : il ne reçoit rien tant que l'utilisateur n'a pas autorisé sa
version. La revue est celle de la spec 005 (code, capacité demandée, parties transmises) ; les parties annoncées
dans la proposition sont précochées, les autres décochées.

**Acceptance Scenarios**:

1. **Given** un outil tout juste généré, **Then** il affiche le bandeau « À revoir » et ne reçoit aucune donnée de l'idée.
2. **Given** la revue ouverte, **Then** les parties précochées sont exactement celles annoncées dans la proposition ; l'utilisateur peut en cocher ou en décocher avant d'autoriser.
3. **Given** la revue autorisée, **Then** l'outil reçoit les parties cochées, et seulement elles.
4. **Given** un outil qui produit un résultat, **When** il émet pour la première fois, **Then** le cadre résultat de la spec 005 apparaît, relié à l'outil ; rien n'est créé avant cette émission.

### User Story 4 - Échec ou indisponibilité de Claude (Priority: P2)

Si la génération d'un outil échoue, l'idée reste éclose. Le cadre concerné explique l'échec et propose de réessayer ;
les autres outils ne sont pas affectés.

**Acceptance Scenarios**:

1. **Given** deux outils cochés, **When** la génération du premier échoue, **Then** le second est généré normalement et l'idée est éclose.
2. **Given** un cadre en échec (réponse invalide, Claude injoignable, budget atteint), **Then** il affiche la raison et un bouton « Réessayer » qui relance la même demande ; il reste supprimable.
3. **Given** l'application fermée pendant une génération, **When** elle est rouverte, **Then** le cadre est toujours là, vide, avec « Réessayer ».
4. **Given** la synthèse faite sans Claude (mode dégradé), **Then** aucun outil n'est proposé et le verrouillage fonctionne comme aujourd'hui.

### Edge Cases

- Deux propositions au même titre dans un aperçu : la seconde est écartée.
- Budget mensuel insuffisant au moment de cocher : l'aperçu le signale ; les cadres sont tout de même créés à la confirmation et restent en « Réessayer » jusqu'à ce que le budget le permette.
- Idée supprimée ou archivée pendant la génération : la génération est abandonnée, le cadre suit le sort prévu par la spec 005 (entrée vide).
- Outil supprimé par l'utilisateur pendant sa génération : le résultat est ignoré ; la suppression reste annulable.
- Un outil proposé puis refusé (non coché) peut être reproposé à un verrouillage ultérieur : seuls les outils réellement branchés sont exclus.
- Un outil généré évolue ensuite par sa chatbox comme tout widget ; chaque nouvelle version redemande la revue (spec 005).

## Requirements *(mandatory)*

- **FR-001** Lors d'un verrouillage traité par Claude, la réponse de synthèse peut contenir de 0 à 3 **propositions d'outil** ; la consigne demande de n'en proposer que si un outil aide réellement à avancer sur l'idée, et aucune sinon.
- **FR-002** Une proposition porte : un titre court, une phrase décrivant ce que fait l'outil, la liste des parties de l'idée qu'il lit (parmi les parties transmissibles de la spec 005 FR-003) et s'il produit un résultat structuré.
- **FR-003** Les propositions sont **facultatives et tolérantes** : une proposition invalide est écartée seule ; leur absence ou leur rejet n'invalide jamais la synthèse. Au-delà de trois, l'excédent est ignoré.
- **FR-004** L'aperçu de synthèse affiche les propositions valides dans une section « Outils proposés », **décochées par défaut**, avec le nombre de générations qu'entraîne la sélection.
- **FR-005** À la confirmation, l'éclosion crée **dans la même opération atomique** (principe II) un cadre de widget vide par proposition cochée, titré d'après elle, et son branchement d'entrée vers l'idée avec les parties annoncées ; le tout est historisé et annulé avec l'éclosion.
- **FR-006** Après l'éclosion, **hors de cette opération**, une génération est lancée par cadre créé, en arrière-plan ; son échec ne remet jamais en cause l'éclosion.
- **FR-007** La demande de génération contient la proposition (titre, description, production d'un résultat) et la **structure** des entrées annoncées ; jamais leurs valeurs (spec 005 FR-012).
- **FR-008** **Revue inchangée** (spec 005 FR-002) : un outil généré ne reçoit aucune donnée avant autorisation de sa version ; cocher une proposition ne vaut pas autorisation. Les parties annoncées sont précochées dans la revue, modifiables.
- **FR-009** Un outil qui produit un résultat s'appuie sur le cadre résultat de la spec 005 (créé à la première émission) ; cette spec ne crée aucun cadre résultat d'avance.
- **FR-010** Un cadre dont la génération a échoué, a été interrompue ou n'a pas pu démarrer affiche la raison et « Réessayer », qui relance la même demande ; la proposition est conservée avec le cadre tant qu'il n'a aucune version.
- **FR-011** À un nouveau verrouillage, Claude reçoit le titre et la description des outils déjà branchés sur l'idée et ne les repropose pas ; l'application écarte en plus toute proposition dont le titre est celui d'un outil déjà branché.
- **FR-012** Les propositions non cochées, et celles d'un aperçu refait ou abandonné, ne sont pas conservées.
- **FR-013** Sans Claude (mode dégradé, budget atteint au verrouillage), aucune proposition n'est demandée ni affichée.
- **FR-014** Les cadres créés sont placés autour de l'idée sans recouvrir d'objet existant.

### Key Entities

- **Proposition d'outil** : titre, description, parties lues, production d'un résultat. Vit dans un aperçu de synthèse ; n'existe plus après lui, sauf attachée à un cadre en attente de génération.
- **Cadre de widget en attente** : widget de la spec 004 sans version, portant la proposition qui l'a fait naître et l'état de sa génération (en cours, en échec).
- **Branchement d'entrée** (spec 005) : créé ici par l'éclosion au lieu d'un lien tiré à la main ; même règle de revue.

## Success Criteria

- **SC-001** Après « Confirmer » avec deux outils cochés, les deux cadres reliés à l'idée sont visibles dès la fin de l'animation d'éclosion, sans attendre Claude.
- **SC-002** 100 % des cas testés : un outil proposé ne reçoit aucune donnée avant autorisation de sa version, y compris juste après sa génération.
- **SC-003** Annuler l'éclosion remet la carte exactement dans l'état d'avant : sous-neurones revenus, aucun cadre, aucun lien, aucun outil orphelin.
- **SC-004** Un verrouillage sans outil coché ne lance aucune génération et ne coûte pas plus de 5 % de plus qu'aujourd'hui (mesuré avec le suivi de consommation).
- **SC-005** Une génération en échec n'empêche jamais l'éclosion ni les autres générations (vérifié par test avec Claude simulé en erreur).
- **SC-006** Aucune valeur de l'idée dans les demandes de génération d'outil (vérifié par test sur la demande envoyée).
- **SC-007** De la confirmation à un outil autorisé et alimenté : deux clics (ouvrir la revue, autoriser), sans écrire de demande.

## Assumptions

- Les propositions ne concernent que les verrouillages traités par Claude ; l'IA locale n'en produit pas.
- Le plafond de trois propositions et l'absence de sélection par défaut servent la maîtrise du coût : chaque outil coché est une génération complète, avec le modèle réglé pour les widgets (spec 004).
- La proposition n'est pas modifiable dans l'aperçu : pour un outil différent, l'utilisateur le fait évoluer ensuite par sa chatbox.
- Les générations d'un même verrouillage peuvent se suivre plutôt que se chevaucher ; l'ordre est celui de l'aperçu.
- Dépendances : spec 005 lot 1 (branchement et revue, livré) et lot 2 (cadre résultat) ; cette spec ne redéfinit ni l'un ni l'autre.
- Pas d'amendement de constitution : une proposition cochée est une acceptation explicite (principe II) et la revue avant exécution reste entière (principe III).
