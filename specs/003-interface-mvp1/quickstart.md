# Quickstart — Vérifier l'interface MVP-1 (003)

## Prérequis
Features 001 et 002 implémentées ; dépendances de research.md validées et installées ; données **fictives** uniquement.

## Scénarios automatisés
| # | Commande | Prouve | Réf. |
|---|----------|--------|------|
| 1 | `npx vitest run tests/unit/tree/statuses` | Propagation bloquée/prête, branches inactives, déclencheurs | FR-022–024, SC-007 |
| 2 | `npx vitest run tests/integration/review/apply` | Acceptation tout-ou-rien (erreur injectée → aucune donnée modifiée), sélection/éditions, `STALE`, `DEPENDENCY_EXCLUDED` | FR-013/014/017, SC-004 |
| 3 | `npx vitest run tests/integration/history/undo` | Annulation exacte, conflit détecté après édition manuelle | FR-018, SC-005 |
| 4 | `npx vitest run tests/integration/capture` | Idée conservée IA arrêtée, catégorie rejouée, choix utilisateur jamais écrasé | FR-009/010, SC-002 |
| 5 | `npx vitest run tests/unit/renderer` | Composants : clavier complet, rôles/labels, axe sans violation (clair et sombre) | FR-005, SC-008 |

## Scénarios manuels (`npm run dev`, puis build installé pour le démarrage Windows)
1. Depuis VS Code, un navigateur et l'Explorateur : `Ctrl+Alt+Espace` → taper → `Entrée` → la fenêtre disparaît, le focus revient (chronométrer : < 5 s).
2. Arrêter Ollama → capturer 3 idées → « À classer » ; relancer Ollama → catégories appliquées.
3. Structurer l'idée « 2e écran » (002) → À valider (badge) → décocher « Épargner », corriger un montant → Accepter → organigramme à jour → « Annuler » dans les 10 s → état initial.
4. Organigramme : choisir « Non » à « J'ai l'argent ? », marquer « Mission payée » atteint → « Réserver X € » passe à prête ; « Oui » grisé.
5. Générer 50 idées / 300 nœuds fictifs (`npm run seed:demo`) → zoom/déplacement fluides.
6. Installer le build, activer « Démarrer avec Windows », redémarrer la session → icône présente, aucune fenêtre ouverte.
7. Prendre le raccourci avec une autre app → message et choix d'un autre raccourci.
8. Parcours de premier lancement avec un profil de données vierge.
