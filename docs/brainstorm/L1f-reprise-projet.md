# Niveau 1 (amendement) — Reprendre un projet existant : cartographie, diagnostic et flux
> Projet : Gestionnaire_idées · Prolonge : L1e-chirurgie-projet.md (carte de structure), L3-carte-structure.md,
> L1c-pont-claude-code.md · Date : 2026-10-06 · Statut : **niveau 1 validé** (arbitrages A1–A9)

> « Imaginons que je rejoigne une boîte et que je doive reprendre un projet en cours de route, dans lequel sont déjà
> passés d'autres devs. Au lieu de perdre du temps à lire moi-même chaque ligne de code et les README, je veux charger
> le projet dans l'app […] et, grâce à Claude, cartographier le projet : avoir directement l'arborescence et le
> diagramme visuel, comme une map. » — mentalyas

## 1. Constat
Aujourd'hui, le Brainstormer va **de l'idée au projet** : entonnoir de brainstorm, genesis → projet (spec 016), puis
implémentation chirurgicale étape par étape (plan d'attaque, actions finales). Il manque **le chemin inverse** : partir
d'un projet existant, écrit par d'autres, pour le comprendre vite et savoir où intervenir sans danger.

## 2. Ce que la fonctionnalité apporte (vision)
| # | Brique | Description | Existe déjà ? |
|---|--------|-------------|---------------|
| 1 | Entrée | Charger un projet : dossier local ou dépôt GitHub | Dossier local : oui (lier un dossier, spec 008) ; GitHub : non |
| 2 | Cartographie | Arborescence et diagramme du projet en nœuds et liens | Oui en partie : carte de structure (spec 009) |
| 3 | Diagnostic | Code couleur par élément : solide, intouchable, fragile, améliorable, point d'extension | Non |
| 4 | Flux | Appels entre modules et fichiers, déduits du code | Liens `appelle` / `depend_de` posés par Claude ; pas de graphe d'appels extrait du code |
| 5 | Niveaux | Plusieurs niveaux de lecture pour éviter le bruit | Déplier / replier (spec 009) ; pas de zoom sémantique |

## 3. Arbitrages
| # | Sujet | Décision | Date |
|---|-------|----------|------|
| A1 | Analyse du flux | **Statique d'abord** (lire le code sans l'exécuter) pour le MVP ; une **couche dynamique** (observer l'application en marche, sondes) viendra plus tard éclairer les chemins réellement empruntés | 2026-10-06 |
| A2 | Langages du MVP | **TypeScript / JavaScript, C# / .NET, PHP / Laravel**. Piste proposée (à confirmer au niveau 3) : une seule mécanique d'analyse syntaxique pour les trois (tree-sitter, grammaires TS / C# / PHP, sans .NET ni PHP installés) ; Claude lève les ambiguïtés de résolution ; analyseurs typés (compilateur TS, Roslyn) plus tard | 2026-10-06 |
| A3 | Diagnostic (couleurs) | **Mesures + avis de Claude** : l'app calcule des mesures objectives (tests présents, nombre de dépendants, taille, historique git des modifications…) ; Claude les interprète et **justifie** chaque couleur ; mentalyas peut **corriger** un verdict | 2026-10-06 |
| A4 | Confidentialité | **Niveau choisi par projet à l'import** : « Claude autorisé » (analyse complète) ou « Local uniquement » (analyse syntaxique + mesures dans l'app, avis par Ollama, rien ne sort de la machine). Mode affiché en permanence sur la carte | 2026-10-06 |
| A5 | Vues | **Deux vues reliées** : un **explorateur** (graphe complet du code, zoom par niveaux, pensé pour des milliers de nœuds — moteur de rendu à choisir au niveau 3, React Flow plafonnant vers quelques centaines) et la **carte de structure** (spec 009) qui garde les éléments choisis pour y travailler (conversation, plan d'attaque, actions finales). Un clic passe de l'une à l'autre, centré sur l'élément | 2026-10-06 |
| A6 | Import GitHub | **`git clone` avec le git de mentalyas** (identifiants gérés par git / le gestionnaire Windows ; l'app ne voit ni ne stocke aucun jeton) dans un dossier choisi, puis dossier local comme un autre. Garde-fous : URL `https://` ou `git@` seulement (transports `ext::`, `file://`… refusés) ; git lancé par chemin absolu, sans shell ; **rien du projet importé n'est exécuté** (ni installation, ni build, ni hooks) | 2026-10-06 |
| A7 | Livrables | En plus de la carte : **guide de reprise** (à quoi sert le projet, comment le lancer, architecture, conventions, zones à risque, par où commencer) ; **parcours d'une fonctionnalité** (d'un point d'entrée — route, bouton, commande — au chemin complet à travers les modules) ; **questions au projet** (réponse de Claude surlignée sur la carte : « où est gérée la facturation ? », « qu'est-ce qui casse si je modifie X ? ») ; **suivi des changements** (recartographier après des commits et voir ce qui a bougé) | 2026-10-06 |
| A8 | Principe pédagogique | **Comprendre vite, comme un dev junior** : chaque explication (élément, couleur, parcours, guide) part d'une **analogie simple et concrète** avant le détail technique ; vocabulaire expliqué à la première occurrence | 2026-10-06 |
| A9 | Découpage | **MVP 1 Voir → MVP 2 Juger → v2 Suivre → v3 Observer** (§5) | 2026-10-06 |

## 4. Matière reprise du brainstorm Gemini (« AuraTrace ») — inspiration, pas cahier des charges
- **Filtrer le bruit par catégorie d'appel** : métier (toujours visible) · orchestration et points d'entrée · infrastructure
  et entrées/sorties (frontières du système) · plomberie et utilitaires (masqués par défaut).
- **Zoom sémantique à 4 niveaux** : projets / assemblies → modules / namespaces → classes et méthodes → code source.
- **Direction artistique** « rétro-néo-futuriste » (nébuleuses en vue large, terminal phosphorescent en vue détail) :
  idée à confronter au thème actuel de l'app (L4).
- **Image conceptuelle** (Gemini, partagée par mentalyas le 2026-10-06) : les 4 niveaux côte à côte — nébuleuses
  (Macro-Cosme : projets), constellation reliée par des flux lumineux (Journey Map : modules), boîtes de classes
  reliées par des faisceaux (Anatomie : classes / méthodes), terminal phosphorescent avec code et pile d'appels
  (Micro-Détail). Référence visuelle pour le niveau 4 ; fichier `docs/brainstorm/Assets/Capture d'écran 2026-10-06 185812.png`.
- Hors MVP (A1) : traçage à l'exécution (.NET `ActivitySource` / OpenTelemetry, API de profilage, réécriture IL).

## 5. Découpage en lots (A9)
| Lot | Contenu | Résultat pour mentalyas |
|-----|---------|-------------------------|
| **MVP 1 — Voir** | Import (dossier local ou `git clone`), niveau de confidentialité, analyse statique TS / C# / PHP (fichiers, modules, appels, catégories), explorateur à niveaux (plomberie masquée par défaut), guide de reprise avec analogies | Ouvrir un projet inconnu et en comprendre l'architecture en quelques minutes |
| **MVP 2 — Juger** | Mesures (tests, dépendants, taille, historique git), couleurs de diagnostic justifiées par Claude et corrigeables, envoi d'éléments vers la carte de structure | Savoir où il est sûr d'intervenir, puis y travailler chirurgicalement |
| **v2 — Suivre** | Parcours d'une fonctionnalité, questions au projet surlignées sur la carte, suivi des changements entre deux analyses | Tracer un flux précis, interroger le projet, voir ce qui bouge |
| **v3 — Observer** | Couche dynamique (sondes à l'exécution, par langage), direction artistique rétro-néo-futuriste | Voir les chemins réellement empruntés |

## 6. Sécurité (macro)
- Code importé = **donnée non fiable** : jamais exécuté, jamais pris pour une instruction (un commentaire piégé
  « ignore tes consignes » reste du texte analysé).
- Confidentialité par projet (A4) : en « Local uniquement », aucun envoi à Claude — vérifié par test.
- Import : URL filtrée, git par chemin absolu sans shell, dossier choisi au sélecteur natif (A6).
- Dossier de données de l'app jamais analysable (même règle que `--add-dir`, spec 014).

## 7. Points à creuser au niveau 2
- Définition exacte de chaque couleur (solide, intouchable, fragile, améliorable, point d'extension) et des mesures qui
  la nourrissent.
- Niveaux de l'explorateur : que montre chaque niveau pour TS, C#, PHP (projets / dossiers / fichiers / fonctions).
- Catégorisation des appels (métier, orchestration, infrastructure, plomberie) : règles par langage + avis de Claude.
- Contenu et forme du guide de reprise ; où il vit (document de neurone, spec 012 ?).
- Taille maximale d'un projet analysable et temps d'analyse acceptable.
