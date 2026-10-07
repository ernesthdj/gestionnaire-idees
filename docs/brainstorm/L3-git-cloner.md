# Niveau 3 — Conception Technique : GIT-C — Cloner par lien et suivre les mises à jour
> Basé sur : L1i-git-github.md + L2-git-cloner.md + L3-reprise-import.md (§1 `reprise:clone`, §3 séquence) +
> spec 017 US5 (FR-008 à FR-011) + spec 020 research R7 + L3-git-depot-local.md (socle) · Date : 2026-10-07

## 1. Réconciliation : un seul service de clone
Trois documents décrivent un clone : `L3-reprise-import.md` (clone complet, 30 min, dossier choisi),
`L3-skills-importer.md` / spec 020 R7 (`--depth 1`, quarantaine, 5 min) et ce lot (historique complet pour G3). On
garde **un seul** `CloneService` (et le pur `gitUrl.ts`), livré par la première spec codée, avec un **profil** :

| Profil | Appelant | Options git | Destination | Délai | Bornes |
|--------|----------|-------------|-------------|-------|--------|
| `superficiel` | Import de skills (spec 020) | `--depth 1 --single-branch` | `<profil>/skill-quarantine/<id>/` | 5 min | 50 Mo, 2 000 fichiers (contrôle après clone) |
| `historique` | Reprise par lien (spec 017 US5, ce lot) | `--filter=blob:none` (clone partiel) ; option « tout télécharger » → aucun filtre | dossier parent choisi au sélecteur natif + sous-dossier | 30 min | avertissement à 500 Mo reçus (pause « Continuer / Annuler ») |

Options **communes** (non négociables, quel que soit le profil) :
```
git -c protocol.allow=never -c protocol.https.allow=always -c protocol.ssh.allow=always
    -c core.hooksPath=<profil>/git-empty-hooks -c core.fsmonitor=false -c core.quotepath=off
    clone --no-recurse-submodules --progress <options du profil> -- <url> <cible>
```
`GIT_TERMINAL_PROMPT=0`, `LC_ALL=C` ; progression lue sur la sortie d'erreur (`Receiving objects: 42%`) ; annulation
par `AbortSignal` (arrêt du processus puis suppression du seul dossier créé).

> Mise à jour à reporter, au moment de coder, dans `specs/020-arbre-de-skills/research.md` R7 et dans les tâches de la
> spec 017 US5 : « `CloneService` à profils ; R7 = profil `superficiel` ». (Ce document ne modifie pas les specs.)

## 2. Contrat IPC
On **garde les canaux de la spec 017** (`L3-reprise-import.md` §1) et on les complète ; pas de canal de clone en
double.

| Canal | Entrée | Sortie (`data`) | Erreurs |
|-------|--------|-----------------|---------|
| `reprise:clone` (existant, complété) | `{ url: string ≤ 500, folderName?: string ≤ 100, full?: boolean }` + sélecteur natif du dossier parent dans le main | `{ cloneId }` ou `null` (sélecteur annulé) | `URL_REFUSED`, `GIT_MISSING`, `TARGET_EXISTS`, `TARGET_REFUSED` (dossier de données), `BUSY` |
| `reprise:cloneProgress` (événement) | — | `{ cloneId, phase: 'connexion' \| 'reception' \| 'resolution' \| 'extraction', percent?, receivedBytes? }` | — |
| `reprise:cloneLarge` (événement, nouveau) | — | `{ cloneId, receivedBytes }` → l'UI demande « Continuer / Annuler » | — |
| `reprise:cloneContinue` (nouveau) | `{ cloneId }` | `{}` | `NOT_FOUND` |
| `reprise:cancelClone` (existant) | `{ cloneId }` | `{}` | `NOT_FOUND` |
| `reprise:cloneDone` / `cloneFailed` (existants) | — | `{ cloneId, previewId }` / `{ cloneId, code }` | codes : `AUTH_FAILED`, `NOT_FOUND`, `NETWORK`, `CANCELLED`, `TIMEOUT`, `FAILED` |
| `git:updates` (nouveau) | `{ genesisId }` | `{ since: string \| null, lastSeen: hash \| null, commits: { hash, authorKey, date, subject, files: number }[], authors: AuthorView[], modules: { nodeId, commits }[] }` | `NO_REMOTE` |
| `git:markSeen` (nouveau) | `{ genesisId, hash }` | `{}` | `NOT_FOUND` |

- `folderName` : `^[A-Za-z0-9._-]{1,100}$`, ni `.` ni `..`, proposé = nom du dépôt tiré de l'URL.
- La « pause » au seuil : le main suspend la lecture de la progression et attend `cloneContinue` ; git continue de
  recevoir (pas de pause réseau réelle) ; sans réponse en 5 min → annulation. *Variante plus simple à trancher au
  plan : avertir seulement, sans pause.*

## 3. `gitUrl.ts` (pur, testé)
- Accepte `https://<hôte>/<chemin>` (port facultatif) et `git@<hôte>:<chemin>` ; `ssh://git@<hôte>/<chemin>` accepté
  aussi (même transport) ; tout le reste refusé : `ext::`, `fd::`, `file://`, chemin local, `http://` (en clair), URL
  commençant par `-`, caractère de contrôle ou espace, `<hôte>` vide, chemin contenant `..`.
- Identifiant (`https://user:jeton@…`) : **retiré** pour l'affichage, le journal et la base ; l'URL complète n'est passée
  qu'à git, une fois, jamais stockée.
- Sortie : `{ ok: true, url (pour git), display (sans identifiant), host, owner?, repo? } | { ok: false, reason }`.
- Le transport est revérifié par git lui-même (`protocol.allow=never` sauf https et ssh) : double barrière.

## 4. Données
- `code_projects` (spec 017, existant) : `source = 'git'`, `remote_url` (sans identifiant).
- `git_repos` (socle) : ligne créée à la fin du clone avec `remote_url`, `github_repo` (si hôte `github.com`),
  `last_seen_commit` = HEAD cloné, `last_fetch_at` = fin du clone.
- `git_operations` : `kind = clone`, `status`, `error_code`, durée — jamais l'URL avec identifiant ni le chemin complet
  (spec 017 FR-031).
- Le dépôt cloné **n'est pas** inscrit dans `trusted_projects` (hooks jamais lancés) ; mentalyas peut l'y mettre plus
  tard depuis les réglages du projet (spec 014), avec l'avertissement existant.
- Clone en cours au moment où l'app se ferme : la cible est inscrite **avant** le lancement dans une table légère
  `git_clones_running(id PK, target_dir, started_at)` (même migration « git », `down` : `DROP`) et retirée à la fin ;
  au démarrage, chaque cible encore inscrite est supprimée (elle n'existait pas avant le clone, vérifié au lancement),
  puis la ligne est effacée.

## 5. Diagramme de séquence
```mermaid
sequenceDiagram
    actor U as mentalyas
    participant R as Renderer (Reprendre un projet)
    participant M as Main (CloneService profil historique)
    participant D as Dialogue natif
    participant G as git
    U->>R: colle l'URL
    R->>M: reprise:clone { url, folderName }
    M->>M: gitUrl : https / git@ / ssh:// seulement
    M->>D: dossier parent (pré-positionné)
    D-->>M: parent choisi (realpath, pas le dossier de données)
    M->>M: cible inexistante ; git_clones_running
    M->>G: clone --filter=blob:none --no-recurse-submodules (hooks vides) -- url cible
    loop progression
      G-->>M: Receiving objects: n%
      M-->>R: reprise:cloneProgress
    end
    alt annulation / échec / délai
      M->>M: arrêt, suppression de la seule cible
      M-->>R: reprise:cloneFailed { code }
    else succès
      M->>M: git_repos (last_seen_commit = HEAD)
      M-->>R: reprise:cloneDone { previewId } → aperçu, confidentialité (spec 017)
    end
```
Suivre les mises à jour : `git:updates` = fetch (lot B) puis `log --format=… -z --name-only --no-renames
<last_seen>..@{upstream}` ; correspondance fichiers → nœuds de la cartographie (fonction pure partagée avec le lot D).

## 6. Cas limites techniques
- **Concurrence :** un clone à la fois (`BUSY`), tous profils confondus (un import de skills attend la fin d'une
  reprise).
- **Idempotence :** `reprise:clone` rejoué vers la même cible → `TARGET_EXISTS`.
- **Rollback :** suppression **uniquement** du dossier que l'app a créé (chemin enregistré avant le lancement,
  comparaison exacte) ; jamais du dossier parent ; échec de suppression → message avec le chemin à nettoyer.
- **Clone partiel :** les commandes qui lisent d'anciens contenus (`diff` d'un vieux commit, `blame`) déclenchent un
  téléchargement ; elles passent par le même profil sûr (protocoles limités) ; hors ligne → message clair.
- **Historique réécrit en amont** (force-push de l'auteur) : `merge --ff-only` échoue ; l'app l'explique et propose de
  recloner ; elle ne fait jamais `reset --hard`.
- **Volumétrie :** dépôts de plusieurs Go : avertissement au seuil ; espace disque libre vérifié avant (< 2 Go libres →
  avertissement).
- **Noms de fichiers Windows invalides** (`aux.js`, `:` dans un nom) : git les refuse à l'extraction ; message, dossier
  nettoyé.

## 7. Sécurité spécifique
| Risque | Vecteur | Mitigation |
|--------|---------|------------|
| Exécution de commande à l'adresse | `ext::sh -c …`, `--upload-pack=…` | `gitUrl.ts` + `protocol.allow=never` sauf https / ssh + `--` avant l'URL |
| Code exécuté au clone | hooks, sous-modules, filtres LFS, `post-checkout` | `core.hooksPath` vide, `--no-recurse-submodules`, aucun `npm install` ni script ; config locale créée par git (aucune clé à risque) |
| Écriture hors de la cible | Chemins piégés dans le dépôt (`..`, liens symboliques) | Protections natives de git (`core.protectNTFS`, `core.protectHFS` actives par défaut sous Windows), git à jour conseillé (version minimale affichée) |
| Fuite d'identifiants | URL avec jeton | Retirés partout sauf l'unique argument passé à git ; jamais journalisés |
| Instructions cachées pour Claude | README, messages de commit | Données balisées dans tous les cadres ; projet « Local uniquement » possible dès l'aperçu |
| Dossier de données exposé | Cible dans `%APPDATA%/gestionnaire-idees` | `TARGET_REFUSED` (constitution I) |
