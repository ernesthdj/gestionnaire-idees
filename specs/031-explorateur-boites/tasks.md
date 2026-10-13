# Tâches — spec 031 « Explorateur en boîtes »

Un commit par lot. Chaque lot : tests, typecheck, lint, Prettier, e2e touchés, JOURNAL.

## Lot 0 — Décisions ouvertes

- [x] T001 Faire trancher D12 (rôle des fichiers par Claude, « Vue liste », filtres gardés) ; amender la spec (oui aux trois, 2026-10-14).

## Lot 1 — Données (main)

- [x] T010 Domaine pur `src/main/domain/reprise/boxes.ts` : couche d'un module (catégories + point d'entrée), modules et
  fichiers à plat (dossier d'origine en sous-titre), profondeur d'appel des fichiers d'un module + tests.
- [x] T011 Phrases d'appel (`A.f` appelle `B.g`) et cibles possibles d'un appel deviné, depuis les arêtes de symboles
  (spec 017) + tests.
- [x] T012 `ExplorerService.map(genesisId)` + IPC `explorer:map` (Zod, bornes, chemins relatifs, fichiers sensibles
  exclus) + tests d'intégration sur `tests/fixtures/reprise/cs-app`.

## Lot 1b — Rôle des fichiers (D12a)

- [ ] T013 Colonne `summary` des fichiers (migration + `down`), écrite par Claude dans la passe du guide pour un projet
  « Claude autorisé » (jamais en « Local uniquement »), lue par `explorer:map` + tests.

## Lot 2 — Carte d'ensemble

- [ ] T020 Disposition de la carte (colonnes dans le sens des appels) et boîtes (couche, nom, rôle, compte) ; clic =
  ouverture sur place (liste filtrable au-delà de 6) ; clic dans le vide = fermeture ; traits vers le fichier exact,
  phrase au survol + tests renderer et axe.

## Lot 3 — Entrer, sortir, passer par une amorce

- [ ] T030 Vue intérieure (D5) : cadre à la taille du contenu, colonnes par profondeur, fonctions, amorces.
- [ ] T031 Transitions D4 et D6 (copie figée, rectangle commun, fondus calés sur le temps, calque de titres) et Échap
  (inverse exact, zoom de la carte rendu) ; `prefers-reduced-motion`.
- [ ] T032 e2e : mesures SC-002 (rapport constant, somme des opacités, relais du titre).

## Lot 4 — Fiche et recherche

- [ ] T040 Fiche à droite (D8) : module en mots ; fichier → fonctions, appels, code (panneau existant).
- [ ] T041 Recherche Ctrl+K (D9) + tests.

## Lot 5 — Gestes et positions

- [ ] T050 Molette amortie centrée sur le curseur, glisser le fond, glisser un module ou un fichier seul, « Ranger »,
  « Recadrer » ; positions gardées par vue (FR-003) + tests.

## Lot 6 — Nettoyage

- [ ] T060 Retirer l'ancien explorateur (paliers, zoom sémantique, nœuds dossier) ; rebrancher rediffusion et nouveautés
  (FR-005) ; mettre à jour les e2e touchés (reprise, rediffusion, `explorer-adopt`) ; e2e du parcours complet ;
  spec 017 (D16 remplacée par la 031), `CLAUDE.md`, JOURNAL.
