# Feature Specification: Bascule — un seul moteur, plus d'API Anthropic (lot C + F11)

**Feature Branch**: `010-bascule` · **Created**: 2026-10-04 · **Status**: Décisions validées par mentalyas (2026-10-04) — plan à valider

**Input**: amélioration n° 2 de la revue du 04/10 — « deux moteurs cohabitent ; la synthèse et la génération de widgets
appellent encore l'API Anthropic » ; L1c n° 3, 5, 7 ; L1d n° 19.

## Décisions (2026-10-04)
| # | Sujet | Décision |
|---|-------|----------|
| D1 | Anciennes données | **Convertir puis garder en archive** : chaque idée devient un genesis dont la fiche reprend ses réponses et son document ; les anciennes tables restent en base, inutilisées, supprimées plus tard par une migration dédiée après vérification par mentalyas. |
| D2 | Suggestions de liens et graines | **Retirées** ; elles reviendront comme tâche de fond d'Ollama dans un lot ultérieur. |
| D3 | Modèles par défaut | **Opus pour les genesis, Sonnet pour les éléments de projet et la génération de widgets** ; modifiables dans Réglages et par conversation. |

## User Scenarios & Testing

### US1 — Plus aucune clé API (P1)
Toute l'IA de l'app passe par Claude Code (`claude -p`, abonnement) ou par Ollama. La génération d'un widget depuis son
cadre passe par `claude -p` (format imposé, même validation qu'avant). Réglages › IA ne montre plus ni clé ni budget en
euros : l'état de Claude Code (introuvable / non connecté / prêt), Ollama, les modèles par usage.
**Test** : retirer la clé API des Réglages (ou ne jamais en avoir) → générer un widget, converser, cartographier : tout marche.

### US2 — Un seul moteur de neurones (P1)
Ouvrir une idée, quelle qu'elle soit, ouvre sa conversation. L'ancien panneau (questions, jauge, verrouillage, éclosion,
document, prochaine étape, outils proposés, graines, liens suggérés) disparaît.
**Test** : aucune entrée de menu ni écran de l'ancien moteur ; aucune question générée par Ollama.

### US3 — Les anciennes idées ne perdent rien (P1)
Au premier démarrage de la nouvelle version, chaque idée existante reçoit une fiche assemblée localement (sans IA) à
partir de ses réponses, de son document d'éclosion (synthèse, plan, décisions) et de sa prochaine étape. Une seule fois.
**Test** : une idée éclose de l'ancien moteur → sa conversation s'ouvre avec une fiche qui reprend son document.

### US4 — Choisir le modèle (P2)
Réglages › IA : modèle des genesis, des éléments, des widgets. Dans le chat : changer le modèle de cette conversation.
**Test** : passer un élément en Opus depuis son chat → l'échange suivant utilise Opus (visible dans la consommation).

## Requirements
- **FR-001** Retirer `@anthropic-ai/sdk`, `ClaudeProvider`, la recherche web serveur, `BudgetGuard`, le calcul de coût,
  l'anonymisation (`Anonymizer`, règles, tâche `anonymiser`), le cadre `out_of_scope`, les canaux `ai:setClaudeKey`,
  `ai:clearClaudeKey`, `ai:unlockBudget`, l'événement `ai:budgetAlert` ; supprimer le secret de la clé au démarrage.
- **FR-002** Fournisseur `ClaudeCliProvider` (`claude -p --output-format json --json-schema … --tools "" --setting-sources ""
  --strict-mcp-config --no-session-persistence`) derrière la passerelle pour les tâches restantes (widget) ; données par stdin.
- **FR-003** Retirer l'ancien moteur : croissance, extensions, suggestions, synthèse / éclosion / absorption, document,
  prochaine étape, outils proposés (spec 006), graines, liens suggérés, panneau de plongée, et leurs canaux IPC.
- **FR-004** Conversion unique et idempotente (marqueur en réglages) des idées en genesis avec fiche.
- **FR-005** Anciennes tables conservées (aucune perte), plus lues par l'app sauf l'Historique.
- **FR-006** Modèle par usage (genesis, élément, widget) et par conversation.
- **FR-007** Profil démo réécrit pour le nouveau modèle (genesis avec fiches fictives, une carte de structure fictive).
- **FR-008** Constitution amendée (budget en euros, anonymisation, cadre de l'IA, `@anthropic-ai/sdk` retirés des principes).

## Success Criteria
- **SC-001** Aucun appel à l'API Anthropic possible (dépendance absente du `package.json`).
- **SC-002** Au moins 4 000 lignes de code retirées, tests verts.
- **SC-003** 100 % des idées existantes converties avec une fiche non vide quand elles avaient des réponses ou un document.
