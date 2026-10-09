# Feature Specification: Actions finales — le livrable au bout de chaque branche

**Feature Branch**: `013-actions-finales` · **Created**: 2026-10-05 · **Status**: En pause (2026-10-09) — US3 à reprendre

**Input**: demande de mentalyas (2026-10-05) : « quand Claude estime qu'il n'est plus nécessaire de brainstormer plus loin
ou de casser en sous-plan d'attaque, les derniers nœuds sont des nœuds d'action directe où s'écrit soit du code de dev,
soit la création de document ou de fichier ; ce nœud final donne le livrable ultime lié à cette branche et au contexte
des sous-nœuds connectés ».

## Décisions (2026-10-05)
| # | Sujet | Décision |
|---|-------|----------|
| D1 | Déclencheur | **Claude propose, mentalyas valide** (comme le verrou) : Claude juge qu'une étape est atomique et propose d'en faire une **action finale** ; mentalyas accepte ou refuse. Acceptée, l'étape change d'apparence et gagne un bouton « Exécuter ». |
| D2 | Droits d'exécution | **Écrire dans le projet lié** : Claude peut créer et modifier des fichiers **uniquement dans le dossier de projet lié au genesis** (code, docs, config) ; **aucune commande système** (ni build, ni tests, ni installation) — mentalyas les lance lui-même. Sans dossier lié, une action ne produit que des documents (spec 012). |
| D2 bis (2026-10-06) | Commandes | Amende D2 : pendant une exécution, Claude peut **lancer des scripts approuvés** du projet (ex. `test`, `build`, `typecheck`, `lint` de `package.json`) pour tester et compiler ce qu'il écrit. mentalyas approuve la liste **une fois par projet** ; Claude passe par un outil de l'app : sans shell, avec un délai maximal, la sortie gardée au livrable. Un script dont Claude a modifié le texte est bloqué jusqu'à une nouvelle approbation. Toute autre commande reste impossible. |
| D3 | Validation | **Revue des changements** : après exécution, un nœud **livrable** annexé à l'action liste les fichiers créés ou modifiés avec leur différence (avant / après) ; mentalyas **accepte** (l'étape passe à « fait ») ou **demande une correction** (Claude reprend). Les fichiers sont déjà écrits sur le disque ; le gestionnaire de versions du projet sert de filet. |
| D4 (2026-10-06) | Lecture | **Visionneuse en lecture seule** : un clic sur un fichier du livrable ouvre un volet avec deux onglets, « Différences » et « Fichier » (contenu actuel, coloration syntaxique, numéros de ligne). Bouton **« Ouvrir dans l'éditeur »** : éditeur choisi dans Réglages (commande à variables `{fichier}`, `{ligne}`), lancé sans shell ; pas d'IDE intégré, pas d'édition dans l'app. |
| D5 (2026-10-06) | Tests du livrable | Dès qu'une action finale a un livrable, et à tout moment hors exécution, mentalyas peut **lancer les tests du livrable** depuis le nœud : les fichiers de test créés ou modifiés par l'action, passés au script `test` approuvé du projet. Sans fichier de test : « Demander les tests à Claude ». En cas d'échec : **« Faire corriger »** envoie la sortie à Claude par une correction (US3) ; rien ne part sans ce clic. |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Claude propose qu'une étape devienne une action finale (Priority: P1) 🎯 MVP

En conversation sur une étape (souvent la plus profonde d'une branche), Claude estime qu'elle n'a plus besoin d'être
brainstormée ni découpée : elle se réalise d'un seul tenant. Il propose d'en faire une action finale en résumant
**ce qu'il produira** (fichiers ou document attendus) et **pourquoi** l'étape est prête. mentalyas accepte ou refuse
depuis la carte ou le chat.

**Why this priority**: sans ce marquage, rien ne distingue « encore à réfléchir » de « prêt à produire » ; c'est la
porte d'entrée de l'exécution.

**Independent Test**: dans le chat d'une étape de profondeur 3, demander « est-ce qu'on peut passer à l'action ? » →
Claude propose l'action finale ; la carte montre la proposition sur l'étape ; accepter → l'étape prend l'apparence
« action finale » avec un bouton « Exécuter » ; refuser → elle redevient une étape ordinaire, sans trace de proposition.

**Acceptance Scenarios**:

1. **Given** la conversation d'une étape, **When** Claude propose l'action finale, **Then** l'étape affiche la
   proposition (livrable annoncé + raison) avec « Accepter » et « Refuser », et la conversation le signale.
2. **Given** une proposition affichée, **When** mentalyas accepte, **Then** l'étape devient une action finale
   (apparence distincte des étapes et des genesis, bouton « Exécuter »), l'opération est annulable dans l'Historique.
3. **Given** une étape qui a déjà des sous-étapes, ou une proposition de sous-étapes en attente, **When** Claude
   propose l'action finale, **Then** la proposition est refusée avec un message clair : une action finale est
   toujours une feuille de son plan.
4. **Given** une action finale, **When** Claude ou mentalyas propose ensuite des sous-étapes pour elle, **Then** c'est
   refusé tant qu'elle reste action finale ; mentalyas peut la rétrograder en étape ordinaire (annulable).
5. **Given** une proposition d'action finale, **When** mentalyas clique dessus avant de décider, **Then** il peut lire
   le livrable annoncé et la raison en entier.

---

### User Story 2 — Exécuter : Claude produit le livrable dans le projet lié (Priority: P1) 🎯 MVP

mentalyas clique « Exécuter » sur une action finale. Claude réalise le livrable en s'appuyant sur tout le contexte de la
branche : le genesis et les étapes parentes (fiches figées), les étapes dont l'action dépend, les documents annexés
sur ce chemin. Il crée et modifie les fichiers nécessaires dans le dossier de projet lié, et seulement là. Pendant
l'exécution, l'action montre qu'elle travaille et le journal de ce que Claude fait est visible.

**Why this priority**: c'est l'aboutissement de tout l'entonnoir : passer du plan à un résultat concret.

**Independent Test**: un genesis lié à un dossier de projet de test (sous gestion de versions), plan jusqu'à une
action « Créer la page de contact » ; « Exécuter » → les fichiers apparaissent dans le dossier du projet, aucun fichier
n'est touché hors de ce dossier, aucune commande n'a été lancée ; un nœud livrable s'annexe à l'action.

**Acceptance Scenarios**:

1. **Given** une action finale d'un genesis lié à un dossier de projet, **When** mentalyas clique « Exécuter »,
   **Then** Claude reçoit le contexte de la branche (chemin du genesis à l'action, dépendances, documents annexés,
   livrable annoncé) et produit le livrable en écrivant dans le dossier du projet.
2. **Given** une exécution en cours, **When** mentalyas regarde la carte, **Then** l'action indique « en cours »,
   le fil de l'exécution est consultable (fichiers lus, fichiers écrits, messages de Claude), et un bouton « Arrêter »
   interrompt l'exécution ; ce qui a déjà été écrit reste listé dans le livrable.
3. **Given** une exécution, **When** Claude tente d'écrire hors du dossier du projet, dans un fichier sensible (secrets,
   clés, données internes du gestionnaire de versions), ou de lancer une commande, **Then** c'est refusé, l'exécution
   continue sans cet effet, et le refus figure dans le fil de l'exécution.
4. **Given** une action finale d'un genesis **sans** dossier de projet lié, **When** mentalyas clique « Exécuter »,
   **Then** le livrable ne peut être que des documents (spec 012), annexés à l'action ; l'interface le dit avant de
   lancer.
5. **Given** une action finale dont une étape prérequise n'est pas « fait », **When** mentalyas clique « Exécuter »,
   **Then** l'app l'avertit (liste des prérequis non faits) et lui laisse choisir de lancer quand même ou non.
6. **Given** une exécution terminée, **When** elle s'achève, **Then** un nœud livrable apparaît en annexe de l'action
   (même logique de placement que les documents), l'action passe à « à revoir », et la conversation de l'action
   contient le compte rendu de Claude.

---

### User Story 2 bis — Claude teste et compile ce qu'il écrit (Priority: P1) 🎯

mentalyas approuve, pour le projet lié, les scripts que Claude peut lancer (tests, compilation, vérification de
types, lint). Pendant une exécution, Claude les lance après avoir écrit, lit le résultat et corrige jusqu'à ce que
ça passe ; les résultats apparaissent sur le livrable.

**Why this priority**: un livrable de code non compilé ni testé reporte tout le travail de vérification sur
mentalyas ; c'est ce qui rend l'action finale vraiment finale.

**Independent Test**: projet test avec `package.json` (`"test": "vitest run"`) ; approuver `test` ; exécuter une
action qui écrit du code et ses tests → Claude lance `test`, lit l'échec éventuel, corrige, relance ; le livrable
affiche « test ✓ » ; Claude ne peut lancer ni `dev` (non approuvé) ni `npm install` ni une autre commande.

**Acceptance Scenarios**:

1. **Given** un projet lié avec `package.json`, **When** mentalyas ouvre la liste des commandes, **Then** il voit
   les scripts du projet avec leur texte et coche ceux que Claude peut lancer ; rien n'est coché par défaut.
2. **Given** un script approuvé, **When** Claude le lance pendant une exécution, **Then** l'app l'exécute dans le
   dossier du projet, sans shell, rend à Claude le code de sortie et la fin de la sortie, et l'ajoute au livrable.
3. **Given** un script non approuvé, ou approuvé puis modifié depuis (texte différent), **When** Claude le demande,
   **Then** c'est refusé avec la raison ; mentalyas voit « à réapprouver » dans la liste.
4. **Given** un script qui dépasse 5 minutes, **When** le délai est atteint, **Then** il est arrêté (avec ses
   sous-processus) et Claude reçoit « délai dépassé ».
5. **Given** aucune exécution en cours, **When** Claude demande une commande, **Then** c'est refusé.

---

### User Story 3 — Revoir le livrable, accepter ou demander une correction (Priority: P1) 🎯 MVP

Le nœud livrable liste chaque fichier créé ou modifié par l'exécution, avec sa différence avant / après lisible dans le
nœud. mentalyas accepte : l'action passe à « fait ». Ou il demande une correction en une phrase : Claude reprend
l'exécution sur la base du livrable actuel et le livrable se met à jour.

**Why this priority**: D3 — rien n'est « fait » sans que mentalyas ait vu ce qui a changé ; c'est le garde-fou humain
d'une exécution qui écrit vraiment sur le disque.

**Independent Test**: après une exécution qui crée 2 fichiers et en modifie 1, le nœud livrable montre 3 entrées
(2 « créé », 1 « modifié ») et leurs différences ; « Demander une correction » avec « renomme la classe » → nouvelle
passe, le livrable reflète l'état final ; « Accepter » → l'action est « fait ».

**Acceptance Scenarios**:

1. **Given** un livrable, **When** mentalyas l'ouvre, **Then** chaque fichier apparaît avec son statut (créé ou modifié ;
   Claude ne supprime jamais de fichier, voir FR-006), son chemin relatif au projet et sa différence lisible.
2. **Given** un livrable, **When** mentalyas clique « Accepter », **Then** l'action passe à « fait » (annulable), et
   les actions qui en dépendent cessent de signaler ce prérequis.
3. **Given** un livrable, **When** mentalyas demande une correction avec un message, **Then** Claude reprend avec ce
   message et le contexte de l'exécution précédente ; le livrable cumule les changements et montre la différence
   depuis l'état d'avant la toute première exécution.
4. **Given** un fichier du livrable modifié depuis à la main (hors de l'app), **When** mentalyas ouvre le livrable,
   **Then** la différence affichée reflète le contenu actuel du fichier et le signale (« modifié depuis »).
5. **Given** un livrable, **When** mentalyas le refuse et demande de revenir en arrière, **Then** l'app propose de
   remettre les fichiers dans leur état d'avant l'exécution (fichiers créés mis de côté, fichiers modifiés restaurés),
   sauf ceux modifiés depuis à la main, signalés et laissés intacts.
6. **Given** un livrable, **When** mentalyas clique sur un de ses fichiers, **Then** un volet s'ouvre en lecture seule
   sur ce fichier : onglet « Différences » (avant / après) et onglet « Fichier » (contenu actuel sur le disque,
   coloré selon le langage, numéros de ligne) ; aucun contenu n'est interprété (texte seulement).
7. **Given** un fichier du livrable, **When** mentalyas clique « Ouvrir dans l'éditeur », **Then** le fichier s'ouvre
   dans l'éditeur réglé (ex. VS Code, Notepad++) ; sans éditeur réglé, l'app ouvre le fichier avec l'application
   associée **seulement** si son extension est dans une liste sûre (texte, code non exécutable par Windows), sinon elle
   invite à régler un éditeur.

---

### User Story 4 — Lancer les tests du livrable depuis l'action finale (Priority: P2)

Une action finale a produit du code. À tout moment après coup (hors exécution), mentalyas lance depuis le nœud les
tests qui portent sur ce livrable, voit le résultat sur la carte et, si ça échoue, envoie l'échec à Claude en un clic.

**Why this priority**: le code d'une branche continue de vivre après l'exécution (retouches, autres actions, mises à
jour) ; mentalyas doit pouvoir revérifier une branche sans quitter la carte ni ouvrir un terminal.

**Independent Test**: projet test (`"test": "vitest run"` approuvé) ; une action dont le livrable contient
`src/a.ts` et `src/a.test.ts` ; « Lancer les tests » → seul `src/a.test.ts` tourne, résultat ✓ sur le nœud ; casser
`src/a.ts` à la main, relancer → ✗ avec la sortie ; « Faire corriger » → une correction part avec la sortie, le
livrable se met à jour ; relancer → ✓.

**Acceptance Scenarios**:

1. **Given** une action finale avec un livrable contenant des fichiers de test, hors exécution, **When** mentalyas
   clique « Lancer les tests », **Then** l'app lance le script `test` approuvé du projet en lui passant seulement ces
   fichiers, et le nœud affiche « tests en cours » puis le résultat (✓ / ✗, durée, nombre de fichiers).
2. **Given** un résultat, **When** mentalyas le déplie, **Then** il lit la fin de la sortie (20 Ko au plus, sans codes
   de couleur) et l'historique des derniers lancements de cette action.
3. **Given** un résultat ✗, **When** mentalyas clique « Faire corriger », **Then** une correction (US3) part avec un
   message qui contient la fin de la sortie et la liste des fichiers testés.
4. **Given** un livrable sans fichier de test, **When** mentalyas ouvre le nœud, **Then** « Lancer les tests » est
   remplacé par « Demander les tests à Claude », qui lance une correction demandant d'écrire les tests unitaires des
   fichiers du livrable puis de les lancer.
5. **Given** un script `test` absent, non approuvé ou modifié depuis l'approbation, **When** mentalyas veut lancer les
   tests, **Then** le bouton est indisponible avec la raison et un lien vers la liste des scripts.
6. **Given** une exécution en cours sur ce genesis, ou un lancement déjà en cours, **When** mentalyas clique « Lancer
   les tests », **Then** c'est indisponible avec la raison.

---

### Edge Cases

- Dossier de projet lié devenu inaccessible au moment d'exécuter : l'exécution ne démarre pas ; le message dit
  pourquoi ; rien n'est écrit ailleurs.
- Lien symbolique ou jonction dans le projet pointant hors du projet : toute écriture à travers est refusée.
- Fichier volumineux (au-delà de 1 Mo) ou binaire : Claude ne peut pas l'écrire ; la différence d'un fichier trop gros
  est résumée (taille avant / après) au lieu d'être affichée.
- Exécution trop longue ou trop de fichiers : bornée (durée maximale, nombre maximal de fichiers écrits par passe) ;
  au-delà, l'exécution s'arrête et le livrable montre ce qui a été fait.
- Deux exécutions en même temps : une seule exécution à la fois par genesis ; les autres « Exécuter » de ce genesis
  sont indisponibles pendant ce temps, avec la raison.
- L'app fermée pendant une exécution : l'exécution est interrompue ; à la réouverture, l'action est « à revoir » avec
  le livrable de ce qui a été écrit.
- Action finale ou genesis retiré de la carte : son livrable quitte la carte avec lui ; les fichiers restent dans le
  projet.
- Verrou (spec 011) : l'action finale hérite du contexte figé de ses parents ; exécuter ne modifie aucune fiche de la
  branche.
- Nom ou chemin de fichier hostile proposé par Claude (`..`, chemin absolu, nom réservé Windows) : refusé.
- Fichier de test du livrable supprimé depuis, ou dont le chemin contient un caractère hors liste sûre (espace, `&`,
  `%`, `^`…) : il n'est pas passé au script ; le résultat le signale (« ignoré : … »).
- Fichier d'une extension exécutable par Windows (`.bat`, `.cmd`, `.ps1`, `.js`, `.vbs`…) sans éditeur réglé :
  « Ouvrir dans l'éditeur » ne l'ouvre jamais avec l'application associée.
- Fichier du livrable de plus de 1 Mo : la visionneuse affiche le résumé (taille), « Ouvrir dans l'éditeur » reste
  possible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Claude MUST pouvoir proposer, depuis la conversation d'une étape, d'en faire une action finale avec un
  livrable annoncé et une raison ; la proposition MUST être acceptée ou refusée par mentalyas avant tout effet.
- **FR-002**: Une action finale MUST être une feuille de son plan : la proposer pour une étape qui a des sous-étapes
  (ou une proposition de sous-étapes en attente) est refusé ; proposer des sous-étapes pour une action finale est refusé.
- **FR-003**: Une action finale MUST se distinguer visuellement des genesis et des étapes ordinaires et afficher son
  état : prête, en cours, à revoir, fait.
- **FR-004**: « Exécuter » MUST fournir à Claude le contexte complet de la branche : fiches du genesis et des étapes
  parentes, étapes dont l'action dépend, documents annexés sur ce chemin, livrable annoncé.
- **FR-005**: Pendant l'exécution, Claude MUST pouvoir lire le projet lié et y créer ou modifier des fichiers texte ;
  toute écriture MUST rester à l'intérieur du dossier du projet lié (chemin résolu réel, liens sortants refusés).
- **FR-006**: L'exécution MUST NOT lancer de commande système, ni supprimer ou renommer de fichier, ni écrire dans des
  fichiers sensibles (fichiers d'environnement et de secrets, clés et certificats, données internes du gestionnaire de
  versions, dossiers de dépendances installées).
- **FR-007**: Chaque exécution MUST être tracée : début, fin, fichiers lus et écrits, refus, compte rendu de Claude ;
  le contenu d'avant de chaque fichier modifié MUST être conservé pour la différence et le retour arrière.
- **FR-008**: À la fin d'une exécution, un nœud livrable MUST s'annexer à l'action et lister les fichiers créés et
  modifiés avec leur différence avant / après.
- **FR-009**: mentalyas MUST pouvoir accepter un livrable (action → « fait »), demander une correction (nouvelle passe
  avec son message, livrable cumulé) ou revenir en arrière (restauration des fichiers, sauf ceux modifiés depuis à la
  main, signalés).
- **FR-010**: Accepter une proposition, accepter un livrable, rétrograder une action et revenir en arrière MUST être
  des opérations de l'Historique annulables.
- **FR-011**: Sans dossier de projet lié, l'exécution MUST se limiter à la création de documents (spec 012) annexés à
  l'action.
- **FR-012**: mentalyas MUST pouvoir arrêter une exécution en cours ; une seule exécution à la fois par genesis.
- **FR-013**: L'exécution MUST être bornée (durée, nombre de fichiers écrits par passe, taille de fichier 1 Mo).
- **FR-015**: mentalyas MUST pouvoir approuver, par projet lié, une liste de scripts du `package.json` ; l'approbation
  retient le texte du script ; un texte changé depuis rend le script non lançable jusqu'à réapprobation.
- **FR-016**: Pendant une exécution seulement, Claude MUST pouvoir lancer un script approuvé ; l'app le lance sans
  interpréteur de commandes, dans le dossier du projet, une commande à la fois, 5 minutes au plus (arbre de processus
  arrêté au-delà), et lui rend code de sortie et fin de sortie (20 Ko au plus, sans codes de couleur).
- **FR-017**: Chaque lancement MUST être tracé (script, code, durée, sortie) et visible sur le livrable.
- **FR-018**: Aucune autre commande MUST être possible (ni installation, ni commande libre, ni script non approuvé).
- **FR-019**: Chaque fichier du livrable MUST pouvoir s'ouvrir dans une visionneuse en lecture seule (différences et
  contenu actuel, coloration syntaxique) ; le contenu est lu par le main sous le dossier lié (contrôles T001/T003).
- **FR-020**: « Ouvrir dans l'éditeur » MUST lancer l'éditeur réglé sans interpréteur de commandes, sur un chemin
  vérifié sous le projet ; sans éditeur réglé, l'ouverture par l'application associée MUST se limiter à une liste
  blanche d'extensions non exécutables.
- **FR-021**: Hors exécution, mentalyas MUST pouvoir lancer les tests du livrable d'une action finale : le script
  `test` approuvé (FR-015), avec pour seuls arguments les fichiers de test du livrable encore présents, chemins
  vérifiés sous le projet et limités à une liste sûre de caractères, 20 fichiers au plus.
- **FR-022**: Un lancement de tests MUST être tracé (fichiers, code, durée, sortie) et son dernier résultat visible sur
  l'action et son livrable ; un seul lancement à la fois par projet, jamais pendant une exécution du genesis.
- **FR-023**: Sur un résultat en échec, « Faire corriger » MUST lancer une correction (FR-009) dont le message
  contient la fin de la sortie ; sans fichier de test, « Demander les tests à Claude » MUST lancer une correction
  demandant les tests unitaires du livrable.
- **FR-014**: Le chat d'une étape MUST offrir un bouton « Proposer l'action finale » qui demande à Claude, sans
  ambiguïté, d'évaluer si l'étape est prête et, si oui, de la proposer (même principe que « Proposer un plan
  d'attaque »).

### Key Entities

- **Action finale** : étape d'un plan d'attaque marquée feuille exécutable ; livrable annoncé, raison, état (prête,
  en cours, à revoir, fait).
- **Proposition d'action finale** : en attente de décision ; étape visée, livrable annoncé, raison, auteur (Claude).
- **Exécution** : une passe de Claude sur une action ; début, fin, issue (terminée, arrêtée, interrompue, échouée),
  message de correction éventuel, fil des événements (lectures, écritures, refus, messages).
- **Livrable** : nœud annexé à l'action ; ensemble cumulé des fichiers touchés par ses exécutions, chacun avec chemin
  relatif, statut (créé / modifié), contenu d'avant la première exécution et contenu d'après.
- **Lancement de tests** : lancé par mentalyas sur une action finale ; fichiers de test passés, code de sortie, délai
  dépassé, durée, fin de sortie, date.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: De l'action finale acceptée au livrable visible sur la carte : un seul geste de mentalyas (« Exécuter »).
- **SC-002**: 0 écriture hors du dossier du projet lié et 0 commande système, vérifié avec des demandes hostiles
  (chemins `..`, absolus, liens symboliques sortants, fichiers de secrets, consignes cachées dans un document du
  projet demandant de lancer une commande).
- **SC-003**: 100 % des fichiers écrits par une exécution figurent dans son livrable avec une différence exacte.
- **SC-004**: Un retour arrière remet 100 % des fichiers non retouchés à la main dans leur état d'avant exécution.
- **SC-005**: mentalyas identifie d'un coup d'œil, sur une carte d'au moins 20 étapes, quelles étapes sont des actions
  finales et dans quel état elles sont (validé en test guidé).
- **SC-006**: Depuis une action finale dont le livrable contient des tests : un geste pour les lancer, un geste pour
  envoyer un échec en correction ; 0 fichier hors livrable passé au script, 0 lancement avec un chemin hors liste sûre.

## Assumptions

- Le dossier de projet lié au genesis (spec 008) est la seule zone d'écriture ; il est en principe sous gestion de
  versions, ce qui sert de filet supplémentaire, mais l'app ne l'exige pas et ne fait aucun commit elle-même.
- L'exécution réutilise la conversation de l'action (même session reprise), avec des droits d'écriture accordés pour
  la seule durée de l'exécution ; hors exécution, la conversation reste en lecture seule comme aujourd'hui.
- Fichiers texte uniquement en v1 ; pas d'images ni de binaires générés.
- Hors périmètre v1 : installation de dépendances par Claude (mentalyas lance `npm install` lui-même), gestionnaires
  autres que npm, commits automatiques, exécution en chaîne de plusieurs
  actions, exécution parallèle, suppression ou renommage de fichiers par Claude.
- Les modèles par défaut (spec 010) s'appliquent : l'exécution utilise le modèle des éléments de projet, réglable.
- Le profil démo reçoit une action finale fictive d'exemple, sans exécution réelle (repo public : aucune donnée réelle).
