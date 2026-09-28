# Quickstart — Vérifier le moteur de neurones (002 v2)

## Prérequis
Feature 001 (AIGateway avec cadre v2, base chiffrée, IPC). Tests sans réseau (FakeProvider scripté).
Manuel : Ollama + clé Claude de test ; **neurones fictifs uniquement**.

## Scénarios automatisés
| # | Commande | Prouve | Réf. |
|---|----------|--------|------|
| 1 | `npx vitest run tests/unit/neurons/growth` | ≥ 3 extensions au démarrage (retry + repli), doublons retirés, profondeur 6, 1 sous-neurone par extension, cascade de suppression | FR-003–007, SC-001 |
| 2 | `npx vitest run tests/unit/neurons/gauge` | Plancher 3 réponses, niveaux, manques | FR-008/009 |
| 3 | `npx vitest run tests/unit/neurons/plan-checks` | P1–P5 (refs, branches, profondeur, boucles) | FR-011 |
| 4 | `npx vitest run tests/unit/neurons/provenance` | 0 valeur inventée sur 20 arbres fixtures | FR-016, SC-003 |
| 5 | `npx vitest run tests/integration/neurons` | Création → développement → réponses → verrouillage (normal/forcé) → confirmation tout-ou-rien (erreur injectée) → éclosion ; périmée ; correction ; réouverture ; persistance après redémarrage simulé ; liens suggérés/acceptés/refusés | FR-010–018, SC-005/006 |

## Scénarios manuels
1. Neurone Action « acheter un 2e écran pour le PC » → développer → répondre (27", ~250 €, « Non » à l'argent, mission mariage 1 250 € le 15/11) → jauge « suffisant » → verrouiller → plan avec condition « argent ? » et ses 2 branches, opportunité et déclencheur → confirmer (×10 pour SC-002).
2. Neurone Réflexion « concept de mon portfolio photo » → développer → questions d'exploration (public, style, critères) → verrouiller → synthèse (pistes, décisions, pour/contre, questions ouvertes).
3. Faire éclore « Mission mariage » puis « 2e écran » → suggestion de lien « financement » (×10 pour SC-007).
4. Demander « écris-moi le poème » dans un neurone → refus de produire + extensions pour y réfléchir.
5. Couper le réseau → ajout de branches possible, extensions IA en attente, message clair.
