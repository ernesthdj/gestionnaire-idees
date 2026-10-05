# Implementation Plan: Bascule (lot C + F11)

## Ordre (trois sous-lots, chacun testable)
1. **C1 — Moteur CLI et réglages** : `ClaudeCliProvider` (structured output via `--json-schema`, schéma tiré du Zod de la tâche
   par `z.toJSONSchema`) ; la passerelle route `widget` vers lui ; retrait du SDK, de `ClaudeProvider`, de la recherche web,
   du budget, de l'anonymisation, du cadre ; Réglages › IA refait (état Claude Code, Ollama, modèles par usage) ;
   `ConversationService` prend le modèle selon l'usage (genesis / élément) et la surcharge de la conversation.
2. **C2 — Conversion et retrait de l'ancien moteur** : migration de données au démarrage (fiche assemblée localement) ;
   suppression des services, dépôts, canaux et écrans de l'ancien moteur (croissance, fusion, document, étapes, graines,
   liens suggérés, outils de la spec 006, plongée) ; la carte n'affiche plus que genesis, éléments, blocs, liens libres.
3. **C3 — Finitions** : profil démo réécrit, constitution 3.0.0, FOUNDATION résumée (vision actuelle), JOURNAL, nettoyage
   du code mort restant (vérifié par `tsc` + recherche des exports orphelins).

## Constitution Check
I : le CLI reste le seul programme lancé, arguments fixes, stdin. II : la conversion écrit une fiche par idée dans une
opération d'Historique annulable. IV : plus aucun appel hors abonnement. V : tests du fournisseur CLI (faux exécutable),
de la conversion (base réelle), tests de l'ancien moteur retirés avec lui. VI : retrait massif de code mort.

## Risques
- Données : conversion idempotente, anciennes tables gardées (D1).
- Historique : les anciens lots restent lisibles ; leur annulation reste possible (gestionnaires d'entités conservés tant
  que les tables existent).
