---
name: journal
description: "Journal de bord du projet — consigne chaque modification de code dans docs/JOURNAL.md et capitalise les règles apprises et les erreurs corrigées."
---

# /journal — Journal de bord du projet

## Déclenchement automatique

Après **chaque modification de code** (feat, fix, refactor, base de données, configuration, docs), ajouter une entrée
à `docs/JOURNAL.md` — sans attendre qu'on le demande. Lire les dernières entrées avant d'agir : c'est la mémoire du
projet.

## Format d'une entrée (ajoutée en fin de fichier)

```
### [AAAA-MM-JJ HH:MM] TYPE — sujet (spec NNN Txxx si applicable)
**Fichiers :** `chemin/fichier.ts` (ce qui change), … ; tests ajoutés. N tests.
**Quoi :** ce qui a été fait, du point de vue de l'utilisateur.
**Pourquoi ainsi :** les choix techniques et leur raison (sécurité, simplicité, alternative écartée).
**Erreur corrigée :** symptôme / cause / correctif (seulement si l'entrée corrige un bug).
**Règle apprise :** règle générale réutilisable (seulement s'il y en a une).
```

Types : `FEAT` · `FIX` · `REFACTOR` · `DB` · `CONFIG` · `DOCS` · `SECURITY`.

Quand une erreur révèle une règle générale réutilisable (pas propre à ce bug), l'ajouter aussi au tableau
**Règles apprises** en tête de fichier (numéro suivant, fichier(s), date).

## Commandes

| Commande | Action |
|----------|--------|
| `/journal` | Affiche les 10 dernières entrées |
| `/journal regles` | Affiche le tableau « Règles apprises » |
