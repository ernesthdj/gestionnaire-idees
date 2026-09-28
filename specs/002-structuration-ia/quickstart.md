# Quickstart — Vérifier la structuration IA (002)

## Prérequis
- Feature 001 implémentée (moteur IA, base chiffrée, IPC).
- Tests : aucun réseau (FakeProvider scripté avec des sorties fixes).
- Manuel : Ollama + clé Claude de test ; **idées fictives uniquement**.

## Scénarios automatisés
| # | Commande | Prouve | Réf. |
|---|----------|--------|------|
| 1 | `npx vitest run tests/unit/structuring/session-state` | Transitions de la machine à états, limite de 8 questions, abandon | FR-002/005/013 |
| 2 | `npx vitest run tests/unit/structuring/cycles` | Boucles détectées, profondeur > 5 rejetée | FR-007, SC-003 |
| 3 | `npx vitest run tests/unit/structuring/provenance` | 0 montant/date inventé sur 20 questionnaires fixtures ; tâches d'investigation ajoutées | FR-008, SC-002 |
| 4 | `npx vitest run tests/unit/structuring/consistency` | Règles K1–K7 | FR-006/007 |
| 5 | `npx vitest run tests/integration/structuring` | Flux complet idée → proposition `pending`, idée inchangée, reprise après redémarrage simulé, proposition périmée, idempotence des réponses | FR-004/010/011, SC-006/007 |

## Scénarios manuels (`npm run dev`)
1. Créer l'idée « acheter un 2e écran pour le PC » → Structurer → répondre (modèle 27", budget ~250 €, « Non » à l'argent, mission mariage 1 250 € le 15/11) → la proposition contient la condition « argent ? », les deux branches, l'opportunité « mission mariage » liée par « finance » et le déclencheur « au paiement ». (Répéter 10 fois pour SC-001.)
2. Répondre « je ne sais pas » au prix → une tâche « Trouver le prix » apparaît, sans montant.
3. Fermer l'app au milieu du questionnaire → rouvrir → reprise à la même question.
4. Modifier le texte de l'idée pendant le questionnaire → la proposition finale est marquée périmée.
5. Écrire « écris-moi un poème » en réponse → recentrage poli.
6. Couper le réseau → proposition du mode dégradé local, indicateur visible.

## Résultat attendu
Tests verts ; scénarios manuels conformes ; aucune ligne créée dans `nodes`/`dependencies` avant F3.
