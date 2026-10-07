---
type: glossaire
subject: Minimisation des données (ne collecter que ce qui sert le but) et pseudonymisation (remplacer un identifiant par un pseudonyme réversible seulement avec une information gardée à part) — différence avec l'anonymisation
tags: [#glossaire, #vie-privee, #rgpd, #securite]
date: 2026-10-07
niveau: intermédiaire
---

# Pseudonymisation et minimisation des données

> **En 30 secondes** — **Minimiser**, c'est ne collecter **que** ce qui sert le but. **Pseudonymiser**, c'est remplacer un identifiant réel par un **pseudonyme** (`3fa9c1…`) qu'on ne peut relier à la personne ou à l'objet **qu'avec une information gardée à part** (une clé, une table). **Anonymiser**, c'est rendre ce lien **impossible pour tout le monde**, y compris soi-même. Le RGPD (*Règlement général sur la protection des données*) traite encore une donnée pseudonymisée comme personnelle ; une donnée vraiment anonyme, non.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : pour repérer une friction (« le même neurone rouvert 6 fois en 2 minutes »), l'Analyste doit savoir que c'est **le même** objet… sans savoir **lequel**. Et pour le reste, la meilleure donnée personnelle est celle qu'on **n'a pas** : on ne peut ni la perdre, ni la fuiter.
- **Analogie (restauration)** : le ticket de cuisine dit « **table 4** », pas « M. et Mme Dupont ». La cuisine suit la commande de bout en bout (pseudonyme) ; seule la salle sait qui est à la table 4 (l'information à part). Et la cuisine n'a jamais besoin de connaître la conversation des clients (minimisation).

## 2. Comment ça marche (sous le capot)
| Technique | Lien avec la donnée réelle | Exemple dans le projet |
|-----------|---------------------------|-------------------------|
| **Minimisation** | La donnée n'est jamais collectée | Catalogue fermé de la sonde : aucun champ de texte, jamais le message d'une erreur |
| **Pseudonymisation** | Possible **avec la clé** (gardée à part, chiffrée) | `subject_ref = HMAC(clé, "ref:" + id)`, l'identifiant réel est jeté après calcul |
| **Masquage / remplacement** | Retiré d'un texte avant envoi | Ancienne [[Anonymisation en deux couches]] : regex + IA locale avant Claude (module retiré le 05/10) |
| **Agrégation** | Seuls des comptes sortent | Le dossier de l'Analyste envoie « ×14 en 7 jours », jamais les événements ni les pseudonymes |

## 3. En pratique
```text
événement brut (jamais stocké) : { action: "ouvrir", neuronId: "n_8c2e…", titre: "Cadeau anniversaire" }
observation stockée            : { event: "neuron.open", subjectKind: "neuron", subjectRef: "3fa9c1d2e7b0", via: "souris" }
envoyé à Claude                : obs:aller:4  carte → chat → carte < 10 s ×19
```

## Utilisé dans ce cours
- [[Sonde sans contenu — télémétrie minimisée, empreintes HMAC et pseudonymes]] — les trois techniques ensemble.
- [[Anonymisation en deux couches]] — l'approche précédente : nettoyer un texte qui devait partir.
- [[Analyste en lecture seule — moindre privilège et propositions vérifiées]] — seuls des agrégats sortent de la machine.

## Retenir et vérifier
- **À retenir** : minimiser d'abord (ne pas collecter) ; pseudonymiser ce qui doit être suivi ; un pseudonyme **n'est pas** anonyme tant qu'une clé existe.
> **Q :** Si la clé HMAC est détruite, les pseudonymes deviennent-ils anonymes ? **R :** Le lien par calcul disparaît, mais un pseudonyme stable peut encore être recoupé avec d'autres indices (horaires, séquences) ; c'est pourquoi on garde aussi peu d'événements que possible, et pas longtemps (30 jours).

**Pièges** : ⚠️ appeler « anonyme » une donnée hachée sans clé (dictionnaire) ou pseudonymisée (clé) ; ⚠️ oublier qu'un message d'erreur, un nom de fichier ou une URL peuvent contenir du contenu personnel.
