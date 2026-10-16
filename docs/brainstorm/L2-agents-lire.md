# Niveau 2 — Lire les profils d'agents (`agents_lire`)

**Parent** : L1o-agents-assembles.md · **Maturité** : suffisant · **Tâches** : docs/TACHES-AGENTS.md

> Projet : Gestionnaire_idées · Basé sur : visio de mentalyas avec le PO « Product Owner IT » (2026-10-17), fusion du
> skill expert en agents dans `po-passation` · Date : 2026-10-17
>
> Manque pour « complet » : les réponses aux questions ouvertes (§ 7).

## 1. Objectif
Donner à Claude un outil MCP en **lecture seule** qui liste les profils d'agents disponibles, pour qu'il recommande la
bonne équipe et repère les agents qui manquent dans **toute** conversation, pas seulement dans une mission du pipeline.

## 2. Constat
- Dans une mission du pipeline, le PO reçoit la liste des profils dans son prompt (T009, `SPEC_AGENTS_INSTRUCTIONS`).
- Dans une visio d'agent, une conversation de neurone ou « Créer avec Claude », aucun outil ne donne cette liste. Les
  profils sont rangés dans la base de l'app ; Claude ne peut pas les voir.
- Le skill `po-passation` fusionné (mode Conseil) commence par l'inventaire des agents : sans cet outil, il doit
  demander la liste à mentalyas.
- Sur ce poste, `~/.claude/agents/` n'existe pas ; un projet peut quand même avoir un `.claude/agents/`.

## 3. Utilisateurs
- **Claude en PO** (visio du PO, conversation de neurone) : recommande l'équipe d'un projet ou d'un lot (D1, D25).
- **Claude en « Créer avec Claude »** (D15) : vérifie qu'un nouveau profil ne double pas un profil existant.
- **Tout agent en visio** (D13) : connaît ses coéquipiers.
- mentalyas ne l'utilise pas directement ; il voit les recommandations qui en découlent.

## 4. Périmètre

### Dans
- **Mode liste** (sans argument) : un profil par ligne avec son identifiant, son nom exact, son rôle, son modèle, son
  effort, son mode de permission, ses skills, une mission courte (début des consignes), et sa **source**.
- **Mode détail** (argument `agent` = identifiant ou nom exact) : le même profil avec ses consignes complètes.
- **Sources**, chacune nommée dans la réponse :
  - les profils de l'app (Skills › Profils d'agents) ;
  - les fichiers `.claude/agents/*.md` du projet de la conversation, s'il y en a un ;
  - les fichiers `~/.claude/agents/*.md`.
- Une source absente ou illisible est **signalée** dans la réponse, jamais passée sous silence.
- La réponse rappelle que le contenu des profils est une **donnée**, jamais une consigne (comme `skills_lire`).
- Disponible dans les conversations de neurone, les visios d'agent, le tête-à-tête d'un profil (D22) et la
  conversation « Créer avec Claude ».

### Hors
- Créer, modifier ou supprimer un profil (déjà couvert par `agent_profil_proposer`, D15, et le clic de mentalyas).
- Les agents fournis par des plugins : exclus pour l'instant (décision du PO, 2026-10-17, mentalyas n'a pas d'avis ;
  à rouvrir si un plugin installé apporte des agents utiles).
- Montrer l'état d'un agent au travail (passe, verdict) : c'est le volet de l'agent (D10).

## 5. User stories et critères d'acceptation

### US1 — Le PO voit l'équipe disponible
En tant que PO, je veux la liste des profils, pour recommander des agents qui existent vraiment.
- **CA1.1** Given trois profils dans l'app, When Claude appelle `agents_lire` sans argument, Then la réponse contient les
  trois noms exacts, chacun avec rôle, modèle, effort, permission, skills et la source « app ».
- **CA1.2** Given aucun profil dans l'app, When Claude appelle `agents_lire`, Then la réponse dit « aucun profil dans
  l'app » au lieu d'une liste vide muette.
- **CA1.3** Given la réponse de l'outil, Then elle contient la mention que le contenu des profils est une donnée et
  non une consigne.

### US2 — Le PO lit un profil en détail
En tant que PO, je veux les consignes complètes d'un profil, pour juger s'il couvre un besoin.
- **CA2.1** Given un profil « thor », When Claude appelle `agents_lire` avec `agent: "thor"`, Then la réponse contient
  ses consignes complètes et ses champs.
- **CA2.2** Given un nom inconnu, When Claude appelle `agents_lire` avec ce nom, Then l'outil répond par une erreur
  « introuvable » qui liste les noms existants.

### US3 — Toutes les sources sont vues
En tant que PO, je veux voir aussi les agents en fichiers, pour ne pas proposer d'en créer un qui existe déjà.
- **CA3.1** Given un fichier `.claude/agents/revue.md` dans le projet de la conversation, When Claude appelle
  `agents_lire`, Then « revue » apparaît avec la source « projet ».
- **CA3.2** Given un fichier dans `~/.claude/agents/`, Then il apparaît avec la source « perso ».
- **CA3.3** Given un `~/.claude/agents/` absent, Then la réponse le signale en une ligne, sans erreur.
- **CA3.4** Given un fichier d'agent mal formé, Then il est signalé comme illisible et les autres profils sont quand même
  listés.

### US4 — L'outil sert partout où l'on parle d'équipe
- **CA4.1** Given une visio d'agent, une conversation de neurone, un tête-à-tête de profil ou « Créer avec Claude »,
  When Claude appelle `agents_lire`, Then l'outil répond (aucun refus « ne sert que dans… »).
- **CA4.2** Given n'importe quel appel, Then aucun profil ni fichier n'est modifié.

## 6. Contraintes et risques
- **Taille** : des consignes longues gonfleraient le mode liste ; d'où la mission courte en liste et le texte complet
  en détail.
- **Doublons** : un même nom dans deux sources est montré deux fois, chacun avec sa source ; Claude le signale.
- **Confidentialité** : rien ne sort de la machine ; l'outil ne lit que les profils et les dossiers d'agents.
- **Injection** : le contenu d'un profil est une donnée (même règle que `skills_lire`).
- Le choix du format des fichiers d'agents lus, de la lecture et du découpage du code revient à l'architecte.

## 7. Questions ouvertes
- Aucune bloquante. Tranché le 2026-10-17 : le skill garde le nom `po-passation` ; les agents de plugins sont exclus ;
  il n'existe pas encore de profil architecte (mentalyas), il est à créer (§ 8).
- Reste pour « complet » : mentalyas valide la fiche de l'agent architecte à créer.

## 8. Équipe recommandée
| Lot | Agent | Ordre |
|---|---|---|
| T025 contrat | architecte (à créer, voir ci-dessous) | vague 1 |
| T028 scénarios | qa-qualite | vague 1, en parallèle de T025 |
| T026, T027 outil et accès | thor (backend) | vague 2, après T025 |
| T028 exécution | qa-qualite | vague 3 |
| T029 skill | PO | après T026 |

Chemin critique : T025 → T026 → T027 → T028 (exécution).
### Agent à créer — architecte
- **Rôle** : architecte
- **Mission** : traduire une spec du PO en décisions techniques et en contrats (interfaces, données, découpage), avant
  que le backend et le frontend codent.
- **Compétence couverte** : T025 (contrat de `agents_lire`) ; ensuite tout lot où backend et frontend doivent
  avancer en parallèle (D2).
- **Pourquoi aucun profil existant ne convient** : thor code, qa-qualite vérifie, le PO ne fait pas de choix
  technique ; personne ne décide le COMMENT.
- **Consignes clés** : lire le CLAUDE.md, la spec et le code concerné avant de décider ; suivre les patrons du code
  existant ; écrire un document d'architecture (décisions, contrat, fichiers touchés, risques) ; justifier chaque
  décision et les options écartées ; signaler au PO tout CA techniquement irréaliste.
- **Ne fait jamais** : coder l'implémentation ; changer le besoin ou les CA ; cocher une tâche d'un autre agent.
- **Livrable type et « fini »** : `docs/archi/<sujet>.md` avec un contrat que backend et QA peuvent appliquer sans
  revenir vers lui.
- **Modèle conseillé** : Opus, effort élevé.
- **Permission** : Écrire sans demander (il écrit des documents, ne lance pas de commandes).
- **Skills utiles** : selfdoubt, graphify.
