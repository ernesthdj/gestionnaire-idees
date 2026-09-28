# Research — 002 Moteur de neurones (v2)

> S'appuie sur 001 (outillage, base chiffrée, IPC, AIGateway). **Aucune nouvelle dépendance.**
> Remplace la recherche de la version « questionnaire linéaire ».

## R1 — Un seul appel IA par réponse (extensions + jauge)
- **Décision** : type de demande `etendre` (Claude, effort `low`) qui renvoie **à la fois** les nouvelles extensions pour le neurone ciblé et l'évaluation de contexte de tout l'arbre. Appelé : (a) au démarrage du développement (cible = racine, **≥ 3 extensions exigées**) ; (b) après chaque réponse (cible = nouveau sous-neurone, 0..n extensions) ; (c) à la demande « plus de questions » sur un nœud.
- **Rationale** : divise par deux les appels (FR-009), jauge toujours cohérente avec les extensions.
- **Alternatives** : appel séparé `evaluer_contexte` (2× plus d'appels) ; jauge purement locale (ne sait pas juger les manques d'un sujet quelconque).

## R2 — Contexte envoyé à `etendre`
- **Décision** : nature + racine + **chemin** racine → cible (textes complets) + **résumé des autres branches** (titres seulement) + extensions déjà écartées (pour ne pas les reproposer) + profil (via 001). Borne : ~3 000 tokens de données ; au-delà, les branches les plus anciennes sont résumées en une ligne.
- **Rationale** : pertinence locale (le chemin) sans envoyer tout l'arbre.

## R3 — Plancher et garde-fous déterministes
- **Décision** : l'app impose le **plancher** (< 3 réponses → `insufficient`, quoi que dise l'IA), le **minimum de 3 extensions** au démarrage (1 retry, puis repli avec message), et le **plafond de profondeur 6** (au-delà : aucune extension IA demandée sur ce chemin, suggestion de neurone distinct).
- **Rationale** : l'IA propose, l'app garantit les règles (constitution III).

## R4 — Synthèse par nature
- **Décision** : type `synthetiser` (Claude, effort `high`) avec deux schémas : `ActionPlanOut` (nœuds de plan à `ref` temporaires, conditions 2–4 branches, dépendances `after_done`/`on_trigger`, opportunités, dates, investigations) et `ReflectionSummaryOut` (pistes retenues, décisions, arguments pour/contre, questions ouvertes, chacun relié aux sous-neurones sources par `sourceRefs`). Correction : `reviser` (même schéma + consigne).
- **Rationale** : un seul moteur, deux sorties typées ; `sourceRefs` rend la synthèse traçable (Réflexion) et sert au contrôle de provenance.

## R5 — Contrôles de cohérence (plan d'action)
- **Décision** : conservés de la v1 : références existantes, branches 2–4, profondeur ≤ 5 du **plan** (distincte de celle de l'arbre de croissance), absence de boucle (tri de Kahn), provenance montants/dates (extraction FR des réponses de l'utilisateur ; valeur non trouvée → retirée + élément « à trouver »).

## R6 — Confirmation tout-ou-rien
- **Décision** : `SynthesisApplier` dans une transaction : vérifie `base_version` (sinon `stale`), écrit le plan (`plan_nodes`, `plan_dependencies`) ou la synthèse (`reflection_summaries`), passe la racine à `hatched`, incrémente sa version, journalise (`change_log`, `batch_id`), enregistre l'exemple positif (001 `ExampleStore.record`). Réouverture (FR-015) : racine → `developing`, plan/synthèse conservés et marqués « précédents ».
- **Note** : l'annulation par lot (undo) et l'écran d'historique sont portés par la spec 003 ; le `batch_id` est posé ici.

## R7 — Suggestions de liens
- **Décision** : à chaque éclosion, `suggerer_liens` (Claude, effort `medium`) avec la synthèse du neurone éclos + **candidats** = jusqu'à 10 neurones éclos (même catégorie, recherche plein texte FTS5 sur titres/synthèses, les plus récents), désignés par alias `N1…N10`. Sortie : 0..3 `{ targetAlias, label (≤ 40), justification (≤ 200) }` ; alias inconnu → suggestion retirée ; empreinte des refus conservée.
- **Amendement (2026-09-28, idée de mentalyas inspirée de Graphify)** : les candidats sont choisis par un **graphe local de mots-clés** (fiche = titre + contenu + points clés du plan ou de la synthèse en cours ; score = mots-clés partagés normalisés + bonus même catégorie), sans IA. Seules des fiches courtes sont envoyées (≈ 300 caractères par candidate, 600 pour l'idée qui éclôt) et **aucun appel** n'est fait si aucune idée n'est proche. La recherche FTS5 n'est pas utilisée ici : elle n'indexe que les racines, pas les synthèses. Graphify lui-même n'est pas embarqué (outil Python de développement, extraction sémantique elle-même consommatrice de tokens).

## R8 — Nature et catégorie
- **Décision** : `categoriser` (IA locale) renvoie `{ categorySlug, nature }` ; non bloquant, rejoué via la file locale (001) ; jamais appliqué si la source est `user`. Défaut sans IA : nature `reflection`, catégorie `null` (« À classer »).

## R9 — Modèle d'arbre
- **Décision** : table unique `neurons` (racine et sous-neurones, `root_id` + `parent_id` + `depth`) plutôt que deux tables ; suppression d'un sous-neurone = suppression en cascade applicative de ses descendants (et de leurs extensions) dans une transaction.
- **Rationale** : parcours et affichage uniformes, requêtes simples par `root_id`.
