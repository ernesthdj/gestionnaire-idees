---
type: glossaire
subject: Interrupteur de fonctionnalité (feature flag) — une constante unique qui allume ou coupe une fonction entière sans effacer son code, ses tests ni ses migrations ; exemple FOLDERS_ENABLED (spec 028 « Le dossier du nœud », mise en pause le 12/10)
tags: [#glossaire, #architecture, #specs, #maintenance]
date: 2026-10-13
niveau: intermédiaire
---

# Interrupteur de fonctionnalité (feature flag)

> **En 30 secondes** — Le 12/10, les lots 1 et 2 de la spec 028 (un dossier de verre relié à chaque nœud) étaient codés et testés. Sur la vraie carte, mentalyas a tranché : « joli mais inutile ici, on le réutilisera ailleurs ». Plutôt qu'effacer ou laisser à moitié branché, une **seule constante** `FOLDERS_ENABLED = false` coupe la fonction partout ; l'app retrouve **exactement** son comportement d'avant. Rallumer = changer un mot.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : une fonction peut être finie mais pas voulue (maintenant), ou voulue mais pas finie. L'effacer perd le travail ; la laisser active impose un comportement non validé ; une branche git à part diverge vite du reste.
- **Analogie** (électricité) : un circuit entier de la maison posé derrière **un seul disjoncteur** du tableau. Couper le disjoncteur éteint toutes les prises de ce circuit d'un geste ; les câbles restent dans les murs, prêts. Où ça boite : si une prise de ce circuit a été branchée **sur un autre** disjoncteur par erreur (un endroit qui ne lit pas la constante), elle reste sous tension — d'où l'importance de **tous** les points de lecture.

## 2. Comment ça marche (sous le capot)
- **Constante de compilation**, pas réglage : `export const FOLDERS_ENABLED = false` dans `src/shared/ipc/folders.ts`, lue par le **main** et le **renderer** (même module partagé). Le bundler peut même éliminer les branches mortes (`false ? … : …`).
- **Points de lecture** (tous au **démarrage** ou à la **description**) : `bootstrap.ts` (canevas, suivi des écritures de conversation, canaux `folder:*` non enregistrés), `document_ecrire` (option `allNodes`), la description de l'outil MCP et la consigne de conversation (Claude ne doit pas entendre parler d'une fonction coupée), la vue de la carte.
- **Ce qui reste** : code, tests (ceux des dossiers construisent leurs services directement, sans passer par l'interrupteur — ⚠️ *Probable*, d'après les 2 104 tests verts du JOURNAL), migrations 0047-0048 **déjà appliquées** sur la base de mentalyas, sans effet tant que rien ne les lit. Le test e2e `node-folder.e2e.ts` ne tourne que dossiers allumés.

## 3. En pratique
```ts
// src/main/bootstrap.ts — on n'enregistre même pas la dépendance quand c'est coupé
const canvas = new CanvasService({
  ...(FOLDERS_ENABLED ? { folders } : {}),          // coupé : CanvasService ne connaît pas les dossiers
  plan: planRepository,
  /* … */
})
```
- Le motif `...(flag ? { dep } : {})` **retire la capacité** au lieu d'ajouter des `if (flag)` dans le service → [[Glossaire — Principe du moindre privilège]].

## Utilisé dans ce cours
- Spec 028 « Le dossier du nœud » (en pause) ; parenté avec la constitution « amender la spec d'abord » : la pause est **inscrite** dans `CLAUDE.md` et la spec → [[Du brainstorm au code — spécifications et constitution]].
- La règle apprise du JOURNAL : « une fonction visuelle se juge sur la vraie carte **avant** d'en coder la suite ; le MVP a suffi à trancher ».

## Retenir et vérifier
- **À retenir** : un interrupteur = **un** endroit qui décide, lu par **tous** les points d'entrée (y compris ce que l'IA lit), et un état « coupé » identique à l'avant.
> **Q :** Pourquoi couper aussi la description de l'outil MCP et la consigne de Claude ? **R :** Sinon Claude proposerait de ranger un fichier dans un dossier qui n'existe pas à l'écran — la limite doit être dite à l'IA, pas seulement cachée dans l'interface.
> **Q :** Que coûtent les migrations 0047-0048 laissées en place ? **R :** Deux tables vides et non lues ; les supprimer obligerait à une migration de plus, et à la refaire au rallumage.

**Pièges** : ⚠️ un interrupteur lu à un seul endroit pendant que d'autres chemins restent actifs ; ⚠️ des interrupteurs qui s'accumulent pour toujours (chaque interrupteur est une dette : à rallumer ou à retirer).
