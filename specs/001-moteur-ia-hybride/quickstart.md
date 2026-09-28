# Quickstart — Vérifier le moteur IA hybride (001)

## Prérequis
- Node.js LTS, dépendances installées (`npm install`) — voir research.md « Dépendances annoncées ».
- Pour les scénarios manuels : Ollama installé + modèle local retenu (banc R5) téléchargé ; une clé API Claude de test.
- **Aucune donnée réelle** : utiliser uniquement les jeux fictifs de `tests/fixtures/`.

## Scénarios automatisés (sans réseau, moteurs simulés)
| # | Commande | Prouve | Réf. |
|---|----------|--------|------|
| 1 | `npx vitest run tests/unit/ai/routing` | Chaque TaskKind part vers le bon moteur | FR-002, SC-007 |
| 2 | `npx vitest run tests/unit/ai/validation` | 100 % des sorties malformées rejetées, 1 seul nouvel essai | FR-003, SC-001 |
| 3 | `npx vitest run tests/unit/ai/anonymizer` | 0 donnée identifiante sur 50 textes fictifs, repli par règles | FR-006, SC-002 |
| 4 | `npx vitest run tests/unit/ai/budget` | Alerte 80 %, blocage 100 %, déblocage, remise à zéro mensuelle | FR-008/009, SC-005 |
| 5 | `npx vitest run tests/unit/ai/context-import` | Manifeste invalide / empreinte fausse refusés ; apply + rollback | FR-015/016, SC-008 |
| 6 | `npx vitest run tests/integration/ai` | Journal sans contenu ; file et concurrence ; clé jamais en clair (recherche dans le dossier de données de test) | FR-007/010/018, SC-006 |

## Scénarios manuels (app lancée : `npm run dev`)
1. **Réglages › IA** : Ollama arrêté → message d'installation guidé ; démarrer Ollama → « Revérifier » passe au vert.
2. Coller la clé de test → affichage masqué ; redémarrer → toujours masquée ; « Tester Claude » → OK + latence.
3. Mettre le plafond à 0,05 € → lancer 2-3 demandes Claude de test → alerte puis blocage ; « Débloquer ce mois » → reprise.
4. Déposer un jeu de contexte d'exemple (`tests/fixtures/context-inbox-valid/`) dans l'inbox → notification → aperçu → Appliquer → version active v2 ; Restaurer v1.
5. Déposer `tests/fixtures/context-inbox-tampered/` → refusé avec motif « empreinte ».

## Résultat attendu
Tous les tests verts ; les 5 scénarios manuels conformes ; aucun contenu d'idée dans `ai_calls`.
