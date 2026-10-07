---
type: MOC
subject: Gestionnaire_idées — le Brainstormer (session inaugurale du 2026-09-28 : specs 001 et 002 ; session du soir 28→29/09 : spec 003 interface ; session du 29→30/09 : cycle 2, économies d'API, spec 004 widgets ; après-midi et soir du 30/09 : prochaine étape, specs 005 et 006 widgets branchés et proposés ; session du 04→06/10 : interface visuelle de Claude Code, specs 007 à 016 ; matin du 07/10 : reprise d'un projet existant, spec 017 US4 et D16 ; après-midi du 07/10 : carte de structure ordonnée (D17) et conception de l'Analyste interne, spec 019 ; soir du 07/10 : sonde codée (019 US1), carte de structure D18–D21 — contenu, statut, vue Architecture, avancement vivant)
tags: [#MOC, #electron, #ia, #neurones, #securite, #ui, #widgets, #mcp, #claude-code, #processus, #fichiers, #reprise, #analyste, #git, #vie-privee, #architecture, #prompt, #accessibilite]
date: 2026-10-07
---

# Gestionnaire idées — Map of Content

> **En résumé** : en une journée, le projet est passé d'une idée (« noter vite mes idées ») à un **Brainstormer** : une app de bureau Electron où chaque idée est un **neurone** qui pousse grâce aux questions d'une IA hybride (Ollama local + Claude), puis **éclot** en plan d'action ou en synthèse. L'idée qui relie tout : **l'IA propose, le code garantit, l'humain décide** — chaque couche (processus, IPC, base, passerelle IA, contrôles) ajoute une barrière vérifiable.
>
> ⚠️ **Note de fiabilité** : il n'y a pas de cours de professeur pour ce projet — tout le parcours est tiré de **l'implémentation** (`src/`, `tests/`), du **cadrage** (`docs/FOUNDATION.md`, `docs/brainstorm/`, `.specify/memory/constitution.md`, `specs/001-003`) et du `docs/JOURNAL.md`. Le code a été **lu, pas exécuté** : les comportements décrits sont ⚠️ *Probables* au sens du protocole, appuyés sur les 305 tests et le journal. Validations réelles encore ouvertes : T031 et T038 (recherche web avec la vraie clé).
>
> Réseau visuel → [[Gestionnaire idées — Réseau.canvas]]

```mermaid
flowchart TD
    subgraph "Cadrage — brainstorm + Spec Kit"
        A["Du brainstorm au code"]
    end
    subgraph "Spec 001 — charpente et moteur IA"
        B["Electron cloisonné"] --> C["IPC typé"] --> D["Clean Architecture"]
        D --> E["Stockage chiffré"]
        D --> F["Passerelle IA hybride"]
        F --> G["Anonymisation"] --> H["Injection de prompt"] --> I["Budget IA"]
        H --> N["Import de contexte"]
    end
    subgraph "Spec 002 — moteur de neurones"
        J["Croissance + jauge"] --> K["Synthèse vérifiée"] --> L["Éclosion atomique"] --> M["Liens entre idées"]
    end
    subgraph "Spec 003 — interface MVP-1 (soir du 28→29/09)"
        O["Coquille de bureau"] --> P["Carte des idées<br/>forces + croisements"] --> Q["Plongée radiale"] --> R["Annuler par lot"]
    end
    subgraph "Spec 004 — widgets (29→30/09)"
        S["Bac à sable<br/>iframe + gi-widget"] --> T["Widget généré<br/>par Claude"]
    end
    subgraph "Specs 005-006 — widgets branchés et proposés (30/09 soir)"
        U["Widget branché<br/>empreinte + postMessage"] --> V["Cadre résultat<br/>bornes + vue figée"] --> W["Outils au verrouillage<br/>transaction puis génération"]
    end
    A --> B
    I --> J
    B --> O
    L --> R
    R --> S
    T --> U
    L --> W
    subgraph "Specs 007-016 — interface visuelle de Claude Code (04→06/10)"
        X1["Pont MCP<br/>relais + canal nommé"] --> X2["Piloter Claude Code<br/>stream-json + session"] --> X3["Permissions relayées<br/>l'humain décide"]
        X2 --> X4["Plan d'attaque<br/>DAG + verrou"] --> X5["Fichiers écrits<br/>atomique + realpath"] --> X6["Lancer sans shell<br/>chemin absolu"]
    end
    C --> X1
    W --> X4
    subgraph "Spec 017 — reprendre un projet existant (07/10)"
        Y1["Guide de reprise<br/>contexte borné + sources vérifiées"] --> Y2["Explorateur de code<br/>module → bloc, appelants / appelés"]
    end
    X6 --> Y1
    Y2 --> Y3["Carte ordonnée (D17)<br/>tri par dépendances + boîtes"]
    subgraph "Spec 019 — Analyste interne (US1 sonde codée le 07/10 soir ; US2-US3 conçues)"
        Z1["Sonde sans contenu<br/>HMAC + pseudonymes"] --> Z2["Analyste en lecture seule<br/>preuves revérifiées"] --> Z3["Mise à jour réversible<br/>worktree + no-ff + revert"]
    end
    Y3 --> Z1
    subgraph "Spec 017 D18-D21 — la carte de structure se lit autrement (07/10 soir)"
        W1["Vue Architecture<br/>règle de dépendance + 2 dispositions"] --> W2["Avancement vivant<br/>moyenne récursive"] --> W3["Consigne d'agent outillé<br/>ce qui ne change pas + anti-outil"]
    end
    Y3 --> W1
```

> 🆕 **Soir du 07/10 (spec 019 US1, spec 017 D18–D21)** : la **sonde** de l'Analyste est **codée** et validée (garde du dépôt, catalogue fermé, HMAC, files et lots, mesure au dispatcher, tee du journal) ; la carte de structure dit **ce que contient** chaque nœud (doc / code, calculé par l'app), **son statut** sans dépendre de la couleur, se lit en **vue Architecture** (couches, « ⚠ sens interdit ») et montre un **avancement vivant** (Claude déclare les feuilles, l'app calcule les parents). Deux bugs venaient des **consignes**, pas du code. Nouvelles notes : 3 concepts, 4 glossaires ; blocs « Évolution du 07/10 (soir) » dans 9 notes (Sonde — avec bandeau de correction du statut —, Analyste, Carte ordonnée, Clean Architecture, IPC typé, Annuler par lot, Donnée dérivée, DFS, HMAC). ⚠️ Empreintes des tâches d'IA (T018) **pas encore branchées** ; test guidé T079 (D21) encore à faire.

> 🆕 **Après-midi du 07/10 (spec 017 D17, brainstorm et spec 019)** : la carte de structure se lit maintenant **dans l'ordre** (rang de Claude, sinon dépendances, sinon dessin), numérotée 1 / 1.2 / 1.2.1, en disposition alternée sans chevauchement (code livré, test T059 validé). Puis une chaîne de conception complète pour l'**Analyste interne** : une sonde observe l'app **sans contenu**, Claude analyse **en lecture seule** et propose avec preuves revérifiées, une proposition acceptée est codée sur une branche `analyste/*` dans un **worktree**, gardée par fusion `--no-ff` et annulable par `git revert -m 1`. Nouvelles notes : 4 concepts, 4 glossaires ; blocs « Évolution du 07/10 » dans 10 notes (Brainstorm au code, Kahn, SHA-256, Coquille, Lancer sans shell, Synthèse vérifiée, Anonymisation, Traversée de chemin, DFS, Plan d'attaque). ⚠️ Les trois notes de la spec 019 décrivent une **conception** (aucun code encore) : leurs extraits sont *Probables* ; preuve bloquante à venir : R1 (lecture du dossier de données refusée par le CLI).

> 🆕 **Matin du 07/10 (spec 017 US4 et D16)** : pour un projet **écrit par d'autres**, l'app fait rédiger un **guide de reprise** en 9 sections (Claude, ou Ollama seul si le projet est « Local uniquement »), dont chaque source citée est **vérifiée** contre l'analyse ; puis l'explorateur passe à **un seul écran** : modules et dossiers sur la carte, fichier entier dans le volet avec, par bloc, ses **appelants** et ses **appelés**. Nouvelles notes : 2 concepts, 2 glossaires ; blocs « Évolution du 07/10 » dans 4 notes (Passerelle, Synthèse vérifiée, Fichiers écrits, Injection de prompt). 🔒 Faille FR-030 corrigée (documents écrits dans le dossier du projet repris). ℹ️ L'import, l'analyse statique tree-sitter, la confidentialité par projet et la carte de Claude (US1, US3, US7, nuit du 06→07/10) n'ont **pas encore de note dédiée** : les deux notes du jour en donnent l'essentiel dans leurs introductions.

> 🆕 **Session du 04→06/10 (specs 007 à 016)** : virage de la vision — le Brainstormer devient **l'interface visuelle de Claude Code**. Claude lit et dessine la carte par un **pont MCP**, chaque idée est une **conversation `claude -p`**, l'API Anthropic disparaît, l'ancien moteur de neurones est **retiré** (≈ 13 400 lignes). Puis : plan d'attaque, documents Markdown, actions finales qui écrivent dans un vrai projet, permissions relayées en cartes, genesis → projet avec git. Nouvelles notes : 6 concepts, 5 glossaires ; blocs « Évolution » ajoutés dans 21 notes existantes. ⚠️ **Huit d’entre eux sont des corrections** : passerelle, anonymisation, budget, croissance, synthèse, liens, plongée, outils au verrouillage — ces modules **n'existent plus dans le code** (tables gardées en archive). Les notes restent des cours valables sur leurs techniques.

> 🆕 **Session du 28→29/09 (spec 003)** : l'app devient **visible et utilisable** — icône de notification, capture rapide au raccourci, carte des idées sans croisements, plongée en couronne, aperçu éditable, éclosion animée, historique avec « Annuler ». Nouvelles notes : 4 concepts, 1 pont, 2 glossaires ; blocs « Évolution du 29/09 » ajoutés dans 4 notes existantes (Electron, Éclosion, Liens, Zod).

> 🆕 **Session du 29→30/09 (cycle 2, économies, spec 004)** : Claude **fabrique des outils** (mini-widgets) directement sur la carte, et ce code s'exécute dans un enclos dont il ne peut pas sortir. Nouvelles notes : 2 concepts, 2 glossaires ; blocs « Évolution du 30/09 » ajoutés dans 10 notes existantes (Electron, CSP, Injection, Passerelle, Budget, Annuler, Éclosion, Carte, Plongée, Brainstorm au code). ⚠️ Deux de ces blocs sont des **corrections** : les zones incubateur/réseau de la note 16 et l'écran de plongée de la note 17 n'existent plus dans le code.

> 🆕 **Après-midi et soir du 30/09 (T070–T072, specs 005 et 006)** : un widget peut **lire** une idée (après ta revue, scellée par une empreinte), **publier** un résultat dans un cadre dédié, et Claude peut **proposer** des outils au verrouillage, créés avec l'éclosion puis générés en arrière-plan. Nouvelles notes : 3 concepts, 3 glossaires ; blocs « Évolution du 30/09 » ajoutés dans 7 notes existantes (Zod, Éclosion, Synthèse, Bac à sable, Widget généré, Croissance, Carte) et une ligne dans 2 glossaires (SHA-256, Origine). ⚠️ Test manuel T016 de la spec 006 lot 2 encore à faire.

---

## Zéro Electron / IA ? Commence ici
- [[Du brainstorm au code — spécifications et constitution]] — comment une idée devient des exigences puis du code.
- [[Glossaire — LLM (grand modèle de langage)]] — ce qu'est réellement « l'IA » ici.
- [[Glossaire — IPC (communication entre processus)]] — pourquoi deux processus doivent s'écrire.

## Glossaire — notions transversales
- [[Glossaire — IPC (communication entre processus)]] — messages entre mémoires isolées
- [[Glossaire — CSP (Content Security Policy)]] — liste blanche des scripts
- [[Glossaire — LLM (grand modèle de langage)]] — prédire le prochain token
- [[Glossaire — Token (IA)]] — unité de texte et de facturation
- [[Glossaire — Transaction ACID]] — tout ou rien en base
- [[Glossaire — Idempotence]] — rejouer sans doubler
- [[Glossaire — Empreinte SHA-256]] — scellé d'intégrité
- [[Glossaire — Tri topologique de Kahn]] — détecter une boucle
- [[Glossaire — Expression régulière]] — motifs de texte déterministes
- [[Glossaire — FTS5 (recherche plein texte)]] — index inversé SQLite
- [[Glossaire — Générateur pseudo-aléatoire à graine (PRNG)]] — du hasard reproductible *(29/09)*
- [[Glossaire — Mise à jour optimiste]] — afficher avant la confirmation *(29/09)*
- [[Glossaire — Origine web et origine opaque]] — qui peut lire quoi dans un navigateur *(30/09)*
- [[Glossaire — Suppression douce (soft delete)]] — marquer au lieu d'effacer *(30/09)*
- [[Glossaire — Donnée dérivée (calculer plutôt que stocker)]] — une seule source de vérité *(30/09 soir)*
- [[Glossaire — Parcours en profondeur (DFS)]] — parent puis ses enfants, et la pile d'appels *(30/09 soir)*
- [[Glossaire — Throttle et debounce (regrouper des événements)]] — débit maximal ou attente du calme *(30/09 soir)*
- [[Glossaire — MCP (Model Context Protocol)]] — la prise standard des outils d'un agent IA *(06/10)*
- [[Glossaire — Canal nommé et flux standard]] — stdin/stdout, tuyau nommé, JSON par ligne *(06/10)*
- [[Glossaire — Écriture atomique (temporaire puis renommage)]] — ancien ou nouveau, jamais à moitié *(06/10)*
- [[Glossaire — Traversée de chemin et lien symbolique]] — rester dans son dossier, vérifié sur le chemin réel *(06/10)*
- [[Glossaire — Clé stable et upsert]] — recevoir deux fois la même chose sans doublon *(06/10)*
- [[Glossaire — Fenêtre de contexte (IA)]] — ce que le modèle voit d'un coup, et la troncature silencieuse *(07/10)*
- [[Glossaire — Graphe d'appels (appelants et appelés)]] — qui appelle qui, lu dans les deux sens *(07/10)*
- [[Glossaire — HMAC (empreinte à clé)]] — comparer sans révéler, et pourquoi un hash simple se devine *(07/10 après-midi)*
- [[Glossaire — Pseudonymisation et minimisation des données]] — ne pas collecter, puis suivre sans identifier *(07/10 après-midi)*
- [[Glossaire — Principe du moindre privilège]] — retirer la capacité plutôt qu'interdire *(07/10 après-midi)*
- [[Glossaire — Versionnage sémantique (MAJOR.MINOR.PATCH)]] — ce que dit un numéro de version *(07/10 après-midi)*
- [[Glossaire — Union discriminée et catalogue fermé]] — une étiquette, une forme, rien d'autre *(07/10 soir)*
- [[Glossaire — File et écriture par lots (batching)]] — une transaction pour mille événements, file bornée *(07/10 soir)*
- [[Glossaire — Préoccupation transverse (point unique et tee)]] — mesurer là où tout passe, dériver un flux *(07/10 soir)*
- [[Glossaire — Information sans la couleur seule (accessibilité)]] — couleur + forme + texte (WCAG 1.4.1) *(07/10 soir)*

## Concepts fondamentaux
*À maîtriser en premier — la charpente*
- [[Du brainstorm au code — spécifications et constitution]] — des exigences avant le code
- [[Architecture Electron — trois processus cloisonnés]] — main, preload, renderer
- [[IPC typé — le guichet unique entre interface et moteur]] — valider à la frontière
- [[Clean Architecture — domaine, application, infrastructure]] — ports, adaptateurs, injection

## Concepts intermédiaires
*Nécessitent les fondamentaux — données et moteur IA (spec 001)*
- [[Stockage local chiffré — SQLite, SQLCipher et DPAPI]] — base illisible sans ta session
- [[Passerelle IA hybride — un seul point d'accès à l'IA]] — routage, file, validation
- [[Anonymisation en deux couches]] — regex + IA locale qui liste
- [[Injection de prompt — cadre figé et données balisées]] — données ≠ consignes
- [[Budget IA — convertir des tokens en euros]] — coût réel et plafond

## Concepts avancés
*Le moteur de neurones (spec 002) et l'import de contexte*
- [[Croissance d'un neurone — arbre, garde-fous et jauge]] — l'IA propose, le code garantit
- [[Synthèse vérifiée — contrôles déterministes et provenance]] — P1–P6, Kahn, anti-hallucination
- [[Éclosion atomique — transaction, version et historique]] — tout ou rien, `STALE`, historique
- [[Liens entre idées — graphe local de mots-clés]] — présélection gratuite avant Claude
- [[Import de contexte — paquet vérifié, versionné, réversible]] — former l'agent sans ré-entraîner

## Interface (spec 003 — session du 28→29/09)
*Ce que l'utilisateur voit et touche — s'appuie sur la charpente et le moteur*
- [[Coquille de bureau — zone de notification, instance unique et fenêtres cachées]] — *intermédiaire* — l'app résidente, toujours prête
- [[Carte des idées — simulation de forces et croisements de liens]] — *avancé* — physique d3-force + géométrie anti-croisements
- [[Plongée radiale — couronne sur un arc et affichage optimiste]] — *intermédiaire* — un niveau à la fois, trigonométrie simple
- [[Annuler par lot — journal avant-après, conflit et lot inverse]] — *avancé* — undo/redo transactionnel avec détection de conflit

## Widgets (spec 004 — session du 29→30/09)
*Du code écrit par une IA, exécuté sans lui faire confiance*
- [[Bac à sable des widgets — iframe isolée, origine opaque et protocole gi-widget]] — *avancé* — cinq barrières indépendantes du modèle
- [[Widget généré par Claude — effacement de types, versions par pointeur et échec sans dégât]] — *intermédiaire* — de la demande à la version N+1, et retour

## Widgets branchés et proposés (specs 005-006 — soir du 30/09)
*Ouvrir des portes étroites dans l'enclos, et faire naître les outils au bon moment*
- [[Widget branché — autorisation par empreinte et pont postMessage]] — *avancé* — ce qui entre : revue, empreinte, `event.source`, forme sans valeur pour Claude
- [[Cadre résultat — sortie bornée, vue figée et rafales regroupées]] — *avancé* — ce qui sort : bornes dans le main, `textContent`, throttle
- [[Outils proposés au verrouillage — créer dans la transaction, générer hors transaction]] — *avancé* — rapide et annulable dedans, lent et faillible après

## Interface visuelle de Claude Code (specs 007-016 — 04→06/10)
*Donner des mains à un agent extérieur, et garder la décision*
- [[Pont MCP — relais stdio, canal nommé et secret partagé]] — *avancé* — un deuxième guichet vers le main, sans port réseau
- [[Piloter Claude Code — processus enfant, flux stream-json et session reprise]] — *avancé* — le CLI comme moteur, sans hériter de ses réglages
- [[Permissions relayées — l'humain dans la boucle d'un agent]] — *avancé* — attendre un humain sans bloquer, refuser par défaut
- [[Plan d'attaque — étapes ordonnées, dépendances sans cycle et verrou]] — *avancé* — DAG, DFS trois couleurs, garde D6, disposition pure
- [[Fichiers écrits par l'app — chemin choisi par le main, écriture atomique, corbeille]] — *intermédiaire* — documents, dossier de projet, registre
- [[Lancer un programme sans shell — chemin absolu, arguments séparés, listes blanches]] — *avancé* — git, npm, éditeur, sans injection

## Reprendre un projet existant (spec 017 — 07/10)
*Lire le code d'un autre sans le modifier, et sans le laisser partir*
- [[Guide de reprise — contexte borné, sections fixes et sources vérifiées]] — *avancé* — l'IA rédige, le code vérifie chaque citation ; Ollama seul en « Local uniquement »
- [[Explorateur de code — du module au bloc, appelants et appelés]] — *avancé* — carte à deux étages, volet de code, liens agrégés sur l'ancêtre visible
- [[Carte de structure ordonnée — ordre de progression, tri par dépendances et disposition alternée]] — *avancé* — tri topologique stable, numéros préfixes, boîtes récursives *(D17, après-midi ; D18–D19 le soir : contenu, lisibilité, statut)*
- [[Vue Architecture — règle de dépendance, couches déduites et deux dispositions pures]] — *avancé* — une règle pour cinq architectures, priorité de mentalyas sur Claude *(D20, soir)*
- [[Avancement vivant — agrégation récursive, outil dédié et consigne au bon endroit]] — *intermédiaire* — feuille déclarée, parent calculé *(D21, soir)*
- [[Consigne pour un agent outillé — dire ce qui ne change pas, nommer l'outil et l'anti-outil]] — *intermédiaire* — deux bugs de consigne, deux règles *(soir)*

## Analyste interne (spec 019 — conçue le 07/10 ; la sonde, US1, est codée depuis le soir)
*Une app qui s'observe, propose et s'améliore — sans jamais agir sans accord*
- [[Sonde sans contenu — télémétrie minimisée, empreintes HMAC et pseudonymes]] — *avancé* — catalogue fermé, HMAC à clé locale, lots bornés
- [[Analyste en lecture seule — moindre privilège et propositions vérifiées]] — *avancé* — Read / Glob / Grep seulement, preuves citables revérifiées
- [[Mise à jour réversible — worktree, branche, fusion no-ff et git revert]] — *avancé* — coder à côté de l'app ouverte, garder, jeter, annuler

## Ponts outil ↔ mécanisme
- [[Drizzle ORM ↔ SQL paramétré et migrations]] — ce que l'ORM fait à ta place (et pourquoi pas Prisma)
- [[Zod ↔ type guards et sortie structurée]] — un schéma pour l'IPC, pour guider l'IA et pour la vérifier (+ sortie tolérante, 29/09)
- [[TanStack Query et Zustand ↔ cache de données et état d'interface]] — cache invalidé par événements vs état d'écran *(29/09)*

## Ordre d'apprentissage recommandé
0. [[Du brainstorm au code — spécifications et constitution]] — le pourquoi de toutes les règles qui suivent
1. [[Architecture Electron — trois processus cloisonnés]] — la charpente physique (processus, mémoire)
2. [[IPC typé — le guichet unique entre interface et moteur]] — la seule porte d'entrée
3. [[Clean Architecture — domaine, application, infrastructure]] — où range-t-on la logique
4. [[Stockage local chiffré — SQLite, SQLCipher et DPAPI]] — puis le pont [[Drizzle ORM ↔ SQL paramétré et migrations]]
5. [[Passerelle IA hybride — un seul point d'accès à l'IA]] — puis le pont [[Zod ↔ type guards et sortie structurée]]
6. [[Anonymisation en deux couches]] — la première garde avant Internet
7. [[Injection de prompt — cadre figé et données balisées]] — la deuxième garde
8. [[Budget IA — convertir des tokens en euros]] — la garde financière
9. [[Croissance d'un neurone — arbre, garde-fous et jauge]] — le cœur métier
10. [[Synthèse vérifiée — contrôles déterministes et provenance]] — contrôler l'IA
11. [[Éclosion atomique — transaction, version et historique]] — écrire sans risque
12. [[Liens entre idées — graphe local de mots-clés]] — relier en économisant
13. [[Import de contexte — paquet vérifié, versionné, réversible]] — personnaliser l'agent
14. [[Coquille de bureau — zone de notification, instance unique et fenêtres cachées]] — l'app prend corps sur le bureau
15. [[TanStack Query et Zustand ↔ cache de données et état d'interface]] — comment l'interface garde et rafraîchit ses données
16. [[Carte des idées — simulation de forces et croisements de liens]] — avec [[Glossaire — Générateur pseudo-aléatoire à graine (PRNG)]]
17. [[Plongée radiale — couronne sur un arc et affichage optimiste]] — avec [[Glossaire — Mise à jour optimiste]]
18. [[Annuler par lot — journal avant-après, conflit et lot inverse]] — relire d'abord le bloc « Évolution du 29/09 » de la note 11
19. [[Bac à sable des widgets — iframe isolée, origine opaque et protocole gi-widget]] — avec [[Glossaire — Origine web et origine opaque]] ; relire avant le bloc « Évolution du 30/09 » de [[Glossaire — CSP (Content Security Policy)]]
20. [[Widget généré par Claude — effacement de types, versions par pointeur et échec sans dégât]] — avec [[Glossaire — Suppression douce (soft delete)]]
21. [[Widget branché — autorisation par empreinte et pont postMessage]] — relire avant [[Glossaire — Empreinte SHA-256]] ; avec [[Glossaire — Donnée dérivée (calculer plutôt que stocker)]]
22. [[Cadre résultat — sortie bornée, vue figée et rafales regroupées]] — avec [[Glossaire — Throttle et debounce (regrouper des événements)]] et [[Glossaire — Parcours en profondeur (DFS)]]
23. [[Outils proposés au verrouillage — créer dans la transaction, générer hors transaction]] — relire avant le bloc « Évolution du 30/09 (soir) » de [[Zod ↔ type guards et sortie structurée]]
24. [[Pont MCP — relais stdio, canal nommé et secret partagé]] — avec [[Glossaire — MCP (Model Context Protocol)]] et [[Glossaire — Canal nommé et flux standard]] ; relire avant [[IPC typé — le guichet unique entre interface et moteur]]
25. [[Piloter Claude Code — processus enfant, flux stream-json et session reprise]] — puis les blocs « Évolution du 05/10 » de la Passerelle, de l'Anonymisation et du Budget (ce qui a disparu, et pourquoi)
26. [[Permissions relayées — l'humain dans la boucle d'un agent]] — puis le bloc « Évolution du 06/10 » de [[Injection de prompt — cadre figé et données balisées]]
27. [[Plan d'attaque — étapes ordonnées, dépendances sans cycle et verrou]] — avec [[Glossaire — Parcours en profondeur (DFS)]] (bloc des trois couleurs) et [[Glossaire — Clé stable et upsert]]
28. [[Fichiers écrits par l'app — chemin choisi par le main, écriture atomique, corbeille]] — avec [[Glossaire — Écriture atomique (temporaire puis renommage)]] et [[Glossaire — Traversée de chemin et lien symbolique]]
29. [[Lancer un programme sans shell — chemin absolu, arguments séparés, listes blanches]] — la synthèse sécurité de la session
30. [[Guide de reprise — contexte borné, sections fixes et sources vérifiées]] — avec [[Glossaire — Fenêtre de contexte (IA)]] ; relire avant les blocs « Évolution du 07/10 » de la Passerelle, de la Synthèse vérifiée et de l'Injection de prompt
31. [[Explorateur de code — du module au bloc, appelants et appelés]] — avec [[Glossaire — Graphe d'appels (appelants et appelés)]] ; puis le bloc « Évolution du 07/10 » de [[Fichiers écrits par l'app — chemin choisi par le main, écriture atomique, corbeille]] (faille FR-030)
32. [[Carte de structure ordonnée — ordre de progression, tri par dépendances et disposition alternée]] — relire avant [[Glossaire — Tri topologique de Kahn]] et son bloc « Évolution du 07/10 »
33. [[Sonde sans contenu — télémétrie minimisée, empreintes HMAC et pseudonymes]] — avec [[Glossaire — HMAC (empreinte à clé)]] et [[Glossaire — Pseudonymisation et minimisation des données]] ; d'abord le bloc « Évolution du 07/10 » de [[Du brainstorm au code — spécifications et constitution]] (comment la spec est née)
34. [[Analyste en lecture seule — moindre privilège et propositions vérifiées]] — avec [[Glossaire — Principe du moindre privilège]]
35. [[Mise à jour réversible — worktree, branche, fusion no-ff et git revert]] — puis [[Glossaire — Versionnage sémantique (MAJOR.MINOR.PATCH)]] (les amendements 4.2.0 et 4.2.1 qui l'autorisent)
    - *Soir du 07/10* : relire le bloc « Évolution du 07/10 (soir) » de la note 33 (ce qui est **codé**), avec [[Glossaire — Union discriminée et catalogue fermé]], [[Glossaire — File et écriture par lots (batching)]] et [[Glossaire — Préoccupation transverse (point unique et tee)]].
36. [[Vue Architecture — règle de dépendance, couches déduites et deux dispositions pures]] — branche de la note 32 ; relire d'abord le bloc « Évolution du 07/10 (soir) » de [[Carte de structure ordonnée — ordre de progression, tri par dépendances et disposition alternée]] et celui de [[Clean Architecture — domaine, application, infrastructure]]
37. [[Avancement vivant — agrégation récursive, outil dédié et consigne au bon endroit]] — avec le bloc « post-ordre » de [[Glossaire — Parcours en profondeur (DFS)]]
38. [[Consigne pour un agent outillé — dire ce qui ne change pas, nommer l'outil et l'anti-outil]] — puis [[Glossaire — Information sans la couleur seule (accessibilité)]] pour les nœuds de la carte

> 🔁 **Répétition espacée** : notes 9 à 11 denses → **revoir dans 2 jours**, en refaisant les « Rappel actif » sans regarder les réponses. Notes 16 et 18 (algorithmes) → **revoir dans 2 jours** aussi : refais à la main le calcul d'orientation sur 4 points, et déroule une annulation avec conflit. Note 19 → **revoir dans 2 jours** : récite les cinq barrières et ce que chacune coupe, sans regarder le tableau. Notes 21 à 23 → **revoir dans 2 jours** : dessine de mémoire le trajet d'une donnée idée → widget → cadre résultat en nommant, à chaque frontière, **qui décide** ; puis explique pourquoi l'appel à Claude est **hors** de la transaction d'éclosion. Notes 24 à 29 → **revoir dans 2 jours** : dessine de mémoire les quatre processus (Claude Code, relais, main, renderer) et le trajet d'une demande de permission, avec les trois délais ; puis déroule à la main le DFS gris/noir sur A→B→C→A ; enfin, cite les trois règles pour lancer un programme. Notes 30 et 31 → **revoir dans 2 jours** : sans regarder, liste l'ordre de l'entrée du guide (et ce qui est compté quand ça déborde), déroule `checkSource` sur trois sources (un fichier, un `fichier#symbole` inventé, une clé de module) ; puis dessine deux dossiers, trois fonctions et leurs appels, et trace la flèche agrégée que montre la carte. Notes 32 à 35 → **revoir dans 2 jours** : ordonne à la main 4 frères avec 3 dépendances (dont un cycle) et numérote-les ; explique à voix haute pourquoi `sha256("oui")` n'est pas secret et `HMAC(clé, "oui")` l'est ; dessine le graphe git d'une fusion `--no-ff` puis de son `revert -m 1`, en nommant le parent 1. Notes 36 à 38 → **revoir dans 2 jours** : classe à la main 5 dossiers d'un projet C# en couches Clean et trace les « sens interdits » ; calcule l'avancement d'un module à 3 niveaux ; réécris une consigne qui ajoute un champ « priorité » en disant ce qui ne change pas et quel outil ne pas utiliser.

## Questions de révision globale
> **Q :** Suis une réponse de l'utilisateur, de son clic jusqu'au disque puis jusqu'à Claude : quelles barrières traverse-t-elle ?
> **R :** Preload (canal en liste blanche) → main (expéditeur de confiance, Zod) → `GrowthService` (transaction SQLite chiffrée, `UNIQUE` anti-doublon, événement immédiat) → `AIGateway` (routage, budget, anonymisation, cadre figé + données balisées, sémaphore) → réponse validée par Zod → garde-fous déterministes (doublons, profondeur, plancher de jauge).

> **Q :** Donne trois endroits où « l'IA propose, le code garantit ».
> **R :** Au moins 3 extensions et plancher de jauge (`guards.ts`) ; contrôles P1–P6 du plan (`planChecks.ts`, `provenance.ts`) ; alias inconnus et empreintes de liens filtrés (`links.ts`).

> **Q :** Pourquoi les montants sont-ils en **entiers** partout (centimes, millicentimes) ?
> **R :** Les flottants binaires ne représentent pas exactement les décimales ; les entiers évitent toute dérive dans les sommes (budget) et les comparaisons (provenance).

> **Q :** Quelle est la différence entre une barrière *déterministe* et une consigne dans le prompt ?
> **R :** Le code applique toujours la barrière et se teste ; le LLM peut ignorer une consigne. Les règles critiques sont donc codées, le prompt ne fait que guider.

> **Q :** Tu confirmes une éclosion, puis tu cliques « Annuler » dans la notification : que se passe-t-il de l'écran jusqu'au disque, et retour ?
> **R :** `history:undo` (canal de la fenêtre principale, Zod) → `HistoryService` : transaction, contrôle état actuel = « après » du lot, restauration des « avant » en ordre inverse, lot inverse écrit → retour OK → l'interface invalide `canvas`, `dive`, `synthesis`, `history`, `pending` → TanStack Query relit ce qui est affiché ; l'idée revient dans l'incubateur.

> **Q :** Claude génère un widget qui contient `fetch('https://…')` et `parent.document`. Suis ce code de la réponse de Claude jusqu'à l'échec de ces deux lignes.
> **R :** Réponse validée par Zod (`WidgetOut`) → types effacés (`stripTypeScriptTypes`) → version N+1 + pointeur dans une transaction → l'iframe demande `gi-widget://widget/<bloc>/<version>` → le main sert le document avec la CSP en en-tête et en `<meta>` → `fetch` : refusé par `default-src 'none'` (et, à défaut, annulé par le filtre `webRequest`) ; `parent.document` : `SecurityError`, le cadre a une origine opaque (`sandbox` sans `allow-same-origin`).

> **Q :** Donne trois endroits du projet où l'on **marque** au lieu d'effacer, et ce que ça permet.
> **R :** `canvas_blocks.deleted_at` (note ou widget supprimé → annulable) ; `neurons.absorbed_in` (sous-neurones rangés à l'éclosion → synthèse suivante toujours sourcée) ; versions de widget jamais modifiées + `current_version_id` (retour à une version précédente).

> **Q :** Tu branches une idée sur un widget, tu l'autorises, puis Claude le fait évoluer. Le widget émet ensuite `{ html: "<script>…" }`. Suis la donnée dans les deux sens.
> **R :** Entrée : la nouvelle version a une autre empreinte → `widgetIo:inputs` renvoie `[]`, bandeau « À revoir » jusqu'à ta nouvelle autorisation. Sortie : `gi.output` → `postMessage` (reconnu par `event.source`) → throttle 500 ms → `widgetIo:emit` → `checkResult` (JSON, 200 Ko, 8 niveaux) → `widget_results` → cadre résultat, qui l'affiche par `textContent` : le script reste du texte.

> **Q :** Donne trois « doubles verrous » (consigne + code) ajoutés le 30/09.
> **R :** Pas d'idée suggérée avant 3 réponses (`suggestionsAllowed`) ; pas d'outil déjà branché reproposé (`keepNewTools`) ; champ `tools` obligatoire dans le contrat mais tolérant au parseur (`.catch([])`).

> **Q :** Claude, dans le chat d'une étape, veut corriger un fichier du projet lié. Suis la demande jusqu'au disque.
> **R :** `tool_use` Edit → Claude Code appelle `permission_demander` (pont MCP : relais → canal nommé, secret vérifié) → `PermissionService` : règle « Toujours » du projet ? sinon promesse en attente + carte dans le chat → mentalyas autorise → `allow` → Claude Code écrit → `tool_result` dans le flux → le fil affiche « fait ». Sans réponse en 30 min ou chat fermé : `deny`.

> **Q :** Donne trois endroits où l'app consent à un **contenu précis** plutôt qu'à un nom.
> **R :** Empreinte d'un widget (code + entrées) ; script npm approuvé **avec son texte** ; règle de commande « Toujours » au **texte exact**.

> **Q :** Qu'ont en commun `--setting-sources ""`, `resolveGit()` et `realpath` ?
> **R :** Tous trois empêchent un **dossier de projet non fiable** d'agir à notre place : hooks cachés, `git.exe` piégé dans le dossier courant, lien symbolique vers ailleurs.

> **Q :** Projet repris « Local uniquement ». Suis une demande de guide de reprise de l'onglet jusqu'au document, en nommant chaque barrière.
> **R :** `reprise:guide` (IPC, Zod) → `GuideService` : projet analysé ? pas déjà en cours ? → entrée bornée (graphe + README/manifestes lus sous la racine réelle, jamais sensibles) → `AIGateway` : `localOnly` → Ollama ou `AI_UNAVAILABLE`, jamais Claude → réponse validée par Zod (9 sections) → `checkSource` retire les sources inventées → document du **profil** (jamais le dossier du projet, FR-030), nouvelle version + lot annulable → `reprise:changed` → l'onglet relit.

> **Q :** Donne deux endroits où l'app **dit sa propre limite** au lieu de la cacher.
> **R :** Les chemins omis comptés dans l'entrée du guide (« … N chemins omis ») ; la ligne d'appel du volet de code, **approchée** et écrite comme telle dans D16 ; (et le bandeau « rédigé par le modèle local, qualité moindre »).

> **Q :** L'Analyste propose de corriger `canvas/buildGraph.ts`. Suis la proposition de l'observation jusqu'à son annulation, en nommant **qui décide** à chaque étape.
> **R :** La sonde garde `error.renderer TypeError` sans message (catalogue fermé) → agrégat `obs:err:3` dans le dossier → Claude (Read / Glob / Grep seulement) cite la clé et le fichier → **le code** revérifie (clé envoyée, fichier dans le dépôt) → **mentalyas** accepte → worktree + branche `analyste/…`, Claude code, **commandes demandées** → **l'app** commite et lance les 4 vérifications → **mentalyas** garde (fusion `--no-ff`, sans push) → plus tard **mentalyas** annule (`revert -m 1`, nouveau commit).

> **Q :** Donne trois endroits où le projet retire une **capacité** plutôt que d'écrire une consigne.
> **R :** Renderer sans Node (Electron) ; iframe des widgets sans `allow-same-origin` ; tâche `analyste` sans outil d'écriture ni de commande (`--tools "Read Glob Grep"`).

> **Q :** Une erreur `TypeError` éclate dans l'interface pendant que tu tapes « Acheter du pain ». Suis-la jusqu'au disque : qu'est-ce qui est gardé, et où chaque filtre agit-il ?
> **R :** `listenToErrors` → `probeError` : nom (`TypeError`) + cadres `src/renderer/src/…:ligne`, **jamais** le message → file de l'interface (2 s / 100) → `analyste:events` (dispatcher : Zod, canal mesuré sauf `analyste:*`) → `ProbeService.recordRenderer` : chaque événement revalidé par l'union discriminée `.strict()` → file du main → une transaction toutes les 2 s → `observations`. Le texte n'a jamais quitté le champ de saisie.

> **Q :** Donne trois endroits de la carte de structure où l'app **calcule** au lieu de demander à Claude.
> **R :** Le contenu doc / code d'un nœud (`contentOf`) ; la couche « déduite » quand Claude n'en donne pas (`inferLayer`) ; l'avancement des parents (`progressOf`).

> **Q :** Claude et mentalyas ne sont pas d'accord sur la couche d'un élément. Qui gagne, comment le code le sait-il, et comment revenir en arrière ?
> **R :** Mentalyas : la valeur porte `layerSource = 'user'` et `StructureService` la garde (`keepUser`) à chaque recartographie ; sa correction est un lot `structure` de l'Historique, donc annulable.

## Ressources complémentaires
- Cadrage : `docs/FOUNDATION.md` (§0 amendements Brainstormer prioritaires), `docs/brainstorm/L1-…L4c-*.md`, `.specify/memory/constitution.md` (v1.1.0)
- Specs : `specs/001-moteur-ia-hybride/`, `specs/002-structuration-ia/`, `specs/003-interface-mvp1/` (spec, plan, research, data-model, contracts, tasks, analysis-report)
- Sécurité : `docs/SECURITY-REVIEW-001.md` (constats F1–F5)
- Journal : `docs/JOURNAL.md` — table « Règles apprises » (23 règles citées dans les notes par leur numéro)
- Code clé : `src/main/index.ts`, `src/main/bootstrap.ts`, `src/main/ipc/registry.ts`, `src/main/application/ai/AIGateway.ts`, `src/main/domain/neurons/*.ts`, `src/main/application/neurons/*.ts`
- Graphe : `graphify-out/GRAPH_REPORT.md` (1 214 nœuds, 83 communautés ; nœuds centraux : `GrowthRepository`, `ContextRepository`, `NeuronService`, `AIGateway`)
- *Mise à jour du 29/09* — Graphe : 2 071 nœuds, 140 communautés ; nouveaux nœuds centraux côté interface : `useUiStore` (19 liens), communautés « Croisements de liens », « Plongée — scène & fantômes », « Canaux IPC par fenêtre ». Code clé spec 003 : `src/main/shell/*.ts`, `src/renderer/src/canvas/{forceLayout,crossings}.ts`, `src/renderer/src/dive/{radialLayout,useDive}.ts`, `src/main/application/history/HistoryService.ts`, `src/main/infrastructure/db/repositories/HistoryRepository.ts`, `src/renderer/src/app/{uiStore,useMainEvents,useUndo}.ts`, `src/shared/ai/neurons.ts` (tolérance). Décisions : `specs/003-interface-mvp1/research.md` (R1–R8). 500 tests en fin de session (lus, non exécutés ici).
- *Mise à jour du 30/09* — Graphe : 2 558 nœuds, 177 communautés ; nouvelles communautés « Spec 004 — Boîte à outils de la carte et mini-widgets », « WidgetRepository », « WidgetNode.tsx », hyper-arête « Bac à sable des widgets : isolation en couches gi-widget:// ». Cadrage : `specs/004-widgets/` (spec, plan § Isolation, tasks, quickstart § 4 « Évasion du bac à sable »), `.specify/memory/constitution.md` (v1.2.0), `docs/brainstorm/L4c-widgets.md`. Code clé spec 004 : `src/main/application/widgets/{WidgetDocument,transpile,widgetUrl,WidgetService}.ts`, `src/main/shell/{widgetProtocol,hardening}.ts`, `src/main/infrastructure/ai/WidgetFrame.ts`, `src/main/infrastructure/db/repositories/{WidgetRepository,BlockRepository}.ts`, `src/main/infrastructure/db/migrations/0009…0011` (+ `down/`), `src/renderer/src/canvas/{ToolMenu.tsx,useBlockActions.ts,nodes/WidgetNode.tsx,nodes/LabelNode.tsx}`, `src/shared/ai/widgets.ts`. Tests : `tests/unit/widgets/{widget-document,widget-escape}.test.ts`, `tests/integration/widgets/widgets.test.ts`. 634 tests en fin de session selon le journal (lus, non exécutés ici).
- *Mise à jour du 30/09 (soir)* — Graphe : 3 082 nœuds, 191 communautés ; nouvelles communautés « WidgetIoService », « WidgetIoRepository » (24 liens), « Spec 005 — Widgets branchés », « Spec 006 — Widgets proposés au verrouillage », « tool-hatching.test.ts » ; hyper-arêtes « Pont d'entrées d'un widget » et « Outils à l'éclosion ». Cadrage : `specs/005-widgets-entrees-sorties/` (plan § Pont, § Revue et empreinte, § Signature de structure, § Cadre résultat), `specs/006-widgets-au-verrouillage/` (plan, décisions R1–R8). Code clé : `src/main/application/widgets/{WidgetIoService,InputAssembler,ToolGeneration,toolSurroundings,GenericResultView}.ts`, `src/main/domain/widgets/{shape,resultLimits,placeTools,toolProposals}.ts`, `src/shared/widgets/genericResultView.ts`, `src/renderer/src/widgets/{useWidgetBridge,emitThrottle}.ts`, `src/main/application/neurons/{SynthesisApplier,SynthesisContextBuilder}.ts`, `src/main/domain/neurons/nextStep.ts`, `src/shared/ai/neurons.ts`, migrations `0012…0016` (+ `down/`). 788 tests en fin de session selon le journal (lus, non exécutés ici).
- *Mise à jour du 06/10* — Graphe : 3 907 nœuds, 244 communautés ; nouvelles communautés « Outils MCP de la carte », « Permissions et flux du CLI », « Processus Claude Code », « Plan d'attaque », « Disposition du plan », « Commandes approuvées (spec 013) », « Actions finales et livrables », « Genesis → projet (spec 016) », « Conversion de l'ancien moteur ». Cadrage : `docs/brainstorm/L1c-pont-claude-code.md`, `L2-`/`L3-` (pont MCP, moteur CLI, terminal, neurone conversationnel, carte de structure), `specs/007-…` à `specs/016-…`, `.specify/memory/constitution.md` (3.0.0, 4.0.0 proposée). Code clé : `src/mcp-relay/relay.ts`, `src/main/infrastructure/mcp/{PipeServer,token,endpoint,lineSplitter}.ts`, `src/shared/mcp/{protocol,tools}.ts`, `src/main/infrastructure/claude/{CliConversation,claudePath}.ts`, `src/main/domain/conversation/{streamEvents,permissions}.ts`, `src/main/application/conversation/{ConversationService,PermissionService,LegacyConversion}.ts`, `src/main/infrastructure/ai/ClaudeCliProvider.ts`, `src/main/domain/plan/{dependencies,lock}.ts`, `src/renderer/src/canvas/planLayout.ts`, `src/main/infrastructure/documents/DocumentFiles.ts`, `src/main/domain/documents/fileName.ts`, `src/main/domain/finals/{projectPath,commands,editor}.ts`, `src/main/infrastructure/{finals/CommandRunner,editor/EditorLauncher,projects/GitCli,projects/ProjectFolder,projects/HubRegistry}.ts`, migrations `0017…0027` (+ `down/`). 994 tests en fin de session selon le journal (lus, non exécutés ici).
- *Mise à jour du 07/10* — Graphe : 5 101 nœuds, 317 communautés ; communautés liées : « Agrégation de l'explorateur », « Analyse statique tree-sitter », hyper-arête « Explorateur sur un seul écran (D16) », groupes « Tâche IA reprise_guide », « Faille FR-030 ». Cadrage : `specs/017-reprise-voir/` (spec D16, FR-020 révisée, FR-027 à FR-030, FR-037 ; contracts, data-model), `docs/brainstorm/L1f-reprise-projet.md`. Code clé : `src/main/application/ai/RepriseGuideTask.ts`, `src/main/infrastructure/ai/RepriseGuideFrame.ts`, `src/main/domain/ai/routing.ts`, `src/main/application/reprise/{GuideService,ExplorerService}.ts`, `src/main/domain/reprise/{guideSources,aggregate,layout}.ts`, `src/main/infrastructure/reprise/projectText.ts`, `src/shared/ai/schemas.ts` (`GuideOut`), migration `0029_reprise_guide` (+ `down/`), `src/renderer/src/explorer/{GuidePanel,FilePanel,ExplorerNodes,ExplorerPage}.tsx`, `src/renderer/src/lib/CodeLines.tsx`. 1 175 tests en fin de session selon le journal (lus, non exécutés ici).
- *Mise à jour du 07/10 (après-midi)* — Graphe : 5 260 nœuds, 339 communautés ; nouvelles communautés « L1g — Analyste interne (vision, A1–A9) », « Sonde interne (AN-A) », « Tâche analyste (claude -p, outils Read Glob Grep) », « Worktree et branche analyste/<id8>-<slug> », « R1 — Preuve du refus de lecture hors dépôt », « D17 — Disposition alternée » ; hyper-arêtes « Analyste interne pipeline: observe → analyze → apply », « AI proposes, deterministic code verifies », « Circuit Appliquer ». Cadrage : `docs/brainstorm/L1g-analyste-interne.md`, `L2-analyste-{sonde,analyse,appliquer,rythme}.md`, `L3-analyste-{sonde,analyse,appliquer}.md`, `L4e-analyste.md`, `docs/FOUNDATION.md` §0000, `.specify/memory/constitution.md` (4.2.1), `specs/019-analyste-interne/` (spec, plan, research R1–R12, data-model, contracts, quickstart, tasks, analysis-report). Code clé (D17, livré) : `src/renderer/src/canvas/{structureOrder,structureGraph}.ts`, `src/shared/mcp/tools.ts` (`ordre`). 1 179 tests en fin de session selon le journal (lus, non exécutés ici).
- *Mise à jour du 07/10 (soir)* — Graphe : 5 728 nœuds, 9 634 liens, 347 communautés ; nouvelles communautés « analyste/probe », « analyste/events », « analyste/ProbeService », « analyste/RepoGuard », « D20 Carte de structure : vue Architecture », « D21 avancement vivant », hyper-arête « Évolution de la carte de structure le 07/10 (D18 contenu, D19 statut, D20 Architecture, D21 avancement) ». Code clé (019 US1) : `src/shared/analyste/events.ts`, `src/main/domain/analyste/fingerprint.ts`, `src/main/application/analyste/{RepoGuard,ProbeService}.ts`, `src/main/ipc/{registry,analysteHandlers}.ts`, `src/main/infrastructure/logging/logger.ts` (`teeSink`), `src/main/infrastructure/db/repositories/ObservationRepository.ts`, migration `0030_analyste` (+ `down/`), `src/renderer/src/analyste/probe.ts`, `src/renderer/src/pages/settings/{AnalysteSettings,ObservationsPage}.tsx`. Code clé (017 D18–D21) : `src/main/domain/reprise/content.ts`, `src/main/infrastructure/reprise/ProjectFileIndex.ts`, `src/shared/structure/architecture.ts`, `src/renderer/src/canvas/{structureGraph,progress,buildGraph}.ts`, `src/renderer/src/canvas/nodes/{ElementNode,LayerBandNode,StructureBarNode}.tsx`, `src/main/application/structure/StructureService.ts`, `src/shared/mcp/tools.ts` (`element_avancer`, `MCP_INSTRUCTIONS`), `src/main/application/conversation/frame.ts`, migrations `0031_architecture`, `0032_element_progress` (+ `down/`). Cadrage : `specs/017-reprise-voir/spec.md` (D18–D21, FR-039 à FR-042), `specs/019-analyste-interne/tasks.md` (T002–T016). 1 284 tests en fin de session selon le journal (lus, non exécutés ici).
- 💡 Glisse ces notes dans NotebookLM / Gemini si tu veux un *study guide* ou un quiz audio.
