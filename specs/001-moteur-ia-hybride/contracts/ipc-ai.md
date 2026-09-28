# Contrat IPC — Réglages IA & contexte (renderer ↔ main)

Format de réponse uniforme : `{ success: true, data } | { success: false, error: { code, message } }`.

**Unités de coût** : stockage interne en **millicentimes d'euro** (`ai_calls.cost_millicents`, entiers,
pas d'erreur d'arrondi) ; exposition IPC et affichage en **centimes d'euro** (`spentCents`, `capCents`),
arrondis au centime supérieur. `ai_config.cap_cents` est en centimes.
Chaque payload est validé par Zod dans le main ; toute entrée invalide → `VALIDATION`.

| Canal | Entrée | Sortie `data` | Erreurs |
|-------|--------|---------------|---------|
| `ai:status` | — | `{ ollama: { up, model?, reason? }, claude: { configured, model }, budget: { spentCents, capCents, state: "normal"\|"alert"\|"blocked"\|"unlocked" } }` | — |
| `ai:setClaudeKey` | `{ key: string }` (regex `^sk-ant-[A-Za-z0-9_-]{20,}$`) | `{ configured: true, masked: "sk-ant-…XXXX" }` | `VALIDATION`, `ENCRYPTION_UNAVAILABLE` |
| `ai:clearClaudeKey` | — | `{ configured: false }` | — |
| `ai:getConfig` | — | `AIConfigView` (sans secret) | — |
| `ai:setConfig` | `Partial<{ localModel, claudeModel, capCents, alertRatio, allowClaudeFallback, usdEurRate }>` | `AIConfigView` | `VALIDATION` |
| `ai:test` | `{ engine: "ollama"\|"claude" }` | `{ ok: boolean, latencyMs?: number, reason?: string }` | `AUTH_FAILED`, `AI_UNAVAILABLE` |
| `ai:unlockBudget` | `{ confirm: true }` | `{ state: "unlocked" }` | `VALIDATION` |
| `context:list` | — | `{ active: ContextVersionView, history: ContextVersionView[] }` | — |
| `context:pending` | — | `ContextImportView[]` (avec diff) | — |
| `context:apply` | `{ importId }` | `ContextVersionView` | `NOT_FOUND`, `INVALID_STATE` |
| `context:reject` | `{ importId }` | `{ ok: true }` | `NOT_FOUND` |
| `context:rollback` | `{ versionId }` | `ContextVersionView` | `NOT_FOUND` |

Événements main → renderer : `ai:budgetAlert { spentCents, capCents }`, `context:newImport { importId }`.

**Jamais exposé au renderer** : la clé API en clair, la clé de base, le contenu brut des appels.

---

# Contrat fichier — Dossier d'import de contexte (Claude Code → app)

Emplacement : `%APPDATA%/gestionnaire-idees/context-inbox/`. `manifest.json` est écrit **en dernier**.

```jsonc
// manifest.json — schemaVersion 1
{
  "schemaVersion": 1,
  "author": "claude-code",
  "createdAt": "2026-09-28T10:00:00Z",
  "files": ["profile.md", "rules.md", "examples.json"],   // sous-ensemble autorisé, noms fixes
  "sha256": { "profile.md": "…", "rules.md": "…", "examples.json": "…" }
}
```
| Fichier | Contenu | Limite |
|---------|---------|--------|
| `profile.md` | Profil distillé (rôles, habitudes, priorités, contraintes) | 50 Ko |
| `rules.md` | Règles additionnelles (ton, style de questions) — ne peut pas contredire le cadre | 50 Ko |
| `examples.json` | `[{ "taskKind": TaskKind, "polarity": "positive"\|"negative", "input": string, "output": object, "reason"?: string }]` | 50 Ko, ≤ 60 entrées |

Règles : fichiers hors liste ignorés ; empreinte incorrecte ou schéma invalide → import `invalid` ;
après traitement (appliqué/refusé/invalide), le contenu de l'inbox est déplacé dans `context-archive/<importId>/`.
