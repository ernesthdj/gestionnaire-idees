---
type: glossaire
subject: Principe du moindre privilège — chaque acteur (processus, page, agent IA) reçoit exactement les droits nécessaires à sa tâche, pas un de plus ; restreindre par capacité plutôt que par consigne
tags: [#glossaire, #securite, #ia, #architecture]
date: 2026-10-07
niveau: débutant
---

# Principe du moindre privilège

> **En 30 secondes** — Donner à chaque acteur **exactement** les droits nécessaires à sa tâche, et **rien de plus**. Si l'acteur est piégé ou se trompe, les dégâts sont limités à ce qu'il avait le droit de faire. Pour un agent IA, cela veut dire : lui **retirer** les outils dont il n'a pas besoin, plutôt que lui **demander** de ne pas s'en servir.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : tout composant peut être compromis — une page web par une faille XSS, un agent IA par une injection de prompt cachée dans un fichier. On ne peut pas garantir qu'il restera honnête ; on peut garantir **ce qu'il est capable de faire**.
- **Analogie (multiprise / électricité)** : chaque pièce a son **disjoncteur** dimensionné pour ses appareils. Un court-circuit dans la salle de bain coupe la salle de bain, pas toute la maison. Un agent avec tous les droits, c'est une maison sur un seul disjoncteur de 63 A.

## 2. Comment ça marche (sous le capot)
Le privilège se retire à **plusieurs étages**, chacun indépendant du bon vouloir de l'acteur :
| Étage | Mécanisme | Ce qui est retiré |
|-------|-----------|-------------------|
| Processus | Renderer Electron isolé, `sandbox`, pas de Node | Accès disque, réseau, système |
| Page | CSP, iframe `sandbox` sans `allow-same-origin` | Scripts externes, lecture du parent |
| Agent IA | `--tools "Read Glob Grep"`, `--setting-sources ""`, pas de serveur MCP | Écriture, commandes, hooks du dépôt |
| Fichiers | Dossiers autorisés = `[worktree]`, écritures sous `node_modules` refusées | Tout le reste du disque |

**Capacité contre consigne** : une consigne (« ne modifie rien ») est une **demande** que le modèle peut ignorer ; une capacité absente (aucun outil d'écriture) est une **impossibilité**.

## 3. En pratique
```text
Analyste (lecture)       : Read, Glob, Grep                     — rien d'autre n'existe
Codage d'une mise à jour : écrire dans le worktree sans demande — commandes demandées à l'humain
Conversation ordinaire   : lecture et carte d'office            — le reste demandé (permissions relayées)
```

## Utilisé dans ce cours
- [[Analyste en lecture seule — moindre privilège et propositions vérifiées]] — outils de lecture seulement.
- [[Permissions relayées — l'humain dans la boucle d'un agent]] — lecture d'office, le reste demandé.
- [[Bac à sable des widgets — iframe isolée, origine opaque et protocole gi-widget]] — cinq barrières qui retirent chacune un pouvoir.
- [[Architecture Electron — trois processus cloisonnés]] — le renderer n'a pas Node.

## Retenir et vérifier
- **À retenir** : le minimum de droits pour la tâche ; retirer la **capacité**, pas seulement l'interdire ; plusieurs étages indépendants.
> **Q :** Pourquoi l'Analyste n'a-t-il pas l'outil `Bash` « juste pour lancer les tests » ? **R :** Lancer les tests n'est pas sa tâche (il analyse) ; avec `Bash`, une injection pourrait lancer n'importe quelle commande. Les tests sont lancés plus tard, par l'app elle-même, dans le worktree.

**Pièges** : ⚠️ accorder « tout, pour être tranquille » pendant le développement et oublier de restreindre ; ⚠️ croire qu'un dossier de travail (`cwd`) est une barrière — un chemin absolu en sort.

## Évolution du 08/10 — deux nouveaux étages
- **Conversations Skills** : ni `Write`, ni `Edit`, ni `Bash`, **quel que soit le mode de permission** ; seuls les outils MCP `skills_lire` et `skill_brouillon` répondent → [[Brouillon puis installation — trois verrous, versions par empreinte et retour arrière]].
- **Audit d'un skill importé** : Claude **sans aucun outil**, le texte en donnée → [[Audit d'un contenu importé — règles fixes, IA sans outil et le plus sévère l'emporte]].
- ⚠️ Le piège « un `cwd` n'est pas une barrière » est désormais **prouvé** : `--tools` ne borne pas les chemins, seules des règles de refus le font (preuve R1, bloc « Évolution du 07→08/10 » de [[Analyste en lecture seule — moindre privilège et propositions vérifiées]]).
