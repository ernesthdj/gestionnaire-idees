---
type: glossaire
subject: FTS5 — recherche plein texte de SQLite
tags: [#glossaire, #sqlite, #recherche, #securite]
date: 2026-09-28
niveau: intermédiaire
---

# FTS5 (recherche plein texte)

> **En 30 secondes** — FTS5 (*Full-Text Search*, version 5) est un module de SQLite qui construit un **index inversé** : pour chaque mot, la liste des lignes qui le contiennent. Chercher « ecran » parmi des milliers d'idées devient instantané, insensible aux accents, avec recherche par préfixe (`ecr*`).

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : `WHERE title LIKE '%ecran%'` lit **toutes** les lignes une par une, rate « écran » (accent) et ne sait pas classer. Il faut un vrai moteur de recherche, mais sans serveur externe.
- **Analogie (restauration)** : l'**index alphabétique** à la fin d'un livre de recettes : au lieu de feuilleter tout le livre pour « chocolat », on va à la lettre C et on lit les numéros de pages.

## 2. Comment ça marche (sous le capot)
Une **table virtuelle** `neurons_fts` stocke l'index (sur disque, dans le même fichier chiffré). Le *tokenizer* `unicode61 remove_diacritics 2` découpe les mots et retire les accents. Des **déclencheurs** (*triggers* : du SQL exécuté automatiquement après un INSERT/UPDATE/DELETE) tiennent l'index synchronisé avec la table `neurons` — le code applicatif n'a rien à faire.

## 3. En pratique
```sql
CREATE VIRTUAL TABLE `neurons_fts` USING fts5(`neuron_id` UNINDEXED, `title`, `content`,
  tokenize = 'unicode61 remove_diacritics 2');
CREATE TRIGGER `neurons_fts_insert` AFTER INSERT ON `neurons` WHEN new.`kind` = 'root' BEGIN
  INSERT INTO `neurons_fts` (`neuron_id`, `title`, `content`) VALUES (new.`id`, new.`title`, coalesce(new.`content`, ''));
END;
```
```ts
// La saisie n'est JAMAIS passée brute à MATCH : mots extraits, cités et en préfixe
export function toFtsQuery(search: string): string | null {
  const words = search.match(/[\p{L}\p{N}]+/gu)
  return words === null ? null : words.slice(0, 8).map((w) => `"${w}"*`).join(' ')
}
```

## Utilisé dans ce cours
- [[Liens entre idées — graphe local de mots-clés]] — l'autre recherche locale « sans IA » du projet.
- [[Drizzle ORM ↔ SQL paramétré et migrations]] — la requête `MATCH` reste paramétrée (`${query}` lié).

## Retenir et vérifier
- **À retenir** : index inversé ; accents retirés ; synchronisé par triggers ; saisie toujours transformée avant `MATCH`.
> **Q :** Pourquoi citer chaque mot (`"mot"*`) même si la requête est paramétrée ? **R :** Le paramètre empêche l'injection SQL, mais FTS5 interprète **sa propre** syntaxe (`OR`, `NEAR`, `-`) dans la valeur ; citer neutralise ces opérateurs.

**Pièges** : ⚠️ oublier le script `down` qui supprime triggers **et** table virtuelle — il existe ici (`0004_neurons_seed_fts.down.sql`).
