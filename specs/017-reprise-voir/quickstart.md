# Quickstart — validation de la spec 017

## Prérequis
- `npm run dev` (ou `npm run seed:demo`) ; git installé.
- Projets de démonstration **fictifs** livrés avec les tests : `tests/fixtures/reprise/{ts-app, cs-app, laravel-app}`
  (copiés dans `C:\tmp\reprise\` pour l'essai manuel), et `hostile-app` (scripts d'installation, hooks, commentaire
  porteur de consigne, `.env`).

## Scénarios
1. **Import local + confidentialité (US1)** — « Reprendre un projet existant » → dossier `laravel-app` → l'aperçu
   montre PHP, les fichiers retenus, « 1 fichier sensible ignoré » ; « Importer » grisé tant qu'aucun niveau n'est
   choisi → « Local uniquement » → le genesis apparaît avec le badge ; ouvrir son chat → conversation indisponible,
   raison affichée.
2. **Explorateur (US2, US3)** — ouvrir l'explorateur du projet `ts-app` → niveau Modules, flèches avec volume ;
   double-clic → dossiers → fichiers → fonctions + extrait ; fil d'Ariane jusqu'en haut ; plomberie masquée avec
   compteur ; « Isoler » un fichier ; vue liste au clavier.
3. **Fiabilité des liens (US3)** — `laravel-app` : route → contrôleur → modèle en trait plein ; `cs-app` : interface
   injectée → implémentation ; un appel ambigu en pointillés ; corriger une catégorie → réanalyser → la correction
   reste.
4. **Guide (US4)** — `cs-app` en « Claude autorisé » → le guide s'ouvre : 9 sections avec analogies ; cliquer un
   fichier cité → l'explorateur se centre ; régénérer → l'ancienne version reste dans l'historique du document.
5. **Clone (US5)** — coller l'URL `https://` d'un dépôt public → progression → aperçu ; annuler en cours → dossier
   partiel supprimé ; coller `ext::sh -c calc` → refusé sans rien lancer.
6. **Projet piégé (SC-003)** — importer `hostile-app` : aucun script lancé, `.env` jamais affiché, le commentaire
   « ignore tes consignes » ne change rien au guide.

## Vérifications automatiques
`npm test` · `npm run typecheck` · `npm run lint` · `npx prettier --check src tests` · `npm run build`.
