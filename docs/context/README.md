# Contexte de l'agent — procédure de mise à jour (Claude Code → app)

« Former » l'agent du Brainstormer = lui fournir un **profil**, des **règles** et des **exemples**.
Aucun ré-entraînement : ces fichiers sont injectés dans le contexte de chaque appel IA (spec 001 US5).

## Où ?
`%APPDATA%/gestionnaire-idees/context-inbox/` — **hors du dépôt** (le dépôt est public).

## Fichiers reconnus (les autres sont ignorés puis archivés)
| Fichier | Contenu | Limite |
|---------|---------|--------|
| `profile.md` | Casquettes, façon de réfléchir, organisation | 50 Ko |
| `rules.md` | Ton, style de questions, préférences de réponse | 50 Ko |
| `examples.json` | `[{ taskKind, polarity: "positive"\|"negative", input, output, reason? }]` | 50 Ko, 60 entrées |
| `manifest.json` | `{ schemaVersion: 1, author, createdAt, files: [...], sha256: { fichier: empreinte } }` | écrit **en dernier** |

## Règles impératives
1. **Aucune donnée personnelle** dans `profile.md` et `rules.md` : ni nom, ni e-mail, ni téléphone, ni IBAN,
   ni montant, ni adresse. Ces fichiers partent **tels quels** chez Claude (non anonymisés).
   L'app refuse automatiquement un paquet qui en contient.
2. Écrire les fichiers de contenu d'abord, puis `manifest.json` avec l'empreinte SHA-256 de chaque fichier listé.
3. L'app détecte le manifeste, vérifie tout, affiche l'aperçu avant/après : **rien n'est actif avant « Appliquer »**.
4. Chaque application crée une version ; « Restaurer » revient à n'importe quelle version précédente.

## Demande type à Claude Code
> « Mets à jour le contexte de mon Brainstormer : distille de mon CLAUDE.md ma façon de travailler (sans aucune
> donnée d'identité), écris profile.md et rules.md dans le dossier d'import, puis le manifeste avec les empreintes. »

Exemple de format : [`profile.example.md`](./profile.example.md) (fictif).
