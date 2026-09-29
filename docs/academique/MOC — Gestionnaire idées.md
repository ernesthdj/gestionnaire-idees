---
type: MOC
subject: Gestionnaire_idées — le Brainstormer (session inaugurale du 2026-09-28 : specs 001 et 002 ; session du soir 28→29/09 : spec 003 interface)
tags: [#MOC, #electron, #ia, #neurones, #securite, #ui]
date: 2026-09-29
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
    A --> B
    I --> J
    B --> O
    L --> R
```

> 🆕 **Session du 28→29/09 (spec 003)** : l'app devient **visible et utilisable** — icône de notification, capture rapide au raccourci, carte des idées sans croisements, plongée en couronne, aperçu éditable, éclosion animée, historique avec « Annuler ». Nouvelles notes : 4 concepts, 1 pont, 2 glossaires ; blocs « Évolution du 29/09 » ajoutés dans 4 notes existantes (Electron, Éclosion, Liens, Zod).

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

> 🔁 **Répétition espacée** : notes 9 à 11 denses → **revoir dans 2 jours**, en refaisant les « Rappel actif » sans regarder les réponses. Notes 16 et 18 (algorithmes) → **revoir dans 2 jours** aussi : refais à la main le calcul d'orientation sur 4 points, et déroule une annulation avec conflit.

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

## Ressources complémentaires
- Cadrage : `docs/FOUNDATION.md` (§0 amendements Brainstormer prioritaires), `docs/brainstorm/L1-…L4c-*.md`, `.specify/memory/constitution.md` (v1.1.0)
- Specs : `specs/001-moteur-ia-hybride/`, `specs/002-structuration-ia/`, `specs/003-interface-mvp1/` (spec, plan, research, data-model, contracts, tasks, analysis-report)
- Sécurité : `docs/SECURITY-REVIEW-001.md` (constats F1–F5)
- Journal : `docs/JOURNAL.md` — table « Règles apprises » (23 règles citées dans les notes par leur numéro)
- Code clé : `src/main/index.ts`, `src/main/bootstrap.ts`, `src/main/ipc/registry.ts`, `src/main/application/ai/AIGateway.ts`, `src/main/domain/neurons/*.ts`, `src/main/application/neurons/*.ts`
- Graphe : `graphify-out/GRAPH_REPORT.md` (1 214 nœuds, 83 communautés ; nœuds centraux : `GrowthRepository`, `ContextRepository`, `NeuronService`, `AIGateway`)
- *Mise à jour du 29/09* — Graphe : 2 071 nœuds, 140 communautés ; nouveaux nœuds centraux côté interface : `useUiStore` (19 liens), communautés « Croisements de liens », « Plongée — scène & fantômes », « Canaux IPC par fenêtre ». Code clé spec 003 : `src/main/shell/*.ts`, `src/renderer/src/canvas/{forceLayout,crossings}.ts`, `src/renderer/src/dive/{radialLayout,useDive}.ts`, `src/main/application/history/HistoryService.ts`, `src/main/infrastructure/db/repositories/HistoryRepository.ts`, `src/renderer/src/app/{uiStore,useMainEvents,useUndo}.ts`, `src/shared/ai/neurons.ts` (tolérance). Décisions : `specs/003-interface-mvp1/research.md` (R1–R8). 500 tests en fin de session (lus, non exécutés ici).
- 💡 Glisse ces notes dans NotebookLM / Gemini si tu veux un *study guide* ou un quiz audio.
