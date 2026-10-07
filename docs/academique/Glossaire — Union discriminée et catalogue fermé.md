---
type: glossaire
subject: Union discriminée (type somme avec une étiquette) et catalogue fermé (liste blanche des formes permises)
tags: [#glossaire, #typescript, #zod, #securite, #validation]
date: 2026-10-07
niveau: intermédiaire
---

# Union discriminée et catalogue fermé

> **En 30 secondes** — Une **union discriminée**, c'est un type qui peut prendre **plusieurs formes**, chacune reconnaissable à un champ **étiquette** (ex. `event: 'screen.open'`). Un **catalogue fermé**, c'est l'usage sécurité de cette idée : on **énumère** toutes les formes permises, chacune avec ses champs exacts — tout le reste est rejeté.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : la sonde de l'Analyste reçoit des événements de l'interface. Avec un type « objet libre », n'importe quel champ (un titre d'idée, un message d'erreur) pourrait passer. Avec un catalogue **ouvert** filtré par **liste noire** (« interdire `text`, `title`… »), on oublie toujours un nom de champ.
- **Analogie (multiprise)** : une multiprise à **détrompeurs** : chaque prise n'accepte **qu'une** forme de fiche (l'étiquette), et la forme impose le nombre de broches (les champs). Une fiche inconnue ne rentre nulle part.

## 2. Comment ça marche (sous le capot)
- **À la compilation** (TypeScript) : après `if (e.event === 'panel.close')`, le compilateur **sait** que `e.durationMs` existe — c'est le *rétrécissement de type* (*narrowing*). Ces types sont **effacés** à l'exécution.
- **À l'exécution** (Zod) : `z.discriminatedUnion('event', [...])` lit d'abord l'étiquette, choisit **le seul** schéma correspondant (un accès dans une table, pas un essai de chaque forme), puis valide ses champs. `.strict()` refuse tout champ en trop.
- **Côté données** : ce qui est stocké ne peut avoir que des formes connues → la base ne contient **par construction** aucun texte libre.

## 3. En pratique
```ts
// src/shared/analyste/events.ts (extrait)
export const RendererProbeEvent = z.discriminatedUnion('event', [
  z.object({ event: z.literal('screen.open'), screen: z.enum(PROBE_SCREENS) }).strict(),
  z.object({ event: z.literal('panel.close'), screen: z.enum(PROBE_SCREENS), durationMs: Duration }).strict(),
  ...PROBE_ACTIONS.map((name) => z.object({ event: z.literal(name), subjectKind: …, via: … }).strict()),
  z.object({ event: z.literal('error.renderer'), code: ProbeCode,           // un identifiant, jamais une phrase
             frames: z.array(ProbeFrame).max(5) }).strict()             // « src/…/x.ts:12 », relatif au dépôt
])
```
Chaque chaîne est une **énumération** ou un **format court** (regex) : il n'existe aucune case où un texte saisi pourrait se glisser.

## Utilisé dans ce cours
- [[Sonde sans contenu — télémétrie minimisée, empreintes HMAC et pseudonymes]] — le catalogue des événements observés.
- [[Piloter Claude Code — processus enfant, flux stream-json et session reprise]] — les événements du flux `stream-json` (`type`).
- [[IPC typé — le guichet unique entre interface et moteur]] — le résultat `{ success: true, data } | { success: false, error }`.
- [[Zod ↔ type guards et sortie structurée]] — ce que Zod automatise par rapport à un garde de type écrit à la main.

## Retenir et vérifier
- **À retenir** : une étiquette → une seule forme ; liste **blanche** (on énumère le permis) ; `.strict()` rejette le surplus.
> **Q :** Pourquoi un catalogue fermé plutôt qu'un filtre qui retire les champs sensibles ? **R :** Le filtre doit connaître tous les champs dangereux (impossible) ; le catalogue ne connaît que les champs utiles et rejette le reste.

**Pièges** : ⚠️ oublier `.strict()` (par défaut, Zod **retire** silencieusement les champs en trop au lieu de rejeter l'objet) ; ⚠️ un champ `z.string()` sans format ni longueur rouvre le catalogue.
