# Research — 002 Structuration IA

> S'appuie sur les décisions de `specs/001-moteur-ia-hybride/research.md` (outillage, tests, Claude,
> Ollama, base, IPC). Aucune nouvelle dépendance n'est introduite par cette feature.

## R1 — Pilotage du questionnaire
- **Décision** : machine à états explicite côté application (`asking → ready → decomposing → proposed`, + `abandoned`, `failed`) ; l'IA renvoie à chaque tour un `QuestionOut` (`question` | `ready` | `out_of_scope`) ; le **compteur et la limite sont tenus par l'app**, pas par l'IA.
- **Rationale** : l'IA ne peut pas « oublier » la limite ; transitions testables sans IA.
- **Alternatives** : laisser l'IA décider seule de la fin (non déterministe, coût non borné).

## R2 — Contexte envoyé à chaque tour
- **Décision** : idée + tours précédents (question/réponse) + ≤ 5 idées liées résumées (titres, catégorie, statut) ; `effort: low` pour `questionner`, `high` pour `decomposer`/`restructurer` ; le bloc stable (cadre + profil) est mis en cache par le moteur 001.
- **Rationale** : questions rapides et peu coûteuses ; décomposition soignée.

## R3 — Références temporaires → identifiants
- **Décision** : l'IA produit des `ref` locales à la proposition (`"t1"`, `"c1"`) ; la proposition les conserve telles quelles ; la conversion en identifiants définitifs se fait à l'acceptation (F3), dans une transaction.
- **Rationale** : une proposition refusée ne crée rien ; pas d'identifiants orphelins.

## R4 — Détection de boucles
- **Décision** : tri topologique (algorithme de Kahn) sur l'union des dépendances existantes de l'idée et des nouvelles ; si des nœuds restent non triés → boucle → rejet.
- **Rationale** : linéaire, simple, testable ; donne aussi un ordre d'exécution utile à F4/F5.
- **Alternatives** : parcours en profondeur avec marquage (équivalent, moins lisible pour un débutant).

## R5 — Garantie « ne jamais inventer » (FR-008)
- **Décision** : contrôle de provenance déterministe après l'IA :
  1. extraire des réponses de l'utilisateur (et du texte de l'idée) tous les montants (`1250`, `1 250 €`, `1.250,00`) et dates (formats FR usuels + relatifs simples « le 15/11 ») normalisés ;
  2. tout `amountCents` / `dueDate` de la proposition absent de cet ensemble est **retiré**, et une tâche d'investigation « Trouver … » est ajoutée sous le même parent ;
  3. l'événement est journalisé (sans contenu) pour mesurer SC-002.
- **Rationale** : on ne fait pas confiance à la seule consigne donnée à l'IA ; la règle est vérifiable.
- **Alternatives** : consigne seule (non garantie).

## R6 — Proposition périmée
- **Décision** : `ideas.version` incrémentée à chaque modification de l'idée ou de son arbre ; la session mémorise la version de départ ; `proposals.base_version ≠ ideas.version` → statut `stale`.

## R7 — Reprise après coupure
- **Décision** : au démarrage, toute session `decomposing` ou `asking` avec un appel IA en vol depuis > 10 min revient à son dernier état stable (dernière question affichée ou `ready`) ; les tours sont écrits avant chaque appel IA.

## R8 — Mode dégradé
- **Décision** : si Claude est indisponible ou bloqué par le budget, proposer (a) attendre ou (b) questionnaire par l'IA locale via `allowDegraded` du moteur 001 ; la proposition porte l'indicateur `degraded: true`, affiché à l'utilisateur.

## R9 — Idées liées candidates
- **Décision** : pour le contexte et pour `ideaLinks`, candidates = 5 idées non archivées de même catégorie ou partageant des mots significatifs (recherche plein texte SQLite FTS5 sur le texte des idées) ; l'IA ne peut lier qu'à ces candidates (alias `I1…I5`), toute autre référence est rejetée.
- **Rationale** : borne le contexte, empêche les références inventées.
- **Alternatives** : envoyer toutes les idées (coût, confidentialité).
