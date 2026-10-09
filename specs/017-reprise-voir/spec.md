# Feature Specification: Reprise — Voir (spec 017)

**Feature Branch**: `main` · **Created**: 2026-10-06 · **Status**: Draft — à valider par mentalyas
**Input**: « Imaginons que je rejoigne une boîte et que je doive reprendre un projet en cours de route, dans lequel sont
déjà passés d'autres devs. Au lieu de perdre du temps à lire moi-même chaque ligne de code et les README, je veux
charger le projet dans l'app […] et, grâce à Claude, cartographier le projet : avoir directement l'arborescence et le
diagramme visuel, comme une map. » — mentalyas. Brainstorm complet : `docs/FOUNDATION.md` §000,
`docs/brainstorm/L1f-reprise-projet.md` (A1–A9), `L2-reprise-{import, analyse, explorateur, guide}.md`,
`L3-reprise-{import, analyse, explorateur}.md`, `L4d-reprise.md`. Lot **MVP 1 — Voir** (R1 à R4) ; le diagnostic et
le pont avec la carte de structure sont la spec 018 (MVP 2 — Juger).


**Amendement (2026-10-09, spec 022 « Nœuds vivants », US3)** : les éléments d'une carte de structure sont de petits
cercles vivants (couleur de leur module, pictogramme du type, numéro de progression, pastille de statut, contour en
pointillés si bloqué, badge Code / Doc, repli « ▸ N » inchangé). Un clic sur un élément ouvre sa **carte de détails**
(type, statut, résumé, avancement et reste à faire, couche corrigible et annulable, fichiers lus dans le lecteur,
« Discuter » pour sa conversation) ; le double-clic ouvre directement la conversation. La disposition alternée (D17), la
bascule Progression / Architecture (D20, avec glissement) et le focus des liens au survol (D15) sont conservés.
## Décisions (2026-10-06, brainstorm validé)

| # | Sujet | Décision |
|---|-------|----------|
| D1 | Analyse | **Statique** : le code est lu, jamais exécuté (ni installation, ni compilation, ni script du projet). La couche dynamique (observer l'application en marche) est hors périmètre (v3). |
| D2 | Langages | TypeScript / JavaScript, C# / .NET, PHP / Laravel. Un autre langage reste visible dans l'arborescence, sans analyse. |
| D3 | Confidentialité | Choisie **par projet à l'import**, sans valeur présélectionnée : « Claude autorisé » ou « Local uniquement » (rien du projet n'est envoyé à Claude ; le modèle local fait le travail d'IA, ou il n'est pas fait). Affichée en permanence. |
| D4 | Import git | Un dépôt distant est cloné avec le git de mentalyas (ses identifiants restent gérés par git ; l'app n'en voit ni n'en stocke aucun) dans un dossier qu'il choisit ; adresse `https://` ou `git@` seulement. |
| D5 | Vues | Un **explorateur** à 4 niveaux (modules → dossiers → fichiers → code), ouvert depuis le genesis du projet repris. Le lien explorateur ↔ carte de structure (envoyer un élément, revenir) est la spec 018. |
| D6 | Pédagogie | Chaque explication (élément de l'explorateur, guide) commence par une **analogie simple**, puis le détail technique ; tout terme technique est expliqué à sa première occurrence. |
| D7 (validée 2026-10-06) | Projet repris | Le projet importé devient un **genesis « projet repris »** de la carte qui pointe vers **son dossier source, défini par mentalyas** : le dossier local choisi, ou le dossier où le dépôt git a été cloné. Il n'est **jamais** inscrit au registre ProjectMaster (spec 016 D4), ni modifié par l'app. |
| D9 (2026-10-07, test T023) | Suppression | Supprimer une idée (genesis repris ou non) **retire aussi le lien de l'app vers son dossier** ; « Annuler » le remet. Un projet repris dont le genesis est supprimé ne bloque plus un nouvel import du même dossier (ses données d'analyse sont alors effacées). |
| D10 (2026-10-07, test T023) | Zoom sémantique | Les seuils sont **relatifs au cadrage d'arrivée** de chaque niveau (dézoomer d'environ 40 % remonte, zoomer au double ouvre l'élément au centre), et seuls les gestes de mentalyas comptent, pas les recadrages automatiques ; un bouton « ↑ Niveau au-dessus » double le geste. |
| D11 (2026-10-07, retour T023) | Carte combinée | La vue principale d'un projet repris est la **carte de structure dessinée par Claude** (spec 009, « Cartographier ce projet ») : elle regroupe par sens, l'explorateur par dossiers. L'analyse statique la **nourrit** : (A) chaque élément montre **ses fichiers**, consultables en lecture seule avec leurs symboles et leurs appelants ; (B) l'app superpose les **appels mesurés** entre éléments (nombre, sûr / incertain), recalculés à chaque analyse ; (C) un outil du pont donne à Claude le **graphe mesuré** quand il cartographie (projet « Claude autorisé » seulement). |
| D12 (2026-10-07) | Explorateur | Gardé **en second plan** : ouvert depuis le menu du projet ; vue principale seulement en « Local uniquement », où Claude ne cartographie pas. |
| D13 (2026-10-07) | Lancement | La cartographie par Claude reste **à l'initiative de mentalyas** (bouton « Cartographier ce projet ») : elle consomme son abonnement. |
| D14 (2026-10-07, retour T043, révisée) | Disposition de la carte | L'**arbre en colonnes** reste (hiérarchie arborescente, traits parent → enfant), **aéré** : plus d'écart entre colonnes et entre nœuds, et un écart supplémentaire entre les sous-arbres de deux modules de niveau 1. Les cadres imbriqués, essayés, sont écartés par mentalyas. |
| D15 (2026-10-07, retour T043) | Liens de la carte | **Selon le focus** : au repos, seuls les liens entre éléments de niveau 1 (liens de Claude et appels mesurés), agrégés ; un élément sélectionné ou survolé montre ses propres liens en détail, rattachés à l'élément visible de l'autre bout. |
| D17 (2026-10-07) | Carte de structure : disposition et ordre | Remplace l'arbre en colonnes de D14. **Disposition alternée** : les modules (niveau 1) descendent **verticalement** sous le genesis ; les enfants d'un élément de niveau impair partent **horizontalement** à sa droite ; ceux d'un niveau pair **verticalement** dessous ; et ainsi de suite, sans chevauchement (chaque sous-arbre occupe sa boîte). **Ordre de progression** entre frères : celui de Claude (champ `ordre` de `structure_dessiner` : l'ordre dans lequel un dev construirait ou lirait le projet, fondations d'abord) ; à défaut, celui des dépendances (ce dont les autres dépendent d'abord : liens `depend_de` / `appelle` et appels mesurés) ; puis l'ordre du dessin. La hiérarchie se lit comme un **chemin** : un trait du parent vers son premier enfant, puis de chaque frère au suivant. Chaque nœud porte son **numéro de progression** (1, 1.2, 1.2.1…). Les liens selon le focus (D15) restent. |
| D18 (2026-10-07) | Carte de structure : nœuds selon leur contenu | L'aspect d'un élément dit **ce qu'il contient réellement**, calculé par l'app à partir des fichiers couverts par ses chemins (jamais par Claude) : **doc** si tous ses fichiers sont de la documentation (`.md`, `.mdx`, `.markdown`, `.txt`, `.rst`, `.adoc`), **code** dès qu'il en contient un seul autre (la configuration — `.json`, `.yaml`, `.toml`… — compte comme du code), avec la mention « + N doc » s'il contient aussi de la documentation. **Forme + badge** : un nœud doc a l'aspect d'une **page** (fond clair, coin replié, badge « 📄 Doc ») ; un nœud code celui d'un **éditeur** (fond sombre, badge « </> Code » en police à chasse fixe) ; le type de Claude (Module, Composant…) reste affiché. Un élément sans chemin ou dont les chemins ne couvrent aucun fichier garde l'aspect actuel. Les fichiers sensibles ne sont jamais comptés. **Lisibilité** (retour de mentalyas) : nœud de 304 × 144 px, en-tête sur une seule ligne, titre et résumé sur deux lignes entières chacun (texte complet au survol), chemins et repli dans un pied. |
| D19 (2026-10-07) | Carte de structure : état visuel du statut | Le statut d'un élément se voit d'un coup d'œil, jamais par la couleur seule : **pastille** colorée avec icône et libellé, **bande** de 4 px sur le bord gauche de la couleur du statut. **En cours** : bleu, ◐ ; **livrée / faite** : vert, ✓ ; **bloquée** : rouge, ⛔, et contour en pointillés rouges autour du nœud ; **idée, spécifiée, à faire** : neutre (gris), ○ / ◇. La bordure garde la couleur du type (D17), le fond l'aspect du contenu (D18). |
| D20 (2026-10-07) | Carte de structure : vue « Architecture » | Une **bascule « Progression | Architecture »** sur chaque carte de structure : Progression reste la vue actuelle (D17–D19) ; **Architecture** range les mêmes nœuds (mêmes aspects, statuts, numéros) en **bandes**, une par couche, de l'extérieur (haut) vers le cœur (bas), plus une bande « Non classés ». Architectures reconnues et profondeur de leurs couches : **Clean** (Présentation, Infrastructure 1 → Application 2 → Domaine 3), **hexagonale** (Adaptateurs entrants, Adaptateurs sortants 1 → Application 2 → Domaine 3), **MVVM** (Vue 1 → ViewModel 2 → Modèle 3), **MVC** (Vue, Contrôleur 1 → Modèle 2), **en couches** (Présentation 1 → Métier 2 → Données 3) ; « aucune » : pas de vue Architecture. **Règle de dépendance unique** : un lien (de Claude ou mesuré) d'une couche plus profonde vers une moins profonde est une **violation**, tracée en rouge avec son nombre d'appels. **Qui décide** : Claude à la cartographie (champs `architecture` avec justification et `couche` par élément de `structure_dessiner`) ; à défaut l'app déduit la couche (catégories de l'analyse, noms de dossiers) et la marque « déduite » ; mentalyas corrige l'architecture et les couches, sa correction prime et s'annule dans l'Historique. Une **puce de couche** s'affiche dans le pied de chaque nœud, dans les deux vues. *Amendé le 2026-10-09 (spec 023 D3) : la bascule gagne une position à gauche, **« Workflow | Progression | Architecture »** ; Workflow range le projet selon la méthode (brainstorm › specs › user stories › tâches, lue dans ses fichiers) ; Progression et Architecture sont inchangées, et la barre existe aussi sur un projet lié sans carte dessinée.* |
| D21 (2026-10-07) | Carte de structure : avancement vivant | Quand Claude travaille dans la conversation d'un élément, il **tient cet élément à jour** avec l'outil `element_avancer` (statut, avancement 0–100 %, ce qui reste à faire) à chaque étape franchie ; travail terminé (tests verts, commit) : **livrée, 100 %**, directement, marqué « par Claude » et annulable (règle des écritures MCP). **Avancement mixte** : un élément qui a des sous-éléments affiche la moyenne de ceux-ci (livrée ou faite = 100 %, sinon leur avancement, à défaut 0) ; une feuille affiche le % déclaré par Claude (livrée = 100 %). Le nœud montre une **barre de progression** et son % ; « reste à faire » au survol. **Amendé le 2026-10-08 (test guidé T079)** : un élément qui a des sous-éléments affiche **toujours** leur moyenne, même s'il est lui-même marqué livré (un sous-élément rouvert fait baisser le parent) ; seul un élément sans sous-élément livré ou fait vaut 100 % d'office. |
| D22 (2026-10-07) | Carte de structure : fichiers écrits pendant le travail | Un fichier que Claude écrit dans la conversation d'un élément (dans le dossier lié, hors fichier sensible) **rejoint les chemins de l'élément**, sauf si un de ses chemins le couvre déjà : l'aspect doc/code (D18) et le volet « Fichiers » suivent le travail en cours, sans attendre une recartographie. Seul le chemin est retenu, jamais le contenu. **Ajout seulement**, non historisé (choix assumé : rien n'est retiré ni écrasé ; la recartographie par Claude reste maîtresse des chemins). |
| D16 (2026-10-07, retour T027) | Organisation de l'explorateur | **Un seul écran, carte + volet** : au niveau 1, un nœud propre à chaque **module** ; zoomer dans un module (ou un dossier) montre ses **dossiers** — chaque nœud dossier a deux onglets, « Fichiers » (ses fichiers de code directs) et « Sous-dossiers » (un clic zoome dedans) ; les fichiers posés à la racine d'un module ou d'un dossier ont un nœud « Racine ». Un clic sur un fichier affiche **tout son code** dans le volet de droite, chaque bloc (classe, fonction, méthode) marqué « ← appelé par » / « → appelle » avec la fiabilité ; un clic sur un appel ouvre l'autre fichier au bon bloc, dans le même volet, et la carte sélectionne son dossier. Le niveau « fonctions » quitte la carte (les fonctions sont les blocs du code). Les lignes d'appel sont repérées de façon approchée (nom appelé dans le bloc) : la base garde le nombre d'appels, pas leur ligne. Remplace la descente en 4 niveaux de FR-020. |
| D8 (validée 2026-10-06) | Constitution | Amendement **4.1.0** proposé avec cette spec (MINOR) : principe I — git devient un programme que l'app peut lancer (chemin absolu, arguments fixes ; déjà utilisé par la spec 016) ; principe IV — en « Local uniquement », le modèle local remplace Claude pour les tâches d'IA de ce projet ; contraintes techniques — bibliothèque d'analyse syntaxique. |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Reprendre un projet depuis un dossier, en choisissant sa confidentialité (Priority: P1) 🎯 MVP

mentalyas clique « Reprendre un projet existant », choisit le dossier du projet, voit un aperçu (langages, nombre de
fichiers retenus, fichiers ignorés, dépôt git ou non), choisit « Claude autorisé » ou « Local uniquement » et importe :
un genesis « projet repris » apparaît sur la carte, lié au dossier, et l'analyse démarre.

**Why this priority**: sans import, rien d'autre n'existe ; la confidentialité doit être posée avant toute analyse.

**Independent Test**: importer un petit projet Laravel de démonstration en « Local uniquement » → le genesis apparaît
avec le badge « Local uniquement » ; aucune tâche n'est envoyée à Claude pendant tout le parcours.

**Acceptance Scenarios**:

1. **Given** un dossier choisi au sélecteur natif, **When** l'aperçu s'affiche, **Then** il indique les langages
   reconnus, le nombre de fichiers retenus et ignorés (dont les fichiers sensibles), et si c'est un dépôt git.
2. **Given** l'aperçu, **When** mentalyas n'a choisi aucun niveau de confidentialité, **Then** « Importer » reste
   indisponible.
3. **Given** un import validé, **When** il se termine, **Then** un genesis « projet repris » lié au dossier existe et
   le niveau de confidentialité est affiché sur son chat, sur l'explorateur et sur le guide.
4. **Given** le dossier de données de l'app (ou un de ses parents ou enfants), **When** mentalyas le choisit,
   **Then** il est refusé avec la raison.
5. **Given** un dossier déjà lié à un genesis, **When** mentalyas le choisit, **Then** l'app propose d'ouvrir ce
   genesis plutôt que d'en créer un second.
6. **Given** un projet « Local uniquement », **When** mentalyas le passe en « Claude autorisé », **Then** l'app
   demande une confirmation ; **When** il repasse en « Local uniquement », **Then** c'est immédiat et l'app rappelle
   que ce qui a déjà été envoyé ne peut pas être rappelé.

---

### User Story 2 — Voir le projet dans l'explorateur, du module au code (Priority: P1) 🎯 MVP

mentalyas ouvre l'explorateur du projet repris : il voit les grands modules et les flèches qui les relient (épaisseur
= nombre d'appels), zoome dans un module (dossiers, namespaces), puis dans un dossier (fichiers, classes), puis dans un
fichier (fonctions, méthodes et un extrait de code en lecture seule). Un fil d'Ariane le ramène à n'importe quel
niveau. Un clic sur un élément ouvre son panneau : ce que c'est (analogie, rôle), qui l'appelle, qui il appelle.

**Why this priority**: c'est la « map » demandée : comprendre l'architecture sans lire chaque ligne.

**Independent Test**: sur le projet de démonstration TypeScript, descendre de « Modules » jusqu'au code d'une fonction
et remonter par le fil d'Ariane ; masquer / afficher la plomberie ; isoler un fichier et ses voisins.

**Acceptance Scenarios**:

1. **Given** un projet analysé, **When** l'explorateur s'ouvre, **Then** il montre le niveau Modules, les liens entre
   modules avec leur volume d'appels, et le badge de confidentialité.
2. **Given** un niveau affiché, **When** mentalyas zoome ou double-clique sur un élément, **Then** le niveau suivant de
   cet élément s'affiche ; les liens vers des éléments non affichés sont regroupés sur leur parent visible.
3. **Given** un élément, **When** mentalyas le sélectionne, **Then** le panneau montre son analogie et son rôle (si
   disponibles), sa catégorie, ses fichiers, ses appelants et ses appelés, chacun avec la fiabilité du lien (sûr,
   déduit, incertain).
4. **Given** la plomberie (logs, conversions, utilitaires) masquée par défaut, **When** mentalyas regarde la carte,
   **Then** un compteur dit ce qui est masqué, et un filtre la réaffiche.
5. **Given** plus d'éléments qu'un écran lisible ne peut en montrer, **When** le niveau s'affiche, **Then** les
   éléments en trop sont regroupés (« + 42 fichiers ») et l'explorateur invite à zoomer ou filtrer.
6. **Given** mentalyas au clavier ou avec un lecteur d'écran, **When** il passe en vue liste, **Then** il dispose des
   mêmes informations (niveaux, appelants, appelés) sans la carte.
7. **Given** un fichier de code, **When** mentalyas ouvre son extrait, **Then** le code s'affiche en lecture seule,
   jamais exécuté ni interprété, et un fichier sensible n'est jamais montré.
8. **(D16)** **Given** un module ouvert, **When** mentalyas clique l'onglet « Fichiers » d'un dossier puis un fichier,
   **Then** le volet de droite montre tout le code du fichier, chaque bloc avec « ← appelé par » / « → appelle » ;
   **When** il clique un appel, **Then** l'autre fichier s'ouvre au bon bloc dans le même volet et la carte
   sélectionne son dossier — sans autre fenêtre.

---

### User Story 3 — Une analyse qui ne lance rien et dit ce qu'elle sait (Priority: P1) 🎯 MVP

À l'import (et à la demande, « Réanalyser »), l'app lit le code TypeScript / JavaScript, C# et PHP / Laravel et en tire
modules, fichiers, classes, fonctions, imports et appels, chacun rangé dans une catégorie (métier, orchestration,
infrastructure, plomberie) et chaque lien marqué selon sa fiabilité. La progression est visible ; l'app reste
utilisable pendant l'analyse.

**Why this priority**: c'est la matière première de l'explorateur et du guide ; une erreur de fiabilité tromperait
mentalyas.

**Independent Test**: analyser les trois projets de démonstration → les liens attendus apparaissent (en Laravel :
route → contrôleur → modèle ; en C# : interface injectée → implémentation ; en TypeScript : imports relatifs et
alias) ; un fichier volontairement cassé est marqué « non analysé » sans arrêter l'analyse.

**Acceptance Scenarios**:

1. **Given** un projet importé, **When** l'analyse tourne, **Then** sa progression (fichiers lus / total) est
   affichée, l'arborescence est déjà navigable, et l'analyse peut être annulée sans perdre le résultat précédent.
2. **Given** un fichier illisible ou invalide, **When** l'analyse le rencontre, **Then** il est marqué « non
   analysé » avec la raison, et l'analyse continue.
3. **Given** un appel dont la cible est certaine d'après le code, **Then** le lien est « sûr » ; s'il a été déduit,
   il est « déduit » avec sa raison ; s'il reste ambigu, il est « incertain » — jamais présenté comme sûr.
4. **Given** une réanalyse après des modifications, **When** elle tourne, **Then** seuls les fichiers modifiés sont
   relus, et les corrections de mentalyas (catégorie, cible d'un appel) sont conservées.
5. **Given** un commentaire ou une chaîne du projet qui contient une consigne (« ignore tes instructions… »),
   **When** le code est analysé, **Then** rien ne change dans le comportement de l'app ni de l'IA.
6. **Given** mentalyas en désaccord avec une catégorie ou la cible d'un appel, **When** il la corrige, **Then** sa
   correction prime et survit aux réanalyses.

---

### User Story 4 — Lire le guide de reprise, écrit pour un dev junior (Priority: P2)

À la fin de la première analyse, un guide de reprise s'ouvre : en une phrase, à quoi sert le projet, comment le lancer
(commandes montrées, jamais lancées), son architecture (modules et analogies, mini-carte), ses points d'entrée, ses
conventions, ses zones à risque (remplie par la spec 018), par où commencer (3 à 5 fichiers dans l'ordre) et un
glossaire. Chaque nom cité ouvre l'explorateur dessus.

**Why this priority**: c'est le raccourci vers « comprendre vite » ; il s'appuie sur l'analyse (US3) et l'explorateur
(US2).

**Independent Test**: sur le projet de démonstration C#, le guide contient les 9 sections, chacune ouverte par une
analogie ; un clic sur un fichier cité centre l'explorateur dessus ; un chemin inventé est signalé.

**Acceptance Scenarios**:

1. **Given** la première analyse terminée, **When** le guide est produit, **Then** il contient les 9 sections, et une
   information introuvable est dite « non trouvée dans le projet », jamais inventée.
2. **Given** une affirmation qui cite un fichier, un module ou une fonction, **Then** la source existe dans le projet ;
   sinon elle est signalée ou retirée.
3. **Given** un projet « Local uniquement », **When** le guide est produit, **Then** il l'est par le modèle local,
   avec la mention « rédigé par le modèle local, qualité moindre ».
4. **Given** un guide existant, **When** mentalyas le régénère, **Then** la version précédente reste consultable.
5. **Given** le guide, **Then** il vit dans l'app (document du genesis), jamais écrit dans le dossier du projet repris.

---

### User Story 5 — Reprendre un projet depuis un dépôt git (Priority: P2)

mentalyas colle l'adresse d'un dépôt, choisit le dossier où le cloner, suit la progression (avec Annuler), puis
retrouve l'aperçu et le choix de confidentialité de l'US1.

**Why this priority**: le cas réel « je rejoins une boîte » ; il réutilise tout le reste.

**Independent Test**: cloner un dépôt public par `https://` → progression, puis aperçu ; annuler en cours → le dossier
partiel disparaît ; une adresse piégée (`ext::…`, `file://…`, option commençant par `-`) est refusée sans rien lancer.

**Acceptance Scenarios**:

1. **Given** une adresse `https://` ou `git@`, **When** mentalyas lance le clone, **Then** la progression s'affiche et
   l'aperçu suit à la fin.
2. **Given** toute autre forme d'adresse, **When** il la colle, **Then** elle est refusée avant tout lancement.
3. **Given** un dépôt privé et git qui n'arrive pas à s'authentifier, **Then** l'app explique de se connecter avec son
   gestionnaire git habituel ; elle ne demande jamais de mot de passe ni de jeton.
4. **Given** un clone annulé ou en échec, **Then** le dossier partiellement créé par l'app est supprimé, et seulement
   lui.
5. **Given** une adresse qui contient un identifiant (`https://user:jeton@…`), **Then** cet identifiant n'est jamais
   affiché, journalisé ni enregistré.

---

### User Story 6 — Lever les ambiguïtés avec l'IA (Priority: P3)

Après l'analyse, les appels ambigus (plusieurs cibles possibles) sont soumis par lots à Claude (projet « Claude
autorisé ») ou au modèle local (« Local uniquement ») : il choisit une cible parmi celles proposées ou répond
« indéterminé », avec une raison courte. Il peut aussi proposer une autre catégorie pour un élément, justifiée.

**Why this priority**: améliore la précision du graphe, surtout en C# ; l'explorateur reste utile sans elle.

**Independent Test**: sur le projet C# de démonstration, un appel à `Save()` présent dans trois classes devient
« déduit » vers la bonne classe ; une réponse de l'IA qui cite une cible non proposée est rejetée.

**Acceptance Scenarios**:

1. **Given** des appels ambigus, **When** l'IA répond, **Then** seules les cibles parmi les candidats proposés sont
   acceptées ; le reste demeure « incertain ».
2. **Given** l'abonnement Claude épuisé ou le modèle local indisponible, **Then** l'explorateur reste utilisable, les
   liens restent « incertains », et l'app le dit.
3. **Given** un projet « Local uniquement », **Then** aucun lot n'est envoyé à Claude.

---

### User Story 7 — La carte de Claude, nourrie par l'analyse (Priority: P1, ajoutée le 2026-10-07) 🎯

mentalyas cartographie le projet repris avec Claude (« Cartographier ce projet ») : la carte de structure regroupe le
projet par sens. Sur chaque élément, il consulte ses fichiers (code en lecture seule, symboles, qui les appelle) ; entre
les éléments, la carte montre les appels réellement mesurés par l'analyse ; et Claude a dessiné ses liens en
s'appuyant sur ce graphe mesuré plutôt que sur des déductions.

**Why this priority**: retour du test T023 — la carte de Claude est plus lisible ; il lui manquait l'accès aux fichiers et
des liens fondés sur les faits.

**Independent Test**: projet `cs-app` en « Claude autorisé », analysé puis cartographié : sur l'élément de la couche
domaine, la liste de ses fichiers s'ouvre et montre le code de `OrderService.cs` ; un lien « N appels » relie
l'élément des contrôleurs à celui du domaine ; Claude a lu le graphe (pastille « graphe du code lu » dans le fil).

**Acceptance Scenarios**:

1. **Given** un élément dont les chemins désignent des fichiers ou des dossiers, **When** mentalyas ouvre ses fichiers,
   **Then** la liste montre les fichiers du projet couverts (un dossier → ses fichiers), et un clic affiche le code en
   lecture seule, ses symboles et leurs appelants ; un fichier sensible n'est jamais montré.
2. **Given** un projet repris analysé et une carte de structure, **When** la carte s'affiche, **Then** entre deux
   éléments dont les fichiers s'appellent, un lien montre le nombre d'appels et leur fiabilité (sûr / incertain),
   rattaché à l'ancêtre visible si l'élément est replié.
3. **Given** un projet « Claude autorisé », **When** Claude cartographie, **Then** il peut lire le graphe mesuré (modules,
   points d'entrée, appels sûrs entre fichiers) ; **Given** un projet « Local uniquement », **Then** cet outil est refusé.
4. **Given** un projet repris, **When** mentalyas veut le détail par dossiers, **Then** l'explorateur s'ouvre depuis le
   chat du genesis, en second plan.
5. **Given** une carte de structure dépliée sur plusieurs niveaux, **When** elle s'affiche, **Then** l'arbre en colonnes
   laisse de l'air entre les nœuds, et davantage entre les modules de niveau 1 (D14).
6. **Given** une carte avec des dizaines de liens, **When** rien n'est sélectionné, **Then** seuls les liens entre
   éléments de niveau 1 s'affichent, agrégés ; **When** mentalyas sélectionne ou survole un élément, **Then** ses liens
   apparaissent en détail (D15).

---

### Edge Cases

- Projet très grand (au-delà de 20 000 fichiers retenus) : l'aperçu le dit et propose de choisir un sous-dossier.
- Projet sans aucun langage reconnu : import possible, explorateur réduit à l'arborescence, message clair.
- Liens symboliques ou jonctions qui sortent du dossier : jamais suivis.
- Fichiers sensibles (`.env*`, clés, certificats, fichiers d'identifiants, réglages applicatifs avec secrets) : ni
  lus, ni affichés, ni envoyés, quel que soit le niveau de confidentialité.
- Fichier trop gros (au-delà de 1 Mo) : ignoré, signalé « trop gros ».
- Dossier du projet déplacé ou supprimé après l'import : l'explorateur garde la dernière analyse et dit que le dossier
  est introuvable.
- App fermée pendant un clone ou une analyse : à la réouverture, le clone partiel est nettoyé, l'analyse est marquée
  interrompue et peut être relancée.
- git absent : l'import par dossier reste possible ; le clone explique comment installer git.
- Projet sans modules clairs : le premier niveau montre les dossiers racine.

## Requirements *(mandatory)*

### Functional Requirements

**Import et confidentialité**
- **FR-001**: Le chemin d'un projet MUST venir uniquement du sélecteur natif (ou du clone dans un dossier choisi au
  sélecteur), jamais d'un texte de l'interface.
- **FR-002**: L'import MUST montrer un aperçu (langages, fichiers retenus / ignorés, fichiers sensibles ignorés, git)
  avant toute création.
- **FR-003**: L'import MUST exiger un choix explicite de confidentialité, sans valeur présélectionnée ; le niveau
  MUST être affiché en permanence sur le chat, l'explorateur et le guide du projet.
- **FR-004**: En « Local uniquement », aucune donnée du projet (code, noms, chemins, guide, conversation) MUST être
  envoyée à Claude ; la conversation Claude du genesis (et de ses éléments ou étapes) est indisponible, avec la raison ;
  le pont MCP ne MUST rien en exposer non plus (guide et documents, nœuds, fiche, graphe), y compris à une session
  Claude Code externe branchée sur le pont.
- **FR-005**: Passer de « Local uniquement » à « Claude autorisé » MUST être confirmé ; le changement inverse est
  immédiat et l'app le dit irréversible pour ce qui a déjà été envoyé.
- **FR-006**: Le dossier de données de l'app, ses parents et ses enfants MUST être refusés à l'import.
- **FR-007**: Un dossier ne MUST pas être lié à deux genesis « projet repris ».

**Clone**
- **FR-008**: Seules les adresses `https://…` et `git@hôte:…` MUST être acceptées ; toute autre forme est refusée sans
  lancer git.
- **FR-009**: Le clone MUST utiliser le git de mentalyas, sans shell, sans invite dans une console cachée, sans
  sous-module ni hook ; un seul clone à la fois ; délai borné ; annulable.
- **FR-010**: Un clone annulé ou en échec MUST supprimer le dossier qu'il a créé, et seulement celui-là (jamais un
  dossier qui existait avant).
- **FR-011**: Un identifiant contenu dans une adresse MUST être retiré avant tout affichage, journal ou stockage.

**Analyse**
- **FR-012**: Rien du projet importé MUST être exécuté (ni installation, ni compilation, ni script, ni hook).
- **FR-013**: Les fichiers ignorés d'office : dossiers de dépendances et de compilation, contenu de `.git`, fichiers
  listés par le `.gitignore` du projet, binaires, fichiers de plus de 1 Mo ; les fichiers sensibles ne sont jamais
  lus.
- **FR-014**: L'analyse MUST produire, pour TypeScript / JavaScript, C# et PHP / Laravel : modules, dossiers, fichiers,
  classes / interfaces, fonctions / méthodes, imports, appels, points d'entrée (routes, contrôleurs, programme
  principal, commandes, tâches planifiées).
- **FR-015**: Chaque lien MUST porter sa fiabilité (`sûr`, `déduit` avec raison, `incertain`, `corrigé par
  mentalyas`) ; chaque élément sa catégorie (métier, orchestration, infrastructure, plomberie) et l'origine de cette
  catégorie.
- **FR-016**: Un fichier en erreur MUST être marqué « non analysé » avec sa raison, sans arrêter l'analyse.
- **FR-017**: L'analyse MUST tourner sans geler l'app, afficher sa progression, pouvoir être annulée sans perdre le
  résultat précédent, et ne relire que les fichiers modifiés lors d'une réanalyse.
- **FR-018**: Les corrections de mentalyas (catégorie, cible d'un appel) MUST primer sur les règles et l'IA et
  survivre aux réanalyses.
- **FR-019**: Le contenu du projet envoyé à une IA MUST être un extrait court délimité comme donnée ; la réponse MUST
  être validée (une cible hors des candidats proposés est rejetée).

**Explorateur**
- **FR-020** (révisée D16) : La carte de l'explorateur MUST montrer les modules (nœud propre), puis les dossiers d'un
  module ou d'un dossier (nœuds à onglets « Fichiers » / « Sous-dossiers », nœud « Racine » pour les fichiers directs),
  avec un fil d'Ariane, le zoom et le double-clic pour descendre ; plus de niveau « fonctions » sur la carte.
- **FR-037** (D16) : Un fichier choisi MUST s'afficher en entier dans le volet de droite (lecture seule, 1 Mo au plus,
  jamais un fichier sensible), chaque bloc avec ses appelants et ses appelés (fiabilité comprise) ; un appel ouvre
  l'autre fichier au bon bloc dans le même volet ; carte et volet restent sur un seul écran.
- **FR-021**: Les liens vers des éléments non affichés MUST être regroupés sur leur parent visible, avec le nombre
  d'appels ; la fiabilité affichée est la plus faible des liens regroupés.
- **FR-022**: Au plus un nombre lisible d'éléments (~150) MUST être affiché à la fois ; le reste est regroupé.
- **FR-023**: La plomberie MUST être masquée par défaut avec un compteur de ce qui est masqué ; filtres par catégorie,
  langage et fiabilité ; recherche par nom ; « isoler » un élément et ses voisins (1 ou 2 pas).
- **FR-024**: Une vue liste MUST offrir les mêmes informations au clavier et au lecteur d'écran ; aucune information
  ne MUST reposer sur la seule couleur.
- **FR-025**: L'interface MUST ne recevoir que des chemins relatifs au projet ; l'extrait de code est du texte, jamais
  interprété ; un fichier sensible n'est jamais montré.
- **FR-026**: Les positions déplacées par mentalyas, le niveau et les filtres MUST être retenus par projet.

**Guide de reprise**
- **FR-027**: Le guide MUST contenir 9 sections fixes (En une phrase · À quoi ça sert · Comment le lancer · Architecture
  · Points d'entrée · Conventions observées · Zones à risque · Par où commencer · Glossaire), chacune ouverte par une
  analogie.
- **FR-028**: Les commandes de lancement MUST être montrées, jamais exécutées.
- **FR-029**: Chaque source citée (fichier, module, fonction) MUST exister dans le projet ; sinon elle est signalée ou
  retirée ; une information introuvable est dite telle.
- **FR-030**: Le guide MUST être un document du genesis (historisé), jamais écrit dans le dossier du projet repris.

**Carte combinée (US7, D11–D13)**
- **FR-032**: Un élément de carte de structure MUST donner accès à ses fichiers (chemins de l'élément ; un dossier couvre
  ses fichiers, 200 au plus), lus sous la racine du projet, en lecture seule, jamais un fichier sensible ; avec, pour un
  projet repris analysé, les symboles du fichier et leurs appelants.
- **FR-033**: La carte de structure d'un projet repris analysé MUST montrer les appels mesurés entre ses éléments
  (nombre, fiabilité la plus faible), rattachés à l'ancêtre visible, distincts des liens dessinés par Claude.
- **FR-034**: Le pont MCP MUST offrir à Claude une lecture du graphe mesuré d'un projet repris (`code_graphe_lire`),
  refusée en « Local uniquement » par la garde de confidentialité.
- **FR-035** (révisée D17) : La carte de structure MUST alterner les directions — niveau 1 vertical sous le genesis,
  enfants d'un niveau impair à l'horizontale, d'un niveau pair à la verticale —, aérée et sans chevauchement.
- **FR-038** (D17) : Les frères MUST suivre l'ordre de progression (ordre de Claude, sinon dépendances, sinon dessin),
  la hiérarchie se lire comme un chemin (parent → premier enfant → frère suivant), et chaque nœud afficher son numéro.
- **FR-039** (D18) : Chaque élément d'une carte de structure dont les chemins couvrent des fichiers MUST afficher son contenu : aspect « page » + badge « Doc » s'il ne contient que de la documentation, aspect « éditeur » + badge « Code » s'il contient au moins un autre fichier (configuration comprise), avec le nombre de fichiers de documentation en plus ; le classement est calculé par l'app à partir des fichiers du dossier lié, jamais par Claude, et ne compte aucun fichier sensible.
- **FR-040** (D19) : Le statut d'un élément MUST se distinguer par une pastille (couleur, icône, libellé) et une bande latérale colorée ; un élément bloqué MUST avoir en plus un contour en pointillés.
- **FR-041** (D20) : Une carte de structure MUST offrir une vue « Architecture » qui range ses éléments en bandes par couche selon l'architecture de la carte, sans modifier la vue « Progression » ; chaque élément MUST porter une puce de sa couche (avec « déduite » quand elle vient de l'app) ; un lien d'une couche plus profonde vers une moins profonde MUST être signalé comme violation ; l'architecture et les couches MUST pouvoir être corrigées par mentalyas (correction prioritaire, annulable).
- **FR-042** (D21) : Claude MUST pouvoir mettre à jour, depuis la conversation d'un élément, le statut, l'avancement et le reste à faire de cet élément (écriture « par Claude », annulable) ; chaque élément MUST afficher une barre d'avancement : moyenne de ses sous-éléments s'il en a, sinon l'avancement déclaré.
- **FR-036**: Les liens d'une carte de structure (de Claude et mesurés) MUST être agrégés au niveau 1 au repos et
  détaillés pour l'élément sélectionné ou survolé (D15).

**Traçabilité**
- **FR-031**: Imports, clones, analyses et générations de guide MUST être journalisés (date, durée, issue, nombres) —
  jamais de code, de chemin complet, d'adresse avec identifiant ni de nom d'auteur.

### Key Entities

- **Projet repris** : le genesis lié au dossier importé ; source (dossier / git), adresse distante sans identifiant,
  niveau de confidentialité et date de changement, état de la dernière analyse.
- **Module** : grande partie du projet (paquet, projet .NET, dossier racine) ; clé stable, nom, racine.
- **Fichier analysé** : chemin relatif, langage, empreinte, taille, statut (analysé, non analysé + raison, ignoré).
- **Symbole** : classe, interface, fonction ou méthode ; parent, lignes, catégorie et son origine.
- **Lien** : import, appel, implémentation, route, injection ; de → vers (ou cible inconnue), fiabilité, raison,
  nombre d'occurrences.
- **Point d'entrée** : route HTTP, programme principal, commande, événement, tâche planifiée.
- **Analyse** : une passe (début, fin, état, statistiques).
- **Vue de l'explorateur** : positions, niveau courant, filtres, par projet.
- **Guide de reprise** : document du genesis, versions successives, origine (Claude / modèle local).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Sur un projet inconnu de taille moyenne (≈ 500 fichiers), mentalyas sait dire à quoi sert le projet,
  quels sont ses 3 à 5 modules principaux et par quel fichier commencer **en moins de 10 minutes** après l'import.
- **SC-002**: **0** donnée d'un projet « Local uniquement » envoyée à Claude, vérifié par un test automatique sur tout
  le parcours (import, analyse, ambiguïtés, guide, conversation).
- **SC-003**: **0** programme du projet importé exécuté, vérifié avec un projet piégé (scripts d'installation, hooks,
  sous-modules, commentaires porteurs de consignes).
- **SC-004**: Un projet de 5 000 fichiers est analysé en **moins de 2 minutes** sur le poste de mentalyas, l'app
  restant utilisable pendant ce temps ; une réanalyse après la modification d'un fichier prend **moins de 10 s**.
- **SC-005**: L'explorateur passe d'un niveau à l'autre en **moins d'une seconde** et reste fluide sur ce projet de
  5 000 fichiers.
- **SC-006**: Sur les trois projets de démonstration, **100 %** des liens « sûrs » vérifiés à la main sont exacts ;
  aucune déduction n'est présentée comme sûre.
- **SC-007**: **100 %** des sources citées par le guide existent dans le projet.

## Assumptions

- mentalyas a git installé et configuré pour ses dépôts privés (gestionnaire d'identifiants) ; sans git, seul l'import
  par dossier est possible.
- Les trois projets de démonstration (TypeScript, C#, Laravel) sont **fictifs** et créés pour les tests (dépôt
  public : aucune donnée réelle).
- La résolution des appels sans compilateur ni typage complet est approximative : c'est assumé et rendu visible par la
  fiabilité des liens (D1, FR-015).
- Le modèle local (Ollama) peut être absent : en « Local uniquement », le guide et la levée d'ambiguïtés sont alors
  indisponibles avec explication ; l'import, l'analyse et l'explorateur fonctionnent sans IA.
- Une bibliothèque d'analyse syntaxique multi-langage est ajoutée (dépendance à annoncer au plan, licence à vérifier) ;
  le détail technique est dans `docs/brainstorm/L3-reprise-*.md`.
- Hors périmètre (spec 018 et suivantes) : diagnostic en couleurs, envoi vers la carte de structure, parcours d'une
  fonctionnalité, questions au projet, suivi des changements, couche dynamique, direction artistique « rétro-néo-
  futuriste ».
