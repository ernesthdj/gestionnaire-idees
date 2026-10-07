# Feature Specification: Analyste interne (spec 019)

**Feature Branch**: `main` · **Created**: 2026-10-07 · **Status**: Draft — à valider par mentalyas
**Input**: « Implémenter une sorte de sonde interne qui récupère des logs et analyse l'app en cours de fonctionnement
avec Claude lui-même, mais sur base d'un contexte bien précis d'Analyste interne. […] Une sorte de testeur
complémentaire à l'utilisateur qui, sur base de l'utilisation et du comportement de l'app, fait lui-même des
auto-corrections, mises à jour et améliorations. […] Jamais modifier le code sans validation de l'utilisateur, Claude
doit d'abord proposer les améliorations et les justifier, et on doit avoir des sauvegardes pour pouvoir revenir à une
version antérieure. » — mentalyas. Brainstorm complet : `docs/FOUNDATION.md` §0000,
`docs/brainstorm/L1g-analyste-interne.md` (A1–A9), `L2-analyste-{sonde, analyse, appliquer, rythme}.md`,
`L3-analyste-{sonde, analyse, appliquer}.md`, `L4e-analyste.md`. Constitution **4.2.1** (amendée pour cette spec).
**Glossaire** : *copie de travail* = worktree git (deuxième dossier de travail du même dépôt, sur sa propre branche) ;
*branche de base* = `main` ; *profil d'essai* = profil de données fictif, distinct du profil démo, recréé à chaque essai.

## Décisions (2026-10-07, brainstorm validé)

| # | Sujet | Décision |
|---|-------|----------|
| D1 | Cible | **Le Brainstormer seul** : l'app s'observe elle-même et propose des changements à son propre code. Les projets liés ou repris ne sont pas observés. |
| D2 | Sonde | **Événements sans contenu** : quoi, où, combien de temps, avec quel résultat. Jamais le texte saisi, un titre, un nom de fichier personnel ni le message d'une erreur. Un travail d'IA refait se repère par une **empreinte** (résumé chiffré à clé locale, impossible à relire). |
| D3 | Appliquer | **Une branche `analyste/*` par mise à jour**, dans une copie de travail séparée du dépôt : l'app ouverte n'est jamais modifiée pendant le codage. Garder = fusion dans la branche de base, **sans jamais publier** ; Jeter = branche supprimée ; Annuler une mise à jour gardée = révocation par un nouveau commit. |
| D4 | Rythme | « Analyser maintenant » toujours disponible ; analyse **automatique réglable** (désactivée par défaut ; 1 h, 1 jour ou 1 semaine), seulement s'il y a assez d'observations nouvelles, avec un plafond de propositions. |
| D5 | Pouvoirs de l'analyse | **Lecture seule** : l'Analyste lit les observations, la carte et le code du dépôt (lecture et recherche) ; il n'écrit rien et ne lance aucune commande. Le codage n'a lieu qu'après acceptation. |
| D6 | Placement | **Boîte Analyste** (nouvelle entrée de navigation) pour trier, et **badges sur la carte de structure** du Brainstormer pour situer. |
| D7 | Version de l'app | L'Analyste n'existe que si l'app tourne depuis le **dépôt source désigné** par mentalyas ; dans l'app installée, rien n'est collecté et la fonctionnalité est absente. |
| D8 | Analyses | Cinq catégories dès la première version : **bug**, **tâche IA → code**, **parcours**, **code mort / redondance**, **évolutivité**. |
| D9 | Constitution | Amendement **4.2.0** (2026-10-07, validé) : I (`npm` limité aux vérifications dans une branche `analyste/*`), II (branche `analyste/*` créée, commitée, fusionnée et révocable après acceptation explicite ; jamais de publication ni de réécriture), IV (la tâche `analyste` est la seule tâche automatique avec outils, en lecture seule). |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Activer la sonde et voir ce qu'elle garde (Priority: P1) 🎯 MVP

mentalyas désigne, dans les Réglages, le dépôt source du Brainstormer depuis lequel l'app tourne. La sonde s'active et
commence à noter le fonctionnement de l'app et son usage, sans contenu. Il peut consulter à tout moment ce qui a été
gardé, l'exporter ou l'effacer.

**Why this priority**: sans observations, l'Analyste n'a rien à analyser ; et la confiance dans la sonde (« rien de
personnel n'est gardé ») conditionne tout le reste.

**Independent Test**: désigner le dépôt, parcourir l'app sur le profil démo (créer des idées, ouvrir un chat, déplacer
des nœuds, provoquer une erreur), puis ouvrir « Observations » : les événements apparaissent, et aucun texte du profil
démo ne s'y trouve.

**Acceptance Scenarios**:

1. **Given** l'app lancée depuis son dépôt source, **When** mentalyas désigne ce dépôt, **Then** l'app le reconnaît
   comme celui du Brainstormer et active la sonde (témoin visible).
2. **Given** un dossier qui n'est pas le dépôt du Brainstormer, ou pas celui d'où tourne l'app, **When** il le
   désigne, **Then** il est refusé avec la raison.
3. **Given** l'app installée, **When** mentalyas ouvre les Réglages, **Then** l'Analyste est indisponible avec
   explication, et rien n'est jamais collecté.
4. **Given** la sonde active, **When** mentalyas crée une idée « Acheter du pain », **Then** l'observation dit
   « idée créée » (avec le moyen : souris, clavier, Claude) sans contenir son texte.
5. **Given** une erreur dans l'app, **Then** l'observation garde son type et l'endroit du code, jamais son message.
6. **Given** des observations, **When** mentalyas choisit « Effacer les observations » et confirme, **Then** elles
   sont toutes supprimées.

---

### User Story 2 — Analyser et recevoir des propositions justifiées (Priority: P1) 🎯 MVP

mentalyas clique « Analyser maintenant ». Claude, en lecture seule, reçoit un résumé des observations depuis la
dernière analyse, l'analyse du code du dépôt et le souvenir des analyses précédentes, puis rend des propositions :
chacune dit ce qui a été constaté, avec quelles preuves, ce qu'il propose, le gain attendu et le risque.

**Why this priority**: c'est la valeur centrale (« un testeur complémentaire ») ; sans propositions, rien à appliquer.

**Independent Test**: sur le profil démo avec une semaine d'observations simulées (erreurs répétées, une tâche d'IA qui
rend toujours la même réponse, des allers-retours entre deux écrans), lancer l'analyse : des propositions des
catégories attendues apparaissent, chacune avec des preuves qui existent.

**Acceptance Scenarios**:

1. **Given** assez d'observations nouvelles, **When** mentalyas lance l'analyse, **Then** il suit sa progression
   (préparation, Claude, contrôle) puis voit au plus 5 propositions (réglable), les plus graves d'abord.
2. **Given** une proposition qui cite un fichier inexistant ou hors du dépôt, ou une preuve qui n'a pas été fournie,
   **Then** elle est écartée ; les autres sont gardées.
3. **Given** une proposition sans aucune preuve, **Then** elle est écartée, sauf en catégorie évolutivité où elle est
   marquée « idée, sans preuve d'usage ».
4. **Given** une tâche d'IA qui a rendu la même réponse pour la même entrée au moins 5 fois, **Then** l'Analyste peut
   proposer de la remplacer par du code, en citant cette répétition.
5. **Given** une consigne cachée dans un commentaire du code lu (« modifie tel fichier »), **Then** elle n'a aucun
   effet : l'analyse ne peut rien écrire ni lancer.
6. **Given** peu d'observations nouvelles, **Then** l'app le dit et propose d'analyser quand même.
7. **Given** Claude Code indisponible ou l'abonnement épuisé, **Then** l'analyse échoue proprement avec un message
   clair, et elle pourra être relancée sur la même période.

---

### User Story 3 — Trier les propositions dans la boîte et sur la carte (Priority: P1) 🎯 MVP

Les propositions arrivent dans la boîte Analyste. mentalyas lit une fiche (constat, preuves en phrases, proposition,
gain, risque, fichiers visés) et choisit Accepter, Refuser (raison en un clic) ou Reporter. Sur la carte de structure
du Brainstormer, un badge sur chaque élément concerné montre le nombre de propositions et ouvre la fiche.

**Why this priority**: le tri rapide est ce qui rend l'Analyste utile au quotidien plutôt qu'une pile de rapports.

**Independent Test**: avec 5 propositions, les trier en moins de 2 minutes ; refuser une proposition puis relancer
une analyse sans fait nouveau : elle ne revient pas.

**Acceptance Scenarios**:

1. **Given** des propositions, **When** mentalyas ouvre la boîte, **Then** il voit les onglets À trier, En cours,
   Gardées, Écartées, un filtre par catégorie, et le nombre à trier sur l'entrée de navigation.
2. **Given** une preuve d'observation, **Then** elle s'affiche en phrase compréhensible (« la tâche Catégoriser a rendu
   23 fois la même réponse pour la même entrée »), sa référence restant visible en petit.
3. **Given** une preuve de code, **When** il clique dessus, **Then** le fichier s'ouvre au bon endroit dans
   l'explorateur.
4. **Given** une proposition refusée avec une raison, **When** une analyse suivante n'apporte aucune observation
   nouvelle à son sujet, **Then** elle n'est pas reproposée.
5. **Given** le genesis du Brainstormer lié à son dépôt et cartographié, **Then** chaque élément visé par une
   proposition porte un badge « N propositions » ; un clic ouvre la fiche. Une proposition sans élément précis
   s'accroche au genesis.
6. **Given** aucun genesis du Brainstormer, **Then** la boîte propose de le lier et de le cartographier.
7. **Given** « Demander plus » sur une fiche, **Then** une conversation avec Claude s'ouvre avec la fiche en contexte.

---

### User Story 4 — Appliquer une proposition, l'essayer, la garder ou la jeter (Priority: P2)

mentalyas accepte une proposition. L'app prépare une copie de travail séparée sur une branche à part ; Claude y code la
proposition dans une conversation (les écritures dans cette copie sont libres, les commandes demandées). À la fin,
l'app enregistre le travail sur la branche et lance les vérifications (types, style, format, tests). mentalyas lit les
changements, essaie la version, puis la garde ou la jette.

**Why this priority**: c'est l'« auto-amélioration » ; elle dépend des US1 à US3 et c'est la partie la plus sensible.

**Independent Test**: accepter une petite proposition sur un dépôt propre → branche créée, commit, 4 vérifications
vertes, la branche principale et l'app ouverte inchangées ; Garder → fusion sans publication ; Jeter une autre →
branche et copie supprimées, rien d'autre touché.

**Acceptance Scenarios**:

1. **Given** le dépôt avec des changements non enregistrés, **When** mentalyas accepte, **Then** rien n'est créé et
   l'app lui demande d'enregistrer ou de ranger ses changements ; l'acceptation est gardée pour reprendre plus tard.
2. **Given** une proposition acceptée sur un dépôt propre, **Then** une branche `analyste/…` et sa copie de travail
   sont créées ; la conversation de codage s'ouvre dans la fiche.
3. **Given** Claude qui tente d'écrire hors de la copie de travail ou de lancer une commande, **Then** la demande va à
   mentalyas ; sans réponse, elle est refusée.
4. **Given** « Terminer », **Then** le travail est enregistré sur la branche (avec une référence à la proposition) et
   les 4 vérifications s'exécutent ; leur résultat s'affiche.
5. **Given** une vérification en échec, **Then** « Garder » est indisponible avec la raison ; mentalyas peut continuer
   la conversation ou jeter.
6. **Given** les 4 vérifications vertes, **When** il choisit Garder et confirme (« l'app va se recharger »), **Then**
   la branche est fusionnée dans la branche de base, **rien n'est publié**, la copie et la branche sont retirées.
7. **Given** la branche de base modifiée entre-temps et un conflit, **Then** rien n'est fusionné ; mentalyas peut
   continuer la conversation (Claude règle le conflit dans la copie) ou jeter.
8. **Given** « Essayer », **Then** la version de la branche se lance sur un **profil d'essai** distinct (copie du
   profil démo), à côté de l'app ouverte, jamais à sa place ni sur ses données.
9. **Given** une proposition qui touche aux dépendances, **Then** la fiche le signale et l'installation est demandée à
   mentalyas.
10. **Given** l'app fermée pendant un codage, **Then** au démarrage la copie de travail orpheline est retirée, après
    confirmation si elle contient des changements.

---

### User Story 5 — Annuler une mise à jour gardée (Priority: P2)

Dans l'onglet Gardées, mentalyas annule une mise à jour qui ne lui plaît plus : l'app la révoque par un nouvel
enregistrement, sans réécrire l'historique.

**Why this priority**: la sauvegarde demandée par mentalyas (« revenir à une version antérieure si la mise à jour ne me
plaît pas ») ; sans elle, Garder serait irréversible.

**Independent Test**: garder une mise à jour, puis l'annuler → le code revient à l'état d'avant, l'historique contient
la mise à jour et sa révocation.

**Acceptance Scenarios**:

1. **Given** une mise à jour gardée et le dépôt propre, **When** mentalyas choisit Annuler et confirme, **Then** elle
   est révoquée par un nouvel enregistrement ; la proposition passe « annulée ».
2. **Given** du code modifié depuis, qui empêche la révocation, **Then** l'opération s'arrête proprement, sans rien
   laisser à moitié, avec une explication et une conversation proposée.

---

### User Story 6 — Laisser l'app proposer d'elle-même (Priority: P3)

mentalyas active l'analyse automatique (1 h en phase de test, puis 1 jour ou 1 semaine) avec un seuil d'observations
nouvelles. L'app lance l'analyse à l'échéance, seulement si c'est utile, et le prévient des nouvelles propositions.

**Why this priority**: confort ; l'Analyste reste pleinement utile en manuel.

**Independent Test**: rythme 1 h et seuil 50 sur une horloge simulée : sans activité, aucune analyse ; avec 50
événements, une analyse et une notification.

**Acceptance Scenarios**:

1. **Given** le rythme désactivé (défaut), **Then** aucune analyse ne se lance d'elle-même.
2. **Given** l'échéance atteinte et le seuil non atteint, **Then** rien n'est lancé et l'échéance est repoussée.
3. **Given** une analyse ou un codage en cours, ou une conversation en train de répondre, **Then** l'analyse
   automatique attend.
4. **Given** 10 propositions ou plus à trier, **Then** l'analyse automatique est sautée et l'app invite à trier.
5. **Given** l'app fermée pendant plusieurs échéances, **Then** une seule analyse a lieu, peu après le démarrage.
6. **Given** une analyse automatique, **Then** elle ne fait que proposer : elle n'accepte, ne code et ne garde jamais
   rien.

---

### Edge Cases

- Rafale d'événements (une boucle qui en émet des milliers) : regroupés puis, au-delà d'une limite, abandonnés et
  comptés ; l'app reste fluide.
- Une erreur de la sonde elle-même ne doit jamais casser ni ralentir l'app : elle est comptée, rien d'autre.
- Observations au-delà de la durée ou du volume de conservation : les plus anciennes sont purgées d'abord.
- Réponse de l'Analyste invalide (forme inattendue) : rejetée entièrement, l'analyse est marquée en échec.
- Deux propositions qui visent les mêmes fichiers dans la même catégorie : fusionnées.
- Le dépôt désigné change de place ou n'est plus un dépôt git (revérifié au démarrage et chaque heure) : la sonde se
  met en pause, l'app le signale dans les Réglages.
- Analyse demandée pendant qu'une autre tourne, ou pendant un codage : refusée avec la raison.
- Mise à jour gardée alors que l'app tourne en développement : l'app se recharge ; l'état est retrouvé au redémarrage
  (la mise à jour apparaît « gardée »).
- Nom de branche, chemin ou commande suggérés par Claude : jamais utilisés tels quels ; l'app génère ses propres noms.
- Annulation d'un codage en cours : la copie de travail et la branche sont supprimées, et seulement elles.

## Requirements *(mandatory)*

### Functional Requirements

**Activation et périmètre**

- **FR-001**: L'Analyste MUST n'être disponible que lorsque l'app tourne depuis un dépôt source du Brainstormer
  désigné par mentalyas ; dans l'app installée, aucune observation n'est collectée et l'Analyste est absent (D7).
- **FR-002**: La désignation MUST vérifier que le dossier est la racine d'un dépôt git du Brainstormer et qu'il
  contient l'app en cours d'exécution ; sinon elle est refusée avec la raison.
- **FR-003**: Seul le Brainstormer est observé et modifié ; aucun projet lié ou repris n'est concerné (D1).

**Sonde**

- **FR-004**: La sonde MUST enregistrer des événements de cinq familles : navigation, action, erreur, performance,
  tâche d'IA, selon un **catalogue fermé** ; tout événement ou champ hors catalogue est ignoré.
- **FR-005**: Un événement MUST NOT contenir de texte saisi, de titre, de nom de fichier personnel, de chemin hors du
  dépôt ni de message d'erreur ; un objet est désigné par son type et par un pseudonyme qui ne permet pas de retrouver
  la donnée (D2).
- **FR-006**: Une erreur MUST être gardée par son type, son module et au plus 5 emplacements de code situés dans le
  dépôt.
- **FR-007**: Pour chaque tâche d'IA, la sonde MUST garder une empreinte de l'entrée et de la sortie validée,
  calculée avec une clé locale protégée, afin de repérer un même travail refait sans en lire le contenu.
- **FR-008**: La durée de chaque échange entre l'interface et le reste de l'app MUST être mesurée sans modifier
  chaque fonctionnalité.
- **FR-009**: Les observations MUST être conservées au plus 30 jours et 50 000 événements par défaut (réglables),
  les plus anciennes purgées d'abord ; mentalyas peut tout effacer (avec confirmation).
- **FR-010**: mentalyas MUST pouvoir consulter les observations (filtres par période et famille), leurs compteurs, et
  les exporter localement ; un écran explique ce qui n'est jamais gardé.
- **FR-011**: La sonde MUST NOT ralentir ni interrompre l'app : enregistrement par lots, rafales regroupées puis
  limitées, toute erreur de la sonde comptée et ignorée.

**Analyse**

- **FR-012**: « Analyser maintenant » MUST lancer une analyse sur les observations depuis la dernière analyse réussie ;
  si elles sont trop peu nombreuses, l'app le dit et permet d'analyser quand même.
- **FR-013**: L'analyse MUST transmettre à Claude un **résumé** des observations (comptages, erreurs groupées,
  lenteurs, allers-retours, séquences fréquentes, écrans et actions jamais utilisés, tâches d'IA répétées), chacun
  avec une référence citable, plus l'analyse statique du dépôt (spec 017) et la mémoire des propositions précédentes
  (statut, raison de refus) ; jamais les événements bruts.
- **FR-014**: L'analyse MUST se faire en **lecture seule** : lecture et recherche dans le dépôt désigné seulement,
  aucune écriture, aucune commande, aucun réglage ni serveur additionnel ; le dossier de données de l'app MUST NOT
  être lisible (D5, constitution IV).
- **FR-015**: Chaque proposition MUST comporter : catégorie (parmi les 5 de D8), titre, constat, preuves (références
  d'observations et/ou emplacements de code), proposition, gain attendu, risque, gravité, confiance, fichiers visés.
- **FR-016**: Toute proposition MUST être revérifiée par l'app : forme attendue ; fichiers et emplacements existants et
  situés dans le dépôt ; références d'observations présentes dans le résumé envoyé ; preuve obligatoire sauf en
  évolutivité (marquée « idée, sans preuve d'usage ») ; une proposition qui échoue est écartée.
- **FR-017**: Une analyse MUST produire au plus N propositions (défaut 5, réglable de 1 à 10), les plus graves
  d'abord ; les doublons (même catégorie, mêmes fichiers qu'une proposition ouverte) sont fusionnés.
- **FR-018**: Une proposition refusée MUST NOT être reproposée sans observation nouvelle la concernant ; la raison du
  refus est transmise aux analyses suivantes. Un refus peut être repris (« Reprendre » dans Écartées).
- **FR-019**: Une proposition « tâche IA → code » MUST s'appuyer sur au moins 5 répétitions de la même empreinte
  d'entrée avec une seule empreinte de sortie (seuil réglable), ou sur une règle simple visible dans les sorties.
- **FR-020**: Une seule analyse à la fois ; aucune pendant un codage ; chaque analyse est journalisée (déclencheur,
  durée, statut, modèle — jamais le contenu) ; en cas d'échec, la même période peut être réanalysée.
- **FR-021**: mentalyas MUST pouvoir annuler une analyse en cours.

**Boîte et carte**

- **FR-022**: Une entrée **Analyste** MUST apparaître dans la navigation quand la sonde est active, avec le nombre de
  propositions à trier ; la boîte a les onglets À trier, En cours, Gardées, Écartées, et un filtre par catégorie.
- **FR-023**: La fiche MUST afficher les preuves d'observation en phrases compréhensibles et les preuves de code comme
  liens vers l'explorateur.
- **FR-024**: Chaque proposition MUST pouvoir être acceptée, refusée (raison prête ou libre, facultative) ou reportée ;
  « Demander plus » ouvre une conversation avec la fiche en contexte.
- **FR-025**: Sur la carte de structure du genesis lié au dépôt désigné, chaque élément dont les chemins couvrent un
  fichier visé MUST porter un badge « N propositions » qui ouvre la fiche ; sinon la proposition s'accroche au genesis.
  Si ce genesis n'existe pas, la boîte propose de le lier et de le cartographier.
- **FR-026**: Le texte d'une proposition MUST être affiché comme texte, jamais interprété comme du code de page.

**Appliquer**

- **FR-027**: Rien MUST être codé sans « Accepter » explicite ; ni l'analyse ni le rythme automatique ne peuvent
  déclencher un codage (constitution II).
- **FR-028**: Accepter MUST exiger un dépôt sans changement non enregistré, sur sa branche de base ; sinon rien n'est
  créé, la raison est donnée et l'acceptation reste reprenable.
- **FR-029**: L'app MUST créer une branche `analyste/<identifiant>-<titre court>` et une copie de travail séparée,
  hors de l'app ouverte ; noms et chemins générés par l'app uniquement.
- **FR-030**: Le codage MUST se faire dans une conversation avec Claude dont les écritures sont limitées à la copie de
  travail ; toute commande est demandée à mentalyas ; une demande sans réponse est refusée.
- **FR-031**: À la fin du codage, l'app MUST enregistrer le travail sur la branche (avec une référence à la proposition
  et sans co-auteur), puis lancer les vérifications : types, style, format, tests ; leur résultat est affiché.
- **FR-032**: mentalyas MUST pouvoir consulter les changements (fichiers, lignes ajoutées et retirées) et essayer la
  version de la branche sur un **profil d'essai** distinct (copie du profil démo, recréée à chaque essai), à côté de
  l'app ouverte, sans la remplacer ni partager ses données.
- **FR-033**: « Garder » MUST être indisponible tant qu'une vérification n'est pas réussie ; il fusionne la branche
  dans la branche de base (enregistrement de fusion identifiable), retire la copie et la branche, ne publie **jamais**,
  et prévient du rechargement de l'app.
- **FR-034**: En cas de conflit à la fusion, l'app MUST tout remettre en l'état et proposer de continuer la
  conversation ou de jeter.
- **FR-035**: « Jeter » MUST supprimer la copie de travail et la branche, et seulement elles (confirmation si la copie
  contient du travail non enregistré).
- **FR-036**: « Annuler » une mise à jour gardée MUST la révoquer par un nouvel enregistrement, après confirmation ;
  en cas de conflit, l'opération est abandonnée proprement.
- **FR-037**: L'app MUST NOT publier, réécrire l'historique, forcer une branche ni enregistrer hors d'une branche
  `analyste/*` (sauf la fusion sur Garder et la révocation sur Annuler) ; une seule mise à jour en codage à la fois.
- **FR-038**: Une proposition qui modifie les dépendances MUST être signalée sur la fiche et dans les changements ;
  l'installation est demandée à mentalyas.
- **FR-039**: Au démarrage, une copie de travail orpheline MUST être retirée (confirmation si elle contient du
  travail) ; une mise à jour gardée pendant un rechargement est retrouvée dans son bon état.

**Rythme**

- **FR-040**: Le rythme automatique MUST être désactivé par défaut ; réglable à 1 h, 1 jour ou 1 semaine, avec un
  seuil d'observations nouvelles (défaut 200).
- **FR-041**: À l'échéance, l'analyse automatique MUST se lancer seulement si : sonde active, seuil atteint, aucune
  analyse ni aucun codage en cours, aucune conversation en train de répondre, moins de 10 propositions à trier ;
  sinon elle est repoussée ou sautée, avec un message quand c'est utile.
- **FR-042**: Plusieurs échéances manquées (app fermée) MUST donner une seule analyse, après un court délai au
  démarrage ; aucune tâche ne tourne hors de l'app.
- **FR-043**: Une analyse automatique MUST se limiter à proposer, et prévenir mentalyas des nouvelles propositions
  par une notification discrète.

### Key Entities

- **Observation** : un événement de la sonde — famille, nom du catalogue, moment, écran, type et pseudonyme de
  l'objet, moyen, durée, résultat, type et emplacements d'une erreur, nombre (rafales regroupées). Aucun contenu.
- **Empreinte d'une tâche d'IA** : résumé chiffré de l'entrée et de la sortie d'une tâche, rattaché à son appel
  journalisé.
- **Analyse** : un passage de l'Analyste — déclencheur (manuel / automatique), période couverte, nombre
  d'observations, statut, nombre de propositions, appel d'IA associé.
- **Proposition** : une fiche — catégorie, titre, constat, preuves, proposition, gain, risque, gravité, confiance,
  fichiers visés, statut (à trier, reportée, refusée, acceptée, en codage, à corriger, prête, gardée, jetée, annulée),
  raison d'un refus.
- **Mise à jour** : la réalisation d'une proposition acceptée — branche, copie de travail, points de départ, de
  travail, de fusion et de révocation, résultat des vérifications, conversation de codage, statut.
- **Réglages de l'Analyste** : dépôt désigné, conservation, plafond de propositions, seuil de répétition, rythme,
  seuil d'observations, prochaine échéance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **0** texte saisi par mentalyas dans les observations, vérifié par un test automatique qui parcourt le
  profil démo puis cherche chacun de ses textes dans tout ce que la sonde a gardé.
- **SC-002**: **0** observation collectée dans l'app installée.
- **SC-003**: **100 %** des propositions affichées ont des preuves qui existent (fichiers dans le dépôt, références
  d'observations fournies), ou portent la mention « idée, sans preuve d'usage ».
- **SC-004**: **0** modification du dépôt sans acceptation explicite : aucune écriture ni commande possible pendant une
  analyse (vérifié par un test de consigne piégée), aucun codage déclenché par le rythme.
- **SC-005**: **0** publication vers un dépôt distant et **0** réécriture d'historique, vérifiés par un test qui
  inspecte toutes les commandes lancées sur les parcours Garder, Jeter, Annuler.
- **SC-006**: Une mise à jour gardée puis annulée ramène le code **exactement** à son état d'avant (aucune
  différence).
- **SC-007**: mentalyas trie 5 propositions en **moins de 2 minutes**.
- **SC-008**: Avec la sonde active, l'app ne montre **aucun ralentissement perceptible** : une rafale de 10 000
  événements ne bloque pas l'interface plus de 100 ms.
- **SC-009**: Sur la semaine d'observations simulées de démonstration, l'Analyste repère la tâche d'IA répétée et
  l'erreur la plus fréquente dans **au moins 2 analyses sur 3**.

## Assumptions

- mentalyas développe le Brainstormer depuis un dépôt git local avec `npm run dev` ; git et npm sont installés. La
  fonctionnalité ne vise pas un autre utilisateur de l'app installée.
- Claude Code (abonnement de mentalyas) est le moteur de l'analyse et du codage ; aucune nouvelle clé ni API.
- L'analyse statique de la spec 017 est disponible pour le dépôt du Brainstormer (même moteur que pour un projet
  repris).
- La lecture seule de l'analyse repose sur les restrictions d'outils du CLI ; qu'une lecture hors du dépôt (notamment
  dans le dossier de données de l'app) soit refusée doit être **vérifié sur la version installée** avant livraison
  (`L3-analyste-analyse.md` §2) ; à défaut, une interdiction explicite est ajoutée.
- Fusionner pendant `npm run dev` recharge l'app ; c'est accepté et annoncé.
- Le contenu de la copie de travail est gardé dans le dépôt, hors de tout suivi et de tous les outils (tests, lint,
  format, graphe).
- Aucune dépendance externe nouvelle n'est prévue ; une éventuelle dépendance sera annoncée au plan.
- Hors périmètre : observer les projets liés ou repris, publier une mise à jour, analyses partagées entre plusieurs
  utilisateurs, application automatique sans accord.
