# Quickstart — Vérifier l'interface MVP-1 « Brainstormer » (003 v2)

## Prérequis
Features 001 et 002 implémentées ; dépendances de research.md validées et installées ; données **fictives**.

## Scénarios automatisés
| # | Commande | Prouve | Réf. |
|---|----------|--------|------|
| 1 | `npx vitest run tests/unit/ui/layout` | Radial (plongée) et contraintes de zones (force) : aucun chevauchement, bruts à gauche, éclos à droite | FR-009/013 |
| 2 | `npx vitest run tests/unit/ui/motion` | Préférence réduite (système OU réglage) → durées 0 / fondus ≤ 150 ms, dérive coupée | FR-012/025, SC-006 |
| 3 | `npx vitest run tests/unit/markdown` | Export : arbre, plan (cases, conditions, dépendances), synthèse, liens ; nom de fichier assaini | FR-022, SC-007 |
| 4 | `npx vitest run tests/integration/history` | Annulation d'une fusion exacte ; conflit après réouverture + nouvelles réponses | FR-024, SC-008 |
| 5 | `npx vitest run tests/integration/capture` | Neurone créé sans IA ; nature/catégorie appliquées ensuite ; choix utilisateur jamais écrasé | FR-008 |
| 6 | `npx vitest run tests/unit/renderer` | Composants : clavier complet, axe-core sans violation en clair et sombre (canvas, plongée, aperçu, À valider, réglages) | FR-005, SC-005 |

## Scénarios manuels (`npm run dev`)
1. Capture depuis VS Code / navigateur / Explorateur → neurone brut dans l'incubateur ; focus rendu (< 5 s).
2. Plonger dans « 2e écran » → ≥ 3 extensions → répondre à 3 (dont « Non » à l'argent + mission mariage) → jauge « suffisant » → Verrouiller → aperçu plan → corriger un montant → Confirmer → **fusion + migration** vers le réseau → « Annuler » dans les 10 s → retour exact.
3. Neurone Réflexion « concept portfolio » → synthèse structurée → éclore → exporter en Markdown → ouvrir dans VS Code / Obsidian.
4. Suggestion de lien « financement » entre « Mission mariage » et « 2e écran » → accepter depuis le réseau, refuser une autre depuis À valider.
5. Windows « Afficher les animations » désactivé → aucune animation de mouvement ; idem avec le réglage de l'app.
6. Générer 100 neurones / 50 liens fictifs (`npm run seed:demo`) → fluidité (déplacement, zoom, dérive).
7. Build installé + démarrage avec Windows → icône présente, aucune fenêtre ouverte.

## Chronométrage
SC-002 (idée simple → éclosion < 3 min, sans aide) : 3 essais, consignés dans § Résultats.
