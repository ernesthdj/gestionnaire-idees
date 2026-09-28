# Niveau 3 — Conception Technique : F8 — Compagnon tamagotchi & briefing quotidien
> Basé sur : docs/brainstorm/L1-fondation.md + docs/brainstorm/L2-compagnon.md
> Date : 2026-09-28 · Livraison : MVP-2

## 1. Contrat API

### 1a. Canaux IPC
| Canal | Entrée | Sortie | Codes d'erreur |
|-------|--------|--------|-----------------|
| `companion:state` | — | `{ stage, formId, score, nextThreshold, sprite: { sheet, frames, fps }, mood }` | — |
| `companion:briefing` | `{ force?: boolean }` | `Briefing` | `ALREADY_SHOWN_TODAY` (si non forcé) |
| `companion:dismiss` | `{ until: "later" \| "tomorrow" }` | `{ ok }` | — |
| `companion:history` | — | `EvolutionDraw[]` | — |
Événements main → fenêtre compagnon : `companion:evolved`, `companion:hasSuggestion`, `companion:show`.

### 1b. Fenêtre
`BrowserWindow` dédiée : `transparent: true`, `frame: false`, `alwaysOnTop: true`, `skipTaskbar: true`,
`focusable: false` au repos ; `setIgnoreMouseEvents(true, { forward: true })` hors du sprite/de la bulle
(les clics traversent les zones vides). Même durcissement que les autres fenêtres (contextIsolation, sandbox).
Rendu : `<canvas>` avec `image-rendering: pixelated`, sprite sheets PNG, mise à l'échelle entière (×3/×4).

### 1c. Fichier d'arbre d'évolution (`assets/companion/evolution.json`, validé Zod au démarrage)
```jsonc
{
  "schemaVersion": 1,
  "stages": [
    { "id": "egg",   "threshold": 0 },
    { "id": "baby",  "threshold": 15 },
    { "id": "teen",  "threshold": 60 },
    { "id": "adult", "threshold": 180 }
  ],
  "forms": [
    { "id": "egg",          "stage": "egg",   "sprite": "egg.png" },
    { "id": "baby",         "stage": "baby",  "sprite": "baby.png" },
    { "id": "teen_photo",   "stage": "teen",  "affinity": "photo",   "sprite": "teen_photo.png" },
    { "id": "teen_it",      "stage": "teen",  "affinity": "it",      "sprite": "teen_it.png" },
    // … une forme par catégorie + "balanced" (affinity: null) ; idem pour adult avec "from" optionnel
    { "id": "adult_photo",  "stage": "adult", "affinity": "photo", "from": ["teen_photo", "teen_balanced"], "sprite": "adult_photo.png" }
  ],
  "animations": { "idle": [0,1,2,1], "talk": [3,4], "idea": [5,6], "evolve": [7,8,9,10] },
  "minWeight": 0.05
}
```

## 2. Schéma de données détaillé
| Table | Colonnes | Contraintes | Index |
|-------|----------|-------------|-------|
| `companion` | id (=1), stage, form_id, score, last_evolved_at, last_briefing_date, rng_seed | ligne unique | — |
| `score_events` | id, kind (`idea_captured`/`idea_structured`/`suggestion_accepted`/`active_day`), points, ref_id?, created_at | `active_day` : 1 par jour calendaire ; ref_id unique par kind (pas de double comptage) | created_at, (kind, ref_id) |
| `evolution_draws` | id, from_form, to_form, stage, weights_json, category_counts_json, roll, created_at | append-only | created_at |

Barème (L2 R1) : capture +1, structuration validée +3, suggestion acceptée +2, jour actif +1.

## 3. Algorithme de tirage pondéré
```
1. Candidates = formes du stade suivant compatibles avec la forme actuelle (champ "from", sinon toutes).
2. Comptes = nb d'idées par catégorie créées depuis last_evolved_at.
3. Pour chaque candidate :
     part = comptes[affinity] / total   (forme "balanced" : part = 1 - max(parts), récompense la diversité)
     poids = max(part, minWeight)
4. Normaliser les poids (somme = 1).
5. roll = RNG() ∈ [0,1) ; parcourir les candidates en cumulant les poids ; la première qui dépasse roll gagne
   (sélection par roulette).
6. Enregistrer weights, comptes, roll, résultat dans evolution_draws.
```
- **RNG** : `crypto.randomInt` / `crypto.getRandomValues` (Node) — pas de graine rejouable nécessaire pour
  l'utilisateur ; `rng_seed` sert uniquement aux tests (générateur déterministe injecté).
- **Explication** affichée : « Tu as noté 12 idées Photo sur 20 → 60 % de chances, et c'est tombé sur Photo ! ».

## 4. Diagramme de séquence (Mermaid)
```mermaid
sequenceDiagram
    participant EV as Événements métier (F1/F3/F7)
    participant CS as CompanionService
    participant DB as SQLite
    participant W as Fenêtre compagnon
    participant AD as Advisor (F7)

    EV->>CS: onEvent(kind, refId)
    CS->>DB: score_events (unique kind+refId) ; score += points
    alt score ≥ seuil du stade suivant
        CS->>DB: comptes par catégorie
        CS->>CS: tirage pondéré
        CS->>DB: evolution_draws + companion.stage/form
        CS-->>W: companion:evolved (animation + explication)
    end
    Note over CS: Au 1er démarrage du jour
    CS->>AD: runDaily() (F7) puis signaux locaux
    CS->>CS: construire Briefing (texte : IA locale, repli gabarit fixe)
    alt plein écran / ne pas déranger
        CS->>CS: reporter (re-test toutes les 10 min)
    else
        CS-->>W: companion:show + Briefing
    end
```

## 5. Cas limites techniques
- **Concurrence :** plusieurs événements simultanés → traitement séquentiel (file interne) ; au plus **une** évolution par événement (si le score saute deux paliers, évolution suivante au prochain événement).
- **Idempotence :** `(kind, ref_id)` unique → une idée validée deux fois ne rapporte qu'une fois ; briefing marqué par `last_briefing_date`.
- **Transactions :** score + tirage + changement de forme dans une transaction.
- **Détection plein écran :** vérifier si la fenêtre au premier plan couvre l'écran (API native via un petit module, ou heuristique `screen` + fenêtre active) — à valider en implémentation.
- **Texte du briefing :** généré par l'IA locale à partir de données structurées ; si indisponible → gabarit fixe (« 3 tâches aujourd'hui, 1 idée à structurer »). Jamais d'appel Claude pour le briefing.
- **Assets manquants :** forme sans sprite → sprite de repli du stade + avertissement au démarrage.
- **Tests :** 1 000 tirages simulés avec RNG déterministe → écart de fréquence ≤ 5 points par rapport aux poids.

## 6. Sécurité spécifique à cette fonctionnalité
| Risque | Vecteur | Mitigation |
|--------|---------|------------|
| Fenêtre au-dessus de tout exploitable | XSS dans la fenêtre compagnon | Même durcissement Electron ; contenu de bulle rendu en texte (pas de HTML) |
| Clics bloqués | Fenêtre transparente plein cadre | Taille ajustée au sprite + bulle ; `setIgnoreMouseEvents` hors zones actives |
| Fuite visuelle | Briefing affichant montants/projets pendant un partage d'écran | Report en plein écran ; option « briefing discret » (sans montants) |
| Fichier d'évolution altéré | Modification de `evolution.json` | Validé par schéma au démarrage ; fichier embarqué dans l'app (lecture seule) |
