# Feature Specification: Arbre de skills (spec 020)

**Feature Branch**: `main` · **Created**: 2026-10-07 · **Status**: Draft — à valider par mentalyas
**Input**: « Il me faut une nouvelle page dans le volet de gauche qui reprend les skills de Claude. Les skills doivent
être représentés en nœuds de compétences avec les connexions logiques si certains skills communiquent, un peu comme les
arbres de compétences dans les jeux vidéo. Le nœud doit avoir le titre du skill, un niveau de puissance / qualité ou
étoiles […]. Quand je clique dessus, le volet de droite me montre la doc associée […] comme une sorte de fiche technique.
L'idée est de pouvoir brainstormer dans cette partie de l'app avec Claude exclusivement sur les skills pour en modifier,
en créer ou juste en importer depuis des GitHub. » — mentalyas. Brainstorm complet : `docs/FOUNDATION.md` §00000,
`docs/brainstorm/L1h-arbre-de-skills.md` (A1–A9), `L2-skills-{voir, comprendre, evoluer, importer}.md`,
`L3-skills-{voir, comprendre, evoluer, importer}.md`, `L4f-skills.md`. Constitution **4.3.0** (amendée pour cette spec).
**Glossaire** : *skill* = un ensemble d'instructions réutilisables de Claude Code (fichier `SKILL.md` et annexes) ;
*famille* = personnels, de projet, de plugins ; *brouillon* = version proposée d'un skill, gardée dans l'app tant qu'elle
n'est pas installée ; *quarantaine* = dossier temporaire où un dépôt importé est examiné sans rien exécuter ;
*bibliothèque* (D12) = copies locales gardées des dépôts importés, dans le profil de l'app, jamais exécutées.

## Décisions (2026-10-07, brainstorm validé)

| # | Sujet | Décision |
|---|-------|----------|
| D1 | Périmètre | Tous les skills, par familles : personnels, de projet (projets liés), de plugins installés (dernière version) ; filtre par famille. |
| D2 | Étoiles et usage | Qualité 1–5 ★ notée par Claude selon une grille fixe à 4 critères (clarté des déclencheurs, profondeur, garde-fous, exemples), chaque critère justifié ; la note de mentalyas prime. Usage réel sur 30 jours, compté à partir des seuls noms de skills appelés, sans lire le contenu des conversations. |
| D3 | Liens | Liens « appelle » détectés dans le texte des skills ; liens de sens (« enchaîne vers », « complète », « alternative à ») proposés par Claude avec justification ; mentalyas ajoute ou retire. |
| D4 | Écriture | Claude ne produit que des **brouillons** (rien sur le disque) ; mentalyas voit les différences et clique **Installer** ; chaque version remplacée est gardée (10 par skill) ; **Revenir à la version précédente**. |
| D5 | Import | Dépôt GitHub cloné en **quarantaine**, rien d'exécuté ; audit de chaque skill par Claude (sur le texte seul) doublé de règles fixes ; verdict sûr / à revoir / dangereux ; mentalyas choisit ; scripts exclus par défaut, autorisés fichier par fichier ; les skills gardés deviennent des brouillons. Reprend le clone contrôlé de la spec 017 (US5). |
| D6 | Disposition | Arbre de compétences : un tronc central « Toi », une branche par domaine, les skills le long de leur branche ; domaine proposé par Claude, corrigeable. |
| D7 | Conversations | Une conversation « Skills » générale (créer, combiner, techniques d'usage) + une conversation par skill. |
| D8 | Droits | Skills personnels et de projet modifiables (ceux de projet écrits dans le dépôt du projet, jamais commités par l'app) ; skills de plugins en lecture seule, « Dupliquer en skill personnel ». |
| D9 | Constitution | Amendement **4.3.0** (2026-10-07, validé) : principe I — écriture dans les dossiers de skills seulement sur « Installer » ou « Revenir », version sauvegardée ; jamais d'exécutable depuis un brouillon de Claude ; script d'import seulement autorisé fichier par fichier, jamais exécuté par l'app. |
| D10 | Supprimer (2026-10-08) | Demande de mentalyas : « Supprimer » un skill personnel ou de projet, **sur clic** et confirmation ; le dossier entier est sauvegardé dans les versions puis retiré ; annulable (Historique) et rétablissable. Claude peut le **proposer** dans la conversation, jamais le faire. Amendement constitution **4.5.0**. |
| D11 | Ordre (2026-10-08) | Demande de mentalyas : US3 (conversation + créer / modifier / supprimer) puis US4 (import GitHub) **avant** US2 (fiches et étoiles) ; la migration crée dès US3 toutes les tables prévues. |
| D12 | Bibliothèque (2026-10-08) | Retour du test guidé T032 (« Dépôt trop gros… 50 Mo, 2 000 fichiers ») : l'import fait une **copie locale gardée** du dépôt entier (dernière version, sans hooks ni sous-modules) dans `<profil>/skill-library/<hôte>/<auteur>/<dépôt>@<version>` (clonée directement à sa place, **jamais renommée** : sous Windows un dossier lu ne se renomme pas), garde-fou **1 Go**, plus de borne de fichiers ; repérage jusqu'à **300 skills**, profondeur 6, **un skill par nom** pris à l'emplacement le plus canonique (`skills/` ou `.claude/skills/` d'abord, documentation et traductions en dernier ; copies écartées comptées). Ses skills apparaissent sur la toile en nœuds **« disponible »** (branche Bibliothèque, une grappe par dépôt). À l'import, **règles fixes** seulement ; l'**audit par Claude** a lieu au clic **Installer**, pour ce skill (le plus sévère l'emporte toujours ; un skill inchangé n'est pas réaudité). « Mettre à jour » clone une nouvelle version, la base bascule dessus, puis l'ancienne copie est supprimée si possible, sinon au démarrage suivant (un échec garde l'ancienne copie) ; « Retirer de la bibliothèque » sur confirmation. Prévu ensuite (US5, hors de cette livraison) : pousser les skills choisis vers un dépôt GitHub « mes-skills » de mentalyas (privé par défaut), pour les retrouver sur une autre machine. Aucun amendement de la constitution (4.5.0 couvre copie sans hooks, Installer seulement sur clic, push sur clic). |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Voir sa toile de skills (Priority: P1) 🎯 MVP

mentalyas ouvre la page **Skills** : tous les skills disponibles apparaissent comme des nœuds d'un arbre de compétences,
reliés quand l'un appelle l'autre ; il filtre par famille, cherche par nom, et ouvre la fiche d'un skill (au départ, son
texte source).

**Why this priority**: c'est la vue d'ensemble demandée ; tout le reste s'y accroche.

**Independent Test**: ouvrir la page sur un poste avec des skills personnels, de projet et de plugins : chaque skill est
un nœud avec sa famille ; `hub` est relié à `graphify` et `professor` ; un skill au fichier abîmé est signalé sans casser
la page.

**Acceptance Scenarios**:

1. **Given** des skills dans les trois familles, **When** mentalyas ouvre Skills, **Then** il voit un nœud par skill
   (nom, famille par icône et libellé, repère ⚠ s'il contient des scripts), rangés autour du tronc.
2. **Given** un skill qui cite ou appelle un autre skill par son nom, **Then** un lien « appelle » les relie.
3. **Given** de nombreux skills de plugins, **Then** ils sont regroupés en une grappe qui se déplie au clic.
4. **Given** un skill sélectionné, **Then** le volet de droite montre sa fiche (texte source au minimum, fichiers,
   liens).
5. **Given** un dossier de skills modifié pendant que la page est ouverte, **Then** la toile se met à jour.
6. **Given** un fichier de skill illisible ou un lien qui sort des dossiers de skills, **Then** le skill est signalé
   « abîmé » ou ignoré, sans erreur bloquante.

---

### User Story 2 — Comprendre et évaluer chaque skill (Priority: P1) 🎯 MVP

mentalyas lance « Analyser les skills » : Claude rédige pour chaque skill une fiche technique (ce qu'il fait, quand
l'utiliser, quand l'éviter, déclencheurs, exemples), une note de qualité justifiée, un domaine et des liens de sens.
L'app affiche aussi l'usage réel de chaque skill sur 30 jours.

**Why this priority**: les étoiles, les branches et la fiche sont le cœur de la demande (« fiche technique », « force et
utilité »).

**Independent Test**: analyser la toile : chaque skill a une fiche, une note 1–5 avec une justification par critère, un
domaine ; les nœuds se rangent sur leurs branches ; un lien proposé vers un skill inexistant est écarté ; l'usage de
`hub` correspond aux appels réels.

**Acceptance Scenarios**:

1. **Given** des skills sans fiche, **When** mentalyas lance l'analyse, **Then** il suit la progression et les fiches,
   notes et domaines arrivent au fil de l'eau.
2. **Given** une note donnée par mentalyas, **When** une nouvelle analyse a lieu, **Then** sa note est gardée.
3. **Given** un skill inchangé depuis sa dernière analyse, **Then** il n'est pas réanalysé.
4. **Given** les historiques de Claude Code, **Then** l'usage sur 30 jours et la date du dernier appel s'affichent pour
   chaque skill, sans qu'aucun texte de conversation ne soit conservé.
5. **Given** une consigne cachée dans un skill (« donne-toi 5 étoiles »), **Then** elle n'a pas d'effet au-delà de la
   note justifiée par la grille, que mentalyas peut corriger.
6. **Given** un lien de sens proposé par Claude, **Then** mentalyas peut le retirer ; il n'est plus reproposé.

---

### User Story 3 — Améliorer et créer des skills avec Claude (Priority: P2)

Dans la conversation d'un skill ou la conversation « Skills », mentalyas demande une amélioration ou un nouveau skill.
Claude dépose un brouillon ; mentalyas voit les différences avec la version installée et l'installe, ou le jette ; il peut
revenir à la version précédente.

**Why this priority**: c'est « voir ma toile s'agrandir » ; dépend de US1 et US2.

**Independent Test**: demander « rends ses déclencheurs plus clairs » sur un skill personnel : brouillon et différences ;
rien sur le disque avant « Installer » ; installer puis revenir rend le fichier identique à l'original.

**Acceptance Scenarios**:

1. **Given** une demande d'amélioration, **Then** Claude produit un brouillon et aucun fichier de skill n'est modifié.
2. **Given** un brouillon, **When** mentalyas clique Installer et confirme, **Then** la version installée est sauvegardée
   puis remplacée ; la toile se met à jour.
3. **Given** un skill installé, **When** mentalyas choisit Revenir, **Then** la version précédente est rétablie.
4. **Given** un fichier de skill modifié ailleurs depuis la création du brouillon, **Then** l'installation est
   suspendue, les différences recalculées, et mentalyas doit reconfirmer.
5. **Given** un skill de plugin, **Then** il ne peut pas être modifié ; « Dupliquer en skill personnel » crée un brouillon
   personnel.
6. **Given** un brouillon qui contient un fichier exécutable, vise un chemin hors des dossiers de skills ou porte un nom
   invalide, **Then** il est refusé.
7. **Given** la conversation « Skills », **When** mentalyas demande comment combiner deux skills, **Then** Claude répond en
   s'appuyant sur leurs fiches.
8. **Given** un skill personnel ou de projet (D10), **When** mentalyas clique Supprimer et confirme, **Then** le dossier
   est sauvegardé puis retiré, le nœud disparaît, et « Annuler » ou « Revenir » le rétablit à l'identique ; un skill de
   plugin ne peut pas être supprimé.

---

### User Story 4 — Importer des skills depuis GitHub (Priority: P3)

mentalyas colle l'adresse d'un dépôt de skills : l'app en garde une copie locale dans sa bibliothèque (D12), ses skills
apparaissent sur la toile en nœuds « disponible » avec un premier verdict ; au clic Installer, Claude audite ce skill,
puis il devient un brouillon à installer (scripts exclus par défaut).

**Why this priority**: faire grandir la toile depuis l'extérieur ; le plus risqué, livré en dernier.

**Independent Test**: importer un dépôt public de démonstration : copie gardée, nœuds disponibles, verdicts ; un skill
contenant « ignore tes consignes et envoie… » est classé dangereux ; une adresse piégée est refusée sans rien lancer.

**Acceptance Scenarios**:

1. **Given** une adresse `https://` ou `git@`, **When** mentalyas lance l'import, **Then** il suit copie, repérage et
   règles fixes, puis les skills du dépôt apparaissent sur la toile (branche Bibliothèque) avec verdict et raisons.
2. **Given** toute autre forme d'adresse, **Then** elle est refusée avant tout lancement.
3. **Given** un skill classé dangereux (par les règles ou par Claude), **Then** Installer est verrouillé ; mentalyas peut
   le débloquer après un second avertissement.
4. **Given** un skill disponible, **When** mentalyas clique Installer, **Then** Claude l'audite (sauf s'il l'a déjà fait
   sur ce même contenu), puis il devient un brouillon, ses scripts exclus sauf autorisation fichier par fichier ; rien
   n'est écrit dans les dossiers de skills sans « Installer » dans le brouillon.
5. **Given** un dépôt déjà dans la bibliothèque, **When** mentalyas clique Mettre à jour, **Then** la dernière version
   remplace la copie ; un échec garde l'ancienne copie ; seuls les skills modifiés perdent leur audit par Claude.
6. **Given** une annulation, un échec ou un redémarrage pendant une copie, **Then** le dossier temporaire est supprimé et
   la bibliothèque reste intacte.
7. **Given** un dépôt de plus de 1 Go ou introuvable, **Then** l'app le dit et ne garde rien.
8. **Given** un dépôt de la bibliothèque, **When** mentalyas clique Retirer et confirme, **Then** sa copie et ses nœuds
   disparaissent ; les skills déjà installés ne bougent pas.

---

### Edge Cases

- Deux skills de même nom dans des familles différentes : deux nœuds, celui qui l'emporte pour Claude Code est indiqué.
- Dossier de skills personnels absent : famille vide, sans erreur.
- Claude Code indisponible ou abonnement épuisé : l'analyse et l'audit échouent proprement ; la toile reste visible.
- Réponse de Claude invalide : rejetée ; la fiche brute reste affichée ; à l'import, verdict « à revoir ».
- Échec en cours d'installation : l'état d'avant est rétabli, aucune version à moitié écrite.
- Skill de projet : écrit dans le dépôt du projet, jamais commité par l'app.
- Historiques de Claude Code illisibles ou absents : usage « inconnu », pas d'erreur.

## Requirements *(mandatory)*

### Functional Requirements

**Voir**

- **FR-001**: Une entrée **Skills** MUST figurer dans la navigation de gauche et ouvrir l'arbre de skills.
- **FR-002**: L'app MUST inventorier en lecture seule les skills personnels, ceux des projets liés et ceux des plugins
  installés (dernière version de chaque plugin), sans parcourir d'autre dossier et sans suivre de lien qui en sort.
- **FR-003**: Chaque skill MUST être un nœud portant son nom, sa famille (icône + libellé), ses étoiles et son usage
  (US2), un repère s'il contient des fichiers exécutables, et l'état « abîmé » si son fichier est illisible.
- **FR-004**: Un lien « appelle » MUST relier un skill qui cite ou appelle un autre skill par son nom exact.
- **FR-005**: L'arbre MUST se disposer autour d'un tronc central, une branche par domaine (par famille tant qu'aucun
  domaine n'est connu), sans chevauchement, de façon identique à chaque ouverture.
- **FR-006**: mentalyas MUST pouvoir filtrer par famille et chercher par nom ou description ; les skills de plugins MUST
  pouvoir être regroupés en une grappe dépliable.
- **FR-007**: Un clic sur un nœud MUST ouvrir sa fiche dans le volet de droite (fiche technique, texte source, fichiers,
  liens, origine) ; le texte d'un skill MUST être affiché comme texte, jamais interprété comme du code de page.
- **FR-008**: La toile MUST se mettre à jour quand un dossier de skills personnels ou de projet change ; les skills de
  plugins sont relus à chaque ouverture de la page.

**Comprendre**

- **FR-009**: « Analyser les skills » MUST produire, pour chaque skill à analyser, une fiche (résumé, quand l'utiliser,
  quand l'éviter, déclencheurs, entrées / sorties, exemples), une note par critère de la grille avec justification, un
  domaine et des liens de sens proposés, au format fixé et vérifié.
- **FR-010**: L'analyse MUST transmettre à Claude le texte du skill comme donnée, sans lui donner accès au disque ; une
  réponse invalide MUST être rejetée.
- **FR-011**: Les étoiles MUST être la moyenne arrondie de la grille (au moins 1) ; la note donnée par mentalyas MUST
  primer et survivre aux analyses suivantes.
- **FR-012**: Un lien de sens MUST relier deux skills inventoriés différents ; un lien retiré par mentalyas MUST NOT être
  reproposé.
- **FR-013**: Un skill inchangé depuis sa dernière analyse MUST NOT être réanalysé ; l'analyse n'a lieu qu'à la demande.
- **FR-014**: L'usage sur 30 jours MUST être compté à partir des seuls noms de skills appelés dans les historiques de
  Claude Code ; aucun autre contenu MUST NOT être conservé ni transmis.
- **FR-015**: mentalyas MUST pouvoir corriger étoiles, domaine et liens ; chaque correction MUST être annulable.

**Faire évoluer**

- **FR-016**: Une conversation « Skills » générale et une conversation par skill MUST être disponibles dans le volet de
  droite ; Claude y lit la toile et les skills par l'app, jamais par un chemin qu'il donnerait.
- **FR-017**: Claude MUST NOT écrire dans un dossier de skills ; il MUST seulement créer ou mettre à jour des brouillons,
  marqués comme siens.
- **FR-018**: Un brouillon MUST montrer ses différences avec la version installée (ou « nouveau skill ») ; il MUST être
  refusé s'il contient un fichier exécutable, un chemin hors du dossier du skill ou un nom invalide.
- **FR-019**: « Installer » MUST, sur confirmation, sauvegarder la version installée (10 versions gardées par skill),
  vérifier que le disque n'a pas changé depuis le brouillon, puis écrire le skill sans jamais laisser de version à
  moitié écrite ; l'installation MUST être annulable.
- **FR-020**: « Revenir à la version précédente » MUST rétablir la dernière version sauvegardée, sur confirmation.
- **FR-021**: Les skills de plugins MUST être en lecture seule ; « Dupliquer en skill personnel » MUST créer un brouillon
  personnel de même contenu.
- **FR-022**: Les skills de projet MUST être écrits dans le dépôt du projet lié ; l'app MUST NOT les commiter.
- **FR-023**: Un brouillon de nouveau skill MUST apparaître dans l'arbre comme nœud fantôme jusqu'à son installation.
- **FR-030** (D10): « Supprimer » MUST, sur confirmation, sauvegarder le dossier entier du skill (versions) puis le
  retirer ; MUST être annulable et rétablissable ; MUST être refusé pour un skill de plugin ; Claude MUST NOT supprimer.

**Importer**

- **FR-024**: L'adresse d'import MUST être contrôlée (formes `https://` ou `git@` seulement, identifiants retirés,
  transports dangereux refusés) avant tout lancement.
- **FR-025** (D12): Le dépôt MUST être cloné sans rien exécuter (ni hooks, ni sous-modules), dans une limite de taille
  (1 Go) et de durée, avec annulation, directement dans le dossier de sa version
  (`<profil>/skill-library/<hôte>/<auteur>/<dépôt>@<version>`, vérifié sous la racine de la bibliothèque) ; aucun
  dossier de la bibliothèque MUST NOT être renommé.
- **FR-026** (D12): Chaque skill trouvé (300 au plus, profondeur 6) MUST recevoir à l'import un verdict des règles fixes
  (sûr / à revoir / dangereux) avec des raisons ; au clic Installer, Claude MUST l'auditer sur le texte seul (sauf audit
  déjà fait sur la même empreinte) ; la plus sévère des deux MUST l'emporter ; une analyse impossible MUST donner
  « à revoir ».
- **FR-027**: Un skill dangereux MUST être verrouillé ; son déblocage MUST demander un second avertissement.
- **FR-028**: Un skill installé depuis la bibliothèque MUST devenir un brouillon ; ses fichiers exécutables MUST être
  exclus sauf autorisation fichier par fichier ; l'app MUST NOT exécuter aucun fichier importé.
- **FR-029** (D12): Le clone d'une version MUST être supprimé à l'échec et à l'annulation ; au démarrage, toute copie que
  la base ne référence plus MUST être supprimée ; la copie courante MUST rester intacte ; l'origine (adresse sans identifiant, commit, chemin) MUST être gardée sur le
  brouillon.
- **FR-031** (D12): Les skills de la bibliothèque MUST apparaître sur la toile en nœuds « disponible » (verdict par icône
  + libellé, « installé » si un skill personnel du même nom existe), regroupés par dépôt dans une grappe dépliable.
- **FR-032** (D12): « Mettre à jour » MUST cloner une nouvelle version et basculer la base dessus sans jamais perdre
  l'ancienne copie en cas d'échec ; une ancienne copie encore lue MUST NOT faire échouer la mise à jour ; MUST garder l'audit de Claude des skills dont l'empreinte n'a pas changé.
- **FR-033** (D12): « Retirer de la bibliothèque » MUST, sur confirmation, supprimer la copie et ses skills disponibles,
  sans toucher aux skills installés ni aux brouillons.

### Key Entities

- **Skill** (inventorié, non stocké) : identifiant (famille + nom), nom, description, famille, origine, fichiers (repère
  exécutable), état abîmé, empreinte du contenu.
- **Fiche de skill** : fiche technique, grille et justifications, étoiles de Claude et de mentalyas, domaine et sa source,
  date et modèle de l'analyse.
- **Domaine** : branche de l'arbre (libellé, position), proposé ou validé.
- **Lien de skill** : de, vers, sorte (appelle, enchaîne vers, complète, alternative à), origine (écrit, Claude,
  mentalyas), justification, retiré.
- **Brouillon** : famille, projet, nom, description, contenu, annexes, base vue sur le disque, origine (Claude, import,
  duplication), statut.
- **Version sauvegardée** : skill, emplacement, empreinte, date, lot d'historique.
- **Import / dépôt de la bibliothèque** (D12) : adresse, commit, dossier de la copie, statut, date de mise à jour,
  liste tronquée ; skills disponibles (nom, dossier, fichiers, empreinte, verdict et raisons des règles, audit de Claude
  et son empreinte).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **100 %** des skills présents dans les trois familles apparaissent dans l'arbre (comparaison avec
  l'inventaire du disque).
- **SC-002**: **0** fichier de skill modifié sans un clic « Installer », « Revenir » ou « Supprimer » de mentalyas, vérifié par un test
  qui parcourt les conversations et l'import.
- **SC-003**: Installer puis Revenir ramène le skill **exactement** à son contenu d'origine.
- **SC-004**: **0** texte de conversation conservé par le comptage d'usage (test sur historiques fictifs).
- **SC-005**: **0** fichier importé exécuté ; **100 %** des skills de démonstration contenant une consigne malveillante
  connue classés au moins « à revoir ».
- **SC-006**: mentalyas comprend à quoi sert un skill inconnu et quand l'utiliser en **moins d'une minute** à partir de
  sa fiche.
- **SC-007**: La page Skills s'ouvre et devient utilisable en **moins de 2 secondes** avec 150 skills.

## Assumptions

- Claude Code est installé et connecté (abonnement de mentalyas) ; sans lui, la toile reste visible mais sans analyse
  ni audit.
- Les dossiers de skills suivent les conventions actuelles de Claude Code (un dossier par skill avec `SKILL.md`) ; la
  règle de priorité entre deux skills de même nom est à confirmer au plan.
- L'import réutilise le contrôle d'adresse et le clone de la spec 017 (US5, en pause), qui sont livrés avec cette spec.
- Les dépôts de démonstration et skills de test sont fictifs (dépôt public : aucune donnée réelle).
- Aucune dépendance externe nouvelle n'est prévue ; une éventuelle dépendance sera annoncée au plan.
- Hors périmètre de cette livraison : publier un skill vers GitHub (prévu en US5 « mes-skills », D12), mises à jour automatiques des skills importés (une vérification
  manuelle « mises à jour disponibles » pourra suivre), modification des skills de plugins.
