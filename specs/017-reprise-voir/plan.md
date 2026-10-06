# Implementation Plan: Reprise — Voir (spec 017)

**Branch**: `main` (spec `017-reprise-voir`) | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

## Summary

Faire entrer dans l'app un projet écrit par d'autres (dossier choisi ou `git clone` avec le git de mentalyas), avec un
niveau de confidentialité choisi à l'import et gardé par une seule garde ; l'analyser **sans l'exécuter** dans un
processus séparé (`@vscode/tree-sitter-wasm` : TypeScript / JavaScript, C#, PHP / Laravel) en un graphe de modules,
fichiers, symboles et liens dont chaque lien dit sa fiabilité ; le parcourir dans un **explorateur** à 4 niveaux
(React Flow, agrégation dans le main) ; produire un **guide de reprise** pour dev junior (analogies, sources
vérifiées) comme document du genesis. Claude ou, en « Local uniquement », Ollama lèvent les ambiguïtés et rédigent le
guide, par l'`AIGateway`.

## Technical Context

**Language/Version**: TypeScript 5 strict
**Primary Dependencies**: Electron (`utilityProcess`), React, React Flow, Zod, Drizzle ; **nouvelle** :
`@vscode/tree-sitter-wasm` 0.3.1 (MIT, Microsoft, sans dépendance ni script d'installation — research R1) ; git de
mentalyas (résolu par chemin absolu, spec 016) ; Claude Code (`claude -p`) / Ollama via `AIGateway`
**Storage**: migration `0028_reprise_projet` (+ down) — 10 tables `code_*` (data-model.md) ; guide = document du
genesis (spec 012)
**Testing**: Vitest — purs (URL, exclusions, résolution, catégories, agrégation, mise en page), intégration (analyse
réelle des 3 projets fixtures + projet piégé, import, clone simulé, garde de confidentialité de bout en bout),
renderer + axe (assistant d'import, explorateur, vue liste)
**Target Platform**: Windows 11
**Performance Goals**: 5 000 fichiers analysés < 2 min ; réanalyse d'un fichier < 10 s ; changement de niveau < 1 s
(SC-004, SC-005)
**Constraints**: rien du projet exécuté ; aucun chemin venu de l'interface ; fichiers sensibles jamais lus ; projet
« Local uniquement » → 0 envoi à Claude ; ≤ 150 nœuds affichés
**Scale/Scope**: ~25 fichiers main / shared / worker, ~10 renderer, 3 projets fixtures

## Constitution Check (4.1.0 — amendement D8 validé, ratifié en T001)

| Principe | Vérification | Statut |
|---|---|---|
| I Sécurité | git par chemin absolu, sans shell, arguments fixes, protocoles https/ssh seuls, sans hook ni sous-module (4.1.0) ; chemins du sélecteur natif ou `previewId` ; dossier de données refusé ; liens symboliques non suivis ; secrets jamais lus ; identifiants retirés des URL ; IPC Zod ; extrait de code rendu en texte ; logs sans code ni chemin complet | ✅ |
| II Humain dans la boucle | Confidentialité choisie explicitement (pas de défaut) ; local → claude confirmé ; corrections de mentalyas prioritaires ; rien écrit dans le projet | ✅ |
| III IA cadrée | Deux tâches `AIGateway` sans outils, sorties Zod fermées (identifiants parmi les candidats, sources vérifiées) ; code du projet = donnée délimitée | ✅ |
| IV Local d'abord | Analyse 100 % locale ; « Local uniquement » → Ollama remplace Claude (4.1.0) ; garde unique testée de bout en bout | ✅ |
| V Tests | Logique pure testée (résolution, catégories, agrégation, URL, exclusions), fixtures fictives, aucun service réel | ✅ |
| VI Simplicité | Une dépendance ; React Flow réutilisé (plan B WebGL seulement si mesure ratée) ; documents (spec 012) et git (spec 016) réutilisés | ✅ |

## Project Structure

```text
src/shared/ipc/reprise.ts                          vues et contrats (import, explorateur, progression)
src/shared/reprise/gitUrl.ts                       contrôle et nettoyage d'URL (pur)
src/main/domain/reprise/                           pur : exclusions + secrets, modules, résolution TS / C# / PHP,
                                                   catégories, agrégation par niveau, mise en page en colonnes
src/main/application/reprise/RepriseService.ts     aperçu, création du genesis, confidentialité
src/main/application/reprise/ConfidentialityGuard.ts
src/main/application/reprise/CloneService.ts       clone (progression, annulation, nettoyage)
src/main/application/reprise/AnalysisService.ts    pilote du processus d'analyse, écriture du graphe, overrides
src/main/application/reprise/ExplorerService.ts    vues agrégées, détail, extrait, recherche, positions
src/main/application/reprise/GuideService.ts       guide (tâche IA, sources vérifiées, document du genesis)
src/main/application/ai/…                          tâches reprise_resolution, reprise_guide ; routage local forcé
src/analysis-worker/worker.ts                      utilityProcess : tree-sitter + requêtes .scm par langage
src/main/infrastructure/db/…                       migration 0028, ReprisesRepository / CodeGraphRepository
src/main/ipc/repriseHandlers.ts, explorerHandlers.ts
src/renderer/src/reprise/ImportWizard.tsx          source → aperçu → confidentialité
src/renderer/src/explorer/ExplorerPage.tsx         carte 62 % + panneau 38 %, fil d'Ariane, filtres, vue liste
src/renderer/src/explorer/NodePanel.tsx, CodeExcerpt.tsx, ExplorerList.tsx
tests/fixtures/reprise/{ts-app, cs-app, laravel-app, hostile-app}
electron.vite.config.ts                            3e point d'entrée main : analysis-worker ; copie des 6 .wasm
```

## Lots
1. **Socle (US1)** : constitution 4.1.0 ; dépendance ; migration 0028 ; exclusions + secrets ; aperçu, création du
   genesis, confidentialité + garde (conversation refusée en local) ; assistant d'import (dossier). Test guidé.
2. **Analyse (US3)** : processus d'analyse, requêtes par langage, modules, résolution TS / C# / PHP, catégories,
   points d'entrée, incrémental, overrides, progression ; fixtures. Tests sur les 3 projets + piégé.
3. **Explorateur (US2)** : agrégation, mise en page, IPC, page plein écran, panneau, extrait, filtres, recherche, vue
   liste, positions. Test guidé.
4. **Guide (US4)** : tâche `reprise_guide`, vérification des sources, document du genesis, résumés-analogies des
   modules dans l'explorateur. Test guidé.
5. **Clone (US5)** : URL, `CloneService`, progression, annulation, nettoyage, reprise au démarrage. Test guidé.
6. **Ambiguïtés (US6)** : tâche `reprise_resolution`, lots, validation, liens « déduits ». Test guidé.
7. **Finitions** : démo (`seed:demo` avec un projet repris fictif), FOUNDATION, CLAUDE.md, JOURNAL ; mesure SC-004 /
   SC-005.

## Complexity Tracking
| Écart | Pourquoi | Alternative plus simple écartée |
|---|---|---|
| Processus d'analyse séparé (`utilityProcess`) | Un WASM qui plante ou boucle ne doit emporter ni le main ni l'interface ; fluidité pendant 2 min d'analyse | Fil principal : gel de l'app ; `worker_threads` : même processus |
| 10 tables `code_*` | Graphe interrogé par niveau (agrégation SQL indexée), corrections conservées, réanalyse incrémentale | Un JSON par projet : agrégation en mémoire de 50 000 liens à chaque zoom |
| Résolution par langage (3 jeux de règles) | Exigence produit (D2) ; la fiabilité des liens en dépend (SC-006) | Tout confier à Claude : impossible en « Local uniquement », coûteux, non vérifiable |
