---
type: glossaire
subject: Canal nommé (named pipe), flux standard (stdin, stdout, stderr) et JSON par ligne (NDJSON)
tags: [#glossaire, #processus, #ipc, #systeme]
date: 2026-10-06
niveau: intermédiaire
---

# Canal nommé et flux standard

> **En 30 secondes** — Deux façons pour des processus de la même machine de s'échanger des octets. Les **flux standard** (`stdin`, `stdout`, `stderr`) relient un parent à l'enfant qu'il lance. Un **canal nommé** est un tuyau désigné par un nom, auquel des processus **sans lien de parenté** peuvent se brancher. Dans les deux cas, ce qui circule est un **flux** sans découpage : on délimite les messages soi-même, souvent **une ligne JSON par message** (NDJSON, *newline-delimited JSON*).

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : la mémoire de chaque processus est isolée (voir [[Glossaire — IPC (communication entre processus)]]). Pour coopérer, il faut un conduit fourni par le système d'exploitation.
- **Analogie (Satisfactory)** : un **convoyeur** entre deux machines. `stdin`/`stdout` = les tapis soudés à une machine quand on la pose ; le canal nommé = une **gare de fret** avec un nom, où plusieurs trains viennent se brancher. Sur un convoyeur, les pièces arrivent à la file sans étiquette de lot : c'est le saut de ligne qui sert d'étiquette.

## 2. Comment ça marche (sous le capot)
Le noyau garde un **tampon** en mémoire entre l'écrivain et le lecteur. Le lecteur reçoit des **morceaux** de taille arbitraire (un demi-message ou trois messages d'un coup). Sous Windows, un canal nommé s'appelle `\\.\pipe\<nom>` et n'ouvre **aucun port réseau** ; Node le manipule avec le même module `net` qu'une connexion TCP.

## 3. En pratique
```ts
// Reconstituer des messages à partir d'un flux (LineSplitter, CliConversation)
buffer += chunk
const lines = buffer.split('\n')
buffer = lines.pop() ?? ''          // le dernier morceau est peut-être incomplet : on le garde
for (const line of lines) if (line.trim() !== '') handle(JSON.parse(line))
```

## Utilisé dans ce cours
- [[Pont MCP — relais stdio, canal nommé et secret partagé]] — stdio vers Claude Code, canal nommé vers le main.
- [[Piloter Claude Code — processus enfant, flux stream-json et session reprise]] — `stream-json` = NDJSON sur stdin/stdout.
- [[Lancer un programme sans shell — chemin absolu, arguments séparés, listes blanches]] — sortie des scripts bornée.

## Retenir et vérifier
- **À retenir** : un flux n'a pas de messages ; on les délimite (ligne) et on les **borne** (taille max).
> **Q :** Pourquoi `stderr` est-il séparé de `stdout` ? **R :** Pour que les messages d'erreur ne se mélangent pas aux données : ici `stdout` porte le JSON à analyser, `stderr` un diagnostic gardé à part (et jamais journalisé).

**Pièges** : ⚠️ oublier la dernière ligne sans `\n` à la fermeture du processus — elle reste dans le tampon (d'où le `if (buffer.trim() !== '')` dans la fonction de fin de `CliConversation`).
