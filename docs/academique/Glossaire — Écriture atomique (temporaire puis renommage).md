---
type: glossaire
subject: Écriture atomique d'un fichier (temporaire puis renommage) et création exclusive (wx)
tags: [#glossaire, #fichiers, #fiabilite, #systeme]
date: 2026-10-06
niveau: intermédiaire
---

# Écriture atomique (temporaire puis renommage)

> **En 30 secondes** — Écrire un fichier « atomiquement », c'est faire en sorte qu'un lecteur voie **soit l'ancien contenu entier, soit le nouveau entier**, jamais un mélange ou un fichier tronqué. La recette : écrire dans un fichier **temporaire du même dossier**, puis le **renommer** par-dessus la cible. Cousine : la création **exclusive** (`wx`), qui échoue si le fichier existe déjà.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : une coupure de courant ou un plantage au milieu d'un `writeFileSync` laisse un fichier à moitié écrit — un JSON illisible, un document coupé. C'est la version « disque » du tout-ou-rien d'une [[Glossaire — Transaction ACID]].
- **Analogie (restauration)** : on ne remplit pas la vitrine plat par plat devant les clients : on dresse le **plateau complet en cuisine** (fichier temporaire), puis on **échange** le plateau en vitrine d'un seul geste (renommage).

## 2. Comment ça marche (sous le capot)
Les octets sont écrits dans les blocs du `.tmp` ; le renommage, dans le même volume, ne copie rien : il **remplace l'entrée de répertoire** qui pointe vers les données, opération que le système de fichiers traite d'un seul tenant. Renommer vers **un autre lecteur** n'est plus un renommage (copie + suppression) : d'où le temporaire dans le **même dossier**. `wx` demande au système de créer le fichier **seulement s'il n'existe pas** — le test et la création ne font qu'une opération, sans fenêtre de course.

## 3. En pratique
```ts
const temporary = join(dir, `.${fileName}.${randomUUID()}.tmp`) // même dossier, nom unique
try {
  writeFileSync(temporary, content, 'utf8')
  renameSync(temporary, path)                                     // bascule d'un coup
} finally {
  if (existsSync(temporary)) rmSync(temporary, { force: true })   // pas de .tmp orphelin
}
writeFileSync(path, scaffold, { encoding: 'utf8', flag: 'wx' })    // créer sans jamais écraser
```

## Utilisé dans ce cours
- [[Fichiers écrits par l'app — chemin choisi par le main, écriture atomique, corbeille]] — documents, registre ProjectMaster, dossier d'un nouveau projet.

## Retenir et vérifier
- **À retenir** : temporaire **dans le même dossier** + `rename` ; `wx` pour créer sans écraser.
> **Q :** Pourquoi `if (!existsSync(p)) writeFileSync(p, …)` n'est-il pas équivalent à `flag: 'wx'` ? **R :** Entre le test et l'écriture, un autre processus peut créer le fichier ; `wx` fait les deux en une seule opération du système.

**Pièges** : ⚠️ temporaire dans le dossier temporaire du système puis renommage vers le projet — sur un autre lecteur, ce n'est plus atomique.

## Évolution du 08/10 — un dossier entier, et la limite de Windows
- **Dossier atomique** (skills, `SkillStore.replace`) : préparer le dossier complet dans `.tmp-<uuid>` **à côté**, renommer l'ancien en `.old-<uuid>`, mettre le nouveau à sa place, supprimer l'ancien ; échec au milieu → l'ancien reprend sa place. → [[Brouillon puis installation — trois verrous, versions par empreinte et retour arrière]]
- **Limite** : sous Windows, un dossier dont un fichier est **ouvert** ne se renomme pas (`EPERM`). Pour la bibliothèque de skills, lue par l'app, on a donc abandonné le renommage : nouvelle version écrite à côté, **référence basculée en base**, ancienne supprimée au mieux. → [[Glossaire — Verrou de fichier sous Windows (EPERM, EBUSY)]]

## Évolution du 09/10 — le fichier résolu d'un conflit
- `ConflictService.resolveFile` écrit l'aperçu validé dans un fichier temporaire **à côté**, puis le renomme sur le fichier du projet (`writeFileSync` + `renameSync`) : l'éditeur ou le serveur de dev du projet ne voit jamais un fichier à moitié écrit. Avant d'écrire, l'app vérifie que l'aperçu est **celui affiché** (empreinte) et qu'il ne reste **aucun marqueur** `<<<<<<<`. → [[Conflit de fusion — trois versions lues dans l'index, blocs à décider et aperçu validé]]
