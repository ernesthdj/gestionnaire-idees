# Tâches — spec 033 « La coque compacte »

Un commit pour la spec livrée. Chaque lot : tests, typecheck, lint, Prettier, e2e touchés, JOURNAL.

## Lot 1 — Rail et barre fine

- [x] T010 Rail de 48 px (D1, FR-001) : sections en icônes, Thème en panneau, ⚙ Réglages ;
  tests renderer et axe.
- [x] T011 Barre fine de 32 px (D2, D3, FR-002) : fil « Section / projet ▾ », menu du projet, mini-jauges Claude ;
  retrait de l'en-tête, de la barre du projet et du bandeau d'ouverture ; tests.

## Lot 2 — Git et Dépôt

- [x] T020 Pastille git ⚠ (D5, FR-003) dans la barre fine ; tests.
- [x] T021 Le volet Dépôt reprend le bandeau d'ouverture (D6) : état à commiter / pousser / tirer, session `/hub`,
  dernières entrées du JOURNAL ; tests.

## Lot 3 — Explorateur → Architecture

- [x] T030 Retrait du bouton « Explorateur » ; les autres portes ouvrent la vue Architecture (D4) avec la rediffusion
  ou les nouveautés ; tests, e2e touchés.

## Lot 4 — Dock et clic droit

- [x] T040 Dock d'outils flottant (D7) : compteurs, Chercher, Filtrer, Fermer les cartes, Reprendre un projet,
  Réorganiser, Recentrer ; tests et axe.
- [x] T041 Clic droit (D8) : « Bloc libre » et « Liens d'analyse au repos » ; tests.

## Lot 5 — Finitions

- [x] T050 Captures (SC-001 : carte ≈ 1 216 × 729 px dans une fenêtre de 1 264 × 761), e2e, `CLAUDE.md`, JOURNAL ;
  statut « Livrée ».
- [x] T051 D10 : la barre des vues dans la barre fine (portail depuis la carte), pastilles arrondies, « à reporter » en
  pastille ⚠ ; bascule retirée des panneaux Progression et Architecture ; tests, e2e, captures.
- [x] T052 D11 : zoom amorti dans Progression et Architecture (`useSmoothZoom`, bornes réglables), « Tout afficher »
  qui glisse, glisser sans sélection de texte ; tests.
- [x] T053 D12 : l'abandonné en rouge dans le Workflow et la Progression ; tests.
