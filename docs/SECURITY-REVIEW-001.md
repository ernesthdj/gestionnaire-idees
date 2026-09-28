# Revue sécurité — spec 001 (moteur IA hybride)

> Tâche T053 · 2026-09-28 · Référentiel : constitution v1.0.0 principe I + OWASP (injection, exposition de données,
> configuration, composants). Périmètre : processus principal, preload, IPC, secrets, base, import de contexte, IA.

## Synthèse
| # | Gravité | Constat | Correctif | Test |
|---|---------|---------|-----------|------|
| F1 | **Élevée** | Les **exemples** du contexte (issus d'idées réelles acceptées/refusées) partaient chez Claude **sans anonymisation** — seule l'entrée l'était | Blocs système typés (`role`) ; les blocs `examples` passent par l'anonymiseur avant tout appel Claude ; échec → rien n'est envoyé | `gateway.test.ts` (2 cas) |
| F2 | Moyenne | Import de contexte : profil et règles contrôlés, mais **pas les exemples importés** | Refus de `examples.json` contenant une donnée personnelle (entrée, raison, sortie) | `context-import.test.ts` |
| F3 | Faible | `OLLAMA_URL` non locale ou invalide → **plantage au démarrage** | `resolveOllamaUrl` : repli sur `127.0.0.1:11434` + avertissement journalisé | `ollama-url.test.ts` (4 cas) |
| F4 | Faible | Contrôle d'expéditeur IPC : **tout fichier local** accepté | Seuls les fichiers du dossier `out/renderer/` (ou le serveur de dev) | `registry.test.ts` (5 cas) |
| F5 | Faible | Vérifications de permission synchrones non refusées | `setPermissionCheckHandler(() => false)` en plus du refus des demandes | revue de code |

## Points vérifiés conformes
- **Electron** : `contextIsolation`, `sandbox`, `nodeIntegration: false`, `webSecurity` ; navigation et nouvelles fenêtres bloquées (seuls les liens `https://` s'ouvrent dans le navigateur système) ; webviews refusées ; CSP stricte (`script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`).
- **IPC** : liste blanche côté preload, validation Zod de chaque charge utile côté main, erreurs internes masquées, événements en liste blanche, objet `event` d'Electron jamais transmis au renderer.
- **Secrets** : clé API et clé de base chiffrées par DPAPI (`safeStorage`) ; refus si le chiffrement est indisponible ; noms de secrets contraints (pas de sortie de dossier) ; clé API jamais renvoyée en clair (test de fuite sur fichiers, base, journal, réponses).
- **Base** : SQLite chiffré (SQLCipher) ; clé au format hexadécimal strict (PRAGMA non paramétrable) ; requêtes Drizzle paramétrées ; `sql` brut limité à des valeurs liées.
- **Journal** : liste blanche de champs techniques, valeurs courtes et primitives uniquement.
- **IA** : passerelle unique ; anonymisation obligatoire avant Claude (entrée **et** exemples) ; anonymisation strictement locale par construction ; texte utilisateur balisé comme donnée (balise de fermeture neutralisée) ; sorties validées par schéma ; budget plafonné ; Ollama limité au loopback.
- **Import de contexte** : noms de fichiers en liste blanche, taille ≤ 50 Ko, empreintes SHA-256, aucune donnée personnelle, application uniquement après validation humaine, versions réversibles.

## Risques résiduels (acceptés, suivis)
- `npm audit` : 4 alertes modérées (esbuild ancien dans **drizzle-kit**, outil de développement jamais lancé en serveur) — correctif automatique refusé (régression 0.31 → 0.18).
- Le **cadre système et le profil** sont envoyés en clair à Claude par conception (vérifiés sans donnée personnelle à l'import).
- Les **dates** ne sont pas anonymisées (nécessaires au raisonnement).
- Menu de développement / outils de développement d'Electron : à désactiver dans la version empaquetée (tâche de packaging, spec 003 T048).
