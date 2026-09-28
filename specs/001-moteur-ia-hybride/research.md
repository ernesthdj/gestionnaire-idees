# Research — 001 Moteur IA hybride & contexte

> Phase 0 du plan. Chaque décision : Décision · Rationale · Alternatives.
> Les nouvelles dépendances listées ici sont **annoncées** (constitution, workflow) et seront installées
> seulement à l'implémentation, après validation.

## R1 — Outillage Electron (build, dev, packaging)
- **Décision** : `electron-vite` (dev + build des 3 cibles main / preload / renderer) + `electron-builder` (installeur Windows NSIS).
- **Rationale** : Vite pour React (rechargement rapide), séparation native main/preload/renderer, configuration TypeScript prête ; electron-builder gère l'installeur, le démarrage avec Windows et l'inclusion des modules natifs (`better-sqlite3-multiple-ciphers`).
- **Alternatives** : Electron Forge (plus lourd à configurer avec Vite + natif) ; webpack (lent, config verbeuse).

## R2 — Tests
- **Décision** : **Vitest** (unitaires + intégration), moteurs IA simulés via l'interface `AIProvider` ; tests d'intégration base sur un fichier SQLite temporaire.
- **Rationale** : même moteur que Vite, rapide, API compatible Jest, TypeScript natif.
- **Alternatives** : Jest (configuration TS/ESM plus lourde). Playwright-Electron réservé aux tests de bout en bout ultérieurs (hors F9).

## R3 — Appels Claude
- **Décision** : SDK officiel `@anthropic-ai/sdk` ; `client.messages.parse` + `zodOutputFormat(schema)` (helper `@anthropic-ai/sdk/helpers/zod`) → `parsed_output` (null = sortie invalide) ; `thinking: { type: "adaptive" }` ; `output_config.effort` par type (`etendre` → `low`, `suggerer_liens` → `medium`, `synthetiser`/`reviser`/`suggerer` → `high`) ; `max_tokens` 16 000 (non streaming).
- **Modèle** : `claude-opus-5` par défaut (décision mentalyas), configurable.
- **Refus** : tester `stop_reason === "refusal"` avant lecture ; fallbacks serveur activés pour Opus 5 (`betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`) → requêtes via `client.beta.messages` quand activé ; à vérifier en implémentation contre la doc du SDK (combinaison `parse` + beta).
- **Cache** : `cache_control: { type: "ephemeral" }` sur le bloc système stable (cadre + profil) ; vérifier `usage.cache_read_input_tokens` > 0 sur les tours suivants.
- **Erreurs** : classes typées du SDK (`AuthenticationError`, `RateLimitError`, `APIConnectionError`, `APIError`), chaîne du plus spécifique au plus général ; retries par défaut du SDK (2).
- **Alternatives** : appels HTTP bruts (refusé : le SDK est la voie officielle) ; outils (tool use) pour forcer le format (inutile : sorties structurées natives).

## R4 — Appels Ollama
- **Décision** : HTTP local `POST http://127.0.0.1:11434/api/chat`, `stream: false`, champ `format` = JSON Schema dérivé du schéma Zod (`zod-to-json-schema` ou `z.toJSONSchema` selon la version de Zod), puis revalidation Zod ; santé via `GET /api/tags` (modèle présent ?).
- **Rationale** : pas de SDK nécessaire, sortie structurée native d'Ollama, zéro dépendance réseau externe.
- **Alternatives** : bibliothèque `ollama` npm (dépendance en plus pour 2 appels) — gardée en option si besoin.

## R5 — Choix du modèle local
- **Décision** : **banc d'essai** en tâche dédiée (T-bench) sur 3 candidats instruct 7-8B quantifiés Q4 (~5 Go VRAM) avec un jeu fixe de 30 cas fictifs par tâche locale (catégoriser, résumer, anonymiser, briefing). Critères : taux de sorties valides, exactitude, latence < 3 s (SC-003). Le modèle retenu devient la valeur par défaut configurable.
- **Rationale** : les performances varient selon la tâche et la langue (français) ; on mesure au lieu de deviner.
- **Alternatives** : fixer un modèle a priori (risque de mauvais choix non détecté).

## R6 — Anonymisation
- **Décision** : **double couche**. (1) Règles déterministes toujours appliquées : e-mails, téléphones, IBAN, URLs personnelles → retirés ; montants → fourchettes (`<100`, `100-500`, `500-1000`, `1000-2500`, `>2500`) ou arrondis à la centaine. (2) IA locale pour les noms de personnes (remplacés par `[personne]`). Si (2) échoue → (1) seule + noms propres détectés par heuristique (mot capitalisé hors début de phrase, hors liste blanche) retirés. Jamais d'envoi brut.
- **Rationale** : les règles garantissent un plancher testable ; l'IA améliore la détection des noms.
- **Alternatives** : IA seule (non garantie) ; règles seules (noms mal détectés).

## R7 — Stockage de la clé API
- **Décision** : `safeStorage.encryptString` (DPAPI) → fichier `%APPDATA%/gestionnaire-idees/secrets/claude.key` ; déchiffrement uniquement dans le main ; `safeStorage.isEncryptionAvailable()` vérifié au démarrage (sinon refus de stocker, message).
- **Alternatives** : keytar (déprécié) ; stockage en base (mélange données/secrets, refusé).

## R8 — Surveillance du dossier d'import de contexte
- **Décision** : `fs.watch` natif sur `context-inbox/` + scan au démarrage ; déclenchement sur l'écriture de `manifest.json` (écrit **en dernier** par Claude Code), anti-rebond 1 s ; empreintes SHA-256 via `node:crypto`.
- **Alternatives** : chokidar (dépendance inutile pour un seul dossier plat).

## R9 — Estimation du coût
- **Décision** : grille tarifaire par modèle en configuration (entrée, sortie, lecture de cache, en USD/MTok ; valeurs initiales depuis la page de prix Anthropic, ex. Opus 5 : 5 $ / 25 $), taux USD→EUR configurable ; estimation pré-appel = tokens d'entrée (comptage via `messages.countTokens`, ou approximation caractères/3,5 si indisponible) + `max_tokens` borné par type ; imputation post-appel sur `usage`.
- **Alternatives** : Admin API de coût (nécessite une clé admin, surdimensionné).

## R10 — Base de données
- **Décision** : Drizzle ORM + `better-sqlite3-multiple-ciphers` (exception validée), clé de base aléatoire 32 octets protégée par `safeStorage` ; migrations Drizzle Kit versionnées avec script `down` manuel.
- **Rationale** : voir constitution, contraintes techniques.

## R11 — Validation & format IPC
- **Décision** : Zod (schémas partagés `src/shared/`), réponse uniforme `{ success, data } | { success: false, error: { code, message } }`, codes d'erreur énumérés.
- **Alternatives** : io-ts / valibot (Zod déjà requis par le helper Anthropic).

## Dépendances annoncées (à installer à l'implémentation)
| Paquet | Rôle |
|--------|------|
| `electron`, `electron-vite`, `electron-builder` | App desktop, build, installeur |
| `react`, `react-dom`, `tailwindcss` | Interface (écran de réglages IA dans cette feature) |
| `@anthropic-ai/sdk` | Appels Claude |
| `zod` (+ `zod-to-json-schema` si nécessaire) | Schémas / validation |
| `drizzle-orm`, `drizzle-kit`, `better-sqlite3-multiple-ciphers` | Base chiffrée |
| `vitest` | Tests |
