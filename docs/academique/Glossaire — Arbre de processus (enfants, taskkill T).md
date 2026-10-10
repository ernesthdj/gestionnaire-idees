---
type: glossaire
subject: Arbre de processus — un programme lance des enfants qui lancent des petits-enfants ; arrêter le parent ne suffit pas, il faut arrêter l'arbre (taskkill /T sous Windows)
tags: [#glossaire, #processus, #windows, #systeme]
date: 2026-10-10
niveau: intermédiaire
---

# Arbre de processus (enfants, taskkill /T)

> **En 30 secondes** — Quand un programme en lance un autre, le système note le lien **parent → enfant**. `npm run dev` = `node` (npm) → shell → `vite` → parfois Electron… Un **arbre**. Sous Windows, tuer le parent **ne tue pas** ses enfants : ils deviennent **orphelins** et continuent (port occupé, fichiers verrouillés). Il faut tuer **l'arbre entier** : `taskkill /PID <pid> /T /F`.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : l'app ne voit que **son** enfant direct (le `ChildProcess` renvoyé par `spawn`). Les descendants sont lancés par lui, pas par l'app. « Arrêter » qui ne tue que le premier laisse le vrai serveur tourner.
- **Analogie (électricité)** : une multiprise branchée sur une multiprise branchée sur une prise murale. Débrancher **seulement** la première fiche du mur… mais si la deuxième multiprise a sa propre alimentation de secours (un orphelin), ses appareils restent allumés. `taskkill /T` = couper le **disjoncteur du circuit** : tout ce qui est en aval s'éteint.

## 2. Comment ça marche (sous le capot)
- **Le noyau** garde pour chaque processus un **PID** (identifiant) et le PID de son **parent**. C'est ce lien qui forme l'arbre.
- **Unix** : on peut regrouper l'arbre dans un *groupe de processus* et envoyer un signal au groupe entier. **Windows** n'a pas ce réflexe par défaut : `child.kill()` (Node) termine **un** processus.
- **`taskkill /T`** parcourt les descendants à partir du PID donné et les termine tous ; **`/F`** force (pas de demande polie de fermeture, inutile pour un processus sans fenêtre).
- **Sécurité** : `taskkill.exe` est lancé **par chemin absolu** (`%SystemRoot%\System32\taskkill.exe`), sans shell — un `taskkill.exe` piégé dans le dossier courant ne serait pas pris.

## 3. En pratique
```ts
// infrastructure/process/ProcessRunner.ts
export function stopTree(child: ChildProcess): void {
  if (child.exitCode !== null || child.pid === undefined) return          // déjà fini, ou jamais lancé
  if (process.platform !== 'win32' || !isAbsolute(systemRoot)) { child.kill(); return }
  spawn(join(systemRoot, 'System32', 'taskkill.exe'), ['/pid', String(child.pid), '/T', '/F'],
        { shell: false, windowsHide: true, stdio: 'ignore' })
    .on('error', () => child.kill())                                       // repli : au moins le parent
}
```

## Utilisé dans ce cours
- [[Lancer un projet — processus de longue durée, sortie par lots bornée et arbre de processus]] — « Arrêter » et la fermeture de l'app (`stopAll`).
- [[Lancer un programme sans shell — chemin absolu, arguments séparés, listes blanches]] — même `ProcessRunner`, utilisé aussi au dépassement de délai d'une commande courte.
- [[Mise à jour réversible — worktree, branche, fusion no-ff et git revert]] — un processus vivant (la conversation de codage) tient une copie de travail ouverte : on l'arrête avant de la supprimer.

## Retenir et vérifier
- **À retenir** : arrêter un programme qui en lance d'autres = arrêter **l'arbre**, pas le parent.
> **Q :** Après « Arrêter », le prochain `npm run dev` dit « port 5173 déjà utilisé ». Diagnostic ? **R :** Seul le parent a été tué ; `vite`, orphelin, écoute encore. Il fallait `taskkill /T`.

**Pièges** : ⚠️ tuer par **nom** (`taskkill /IM node.exe`) au lieu du PID — on tuerait **tous** les `node` du poste, y compris ceux d'autres programmes.
