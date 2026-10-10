---
type: glossaire
subject: Concurrence optimiste — ne pas verrouiller pendant qu'on regarde, mais refuser l'action si l'état a changé depuis qu'on l'a vu (empreinte ou version attendue renvoyée avec l'action)
tags: [#glossaire, #concurrence, #securite, #git, #base-de-donnees]
date: 2026-10-10
niveau: intermédiaire
---

# Concurrence optimiste (agir sur l'état vu)

> **En 30 secondes** — Tu regardes un aperçu (« 3 commits à pousser »), puis tu cliques. Entre les deux, quelque chose a pu changer (un autre programme, Claude, un `git pull`). Plutôt que de **tout bloquer** pendant que tu regardes, l'app renvoie avec ton clic **ce que tu as vu** (une empreinte, un numéro de version) ; le serveur compare avec l'état actuel et **refuse** s'ils diffèrent. Tu revois l'aperçu, et tu recliques en connaissance de cause.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : deux façons d'éviter d'agir sur un état périmé. **Pessimiste** : verrouiller pendant toute la lecture (personne d'autre ne peut écrire) — lourd, et un humain qui part en pause bloque tout. **Optimiste** : ne rien bloquer, **vérifier au moment d'écrire**. On parie que le conflit est rare, et on le détecte quand il arrive.
- **Analogie (restauration)** : le client commande « le plat du jour à 14 € » affiché sur l'ardoise. La caisse vérifie au moment de l'encaissement : si le chef a changé l'ardoise entre-temps (16 €), on ne débite pas en silence — on **redemande** au client.
- **À ne pas confondre** avec la [[Glossaire — Mise à jour optimiste]] (côté interface : **afficher** avant la confirmation du serveur). Même mot « optimiste », autre problème.

## 2. Comment ça marche (sous le capot)
1. **Lecture** : le serveur renvoie l'état **et** son identifiant de version (empreinte du contenu, hash du commit HEAD, compteur).
2. **Action** : le client renvoie l'identifiant **qu'il a vu** (`expected…`).
3. **Écriture** : dans la même section critique (transaction, file d'écriture), le serveur relit l'identifiant actuel ; égal → il agit ; différent → refus explicite (« l'état a changé »).
L'étape 3 doit être **atomique** : vérifier puis écrire sans que rien ne s'intercale — d'où la transaction SQLite ou la `GitWriteQueue`.

## 3. En pratique (dans ce projet)
| Où | Ce qui est renvoyé | Refus si |
|----|--------------------|----------|
| Push (spec 021) | `expectedHead`, `expectedRemote` | la branche ou le distant ont bougé depuis l'aperçu |
| Fusion après « tirer » | `expectedUpstreamHead` | le distant a reçu d'autres commits |
| Conflit résolu | `expectedPreviewHash` | l'aperçu du fichier n'est plus celui affiché |
| Brouillon de skill (spec 020) | `baseHash` | le skill installé a changé depuis le brouillon |
| Réglages d'un widget (spec 026) | `versionId` | la version affichée n'est plus la courante |

## Utilisé dans ce cours
- [[Git piloté par l'app — préfixe sûr, arguments construits, configuration piégée et push gardé]] — push et fusion sur l'état vu.
- [[Conflit de fusion — trois versions lues dans l'index, blocs à décider et aperçu validé]] — `previewHash`.
- [[Brouillon puis installation — trois verrous, versions par empreinte et retour arrière]] — `baseHash`.
- [[Annuler par lot — journal avant-après, conflit et lot inverse]] — même idée : annuler seulement si l'état actuel est bien l'« après » du lot.

## Retenir et vérifier
- **À retenir** : ne pas bloquer pendant qu'on regarde ; **refuser** si ce qu'on a vu n'est plus vrai au moment d'agir.
> **Q :** Pourquoi ne pas simplement relire l'état juste avant d'agir, sans rien renvoyer du client ? **R :** On agirait sur l'état **actuel**, que l'humain n'a **pas vu** : il a validé « 3 commits », on en pousserait 5.

**Pièges** : ⚠️ comparer puis écrire **en deux temps** hors de toute section critique — un autre écrivain peut s'intercaler entre les deux (condition de course).
