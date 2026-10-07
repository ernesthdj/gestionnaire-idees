---
type: glossaire
subject: HMAC (Hash-based Message Authentication Code) — empreinte calculée avec une clé secrète ; pourquoi un hash simple d'un texte court se retrouve par attaque par dictionnaire
tags: [#glossaire, #securite, #hachage, #vie-privee]
date: 2026-10-07
niveau: intermédiaire
---

# HMAC (empreinte à clé)

> **En 30 secondes** — Un **HMAC** (*Hash-based Message Authentication Code* — code d'authentification de message à base de hachage) est une empreinte calculée **avec une clé secrète** : `HMAC(clé, message)`. Même message + même clé → même empreinte ; sans la clé, impossible de calculer une seule empreinte. Il sert à **prouver** qu'un message vient de quelqu'un qui a la clé, ou, comme ici, à **comparer** des données sans qu'un voleur puisse les deviner.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : la sonde de l'Analyste veut repérer « la même tâche d'IA refaite 23 fois » sans garder le texte. Un `sha256(texte)` le permet… mais SHA-256 est **public et identique partout**. Pour un texte **court** (« oui », « acheter du pain »), un attaquant qui lit la base calcule `sha256` d'un **dictionnaire** de millions de phrases courantes et compare : c'est l'**attaque par dictionnaire**. L'empreinte simple d'un texte court n'est donc pas secrète.
- **Analogie (restauration)** : SHA-256, c'est classer les clients par **la première lettre de leur nom** : n'importe qui peut refaire le classement et deviner. HMAC, c'est un classement par **code maison** que seul le restaurant connaît : le même client a toujours le même code, mais sans le carnet de codes, on ne peut rien recalculer. *Où ça boite* : un code maison se devine parfois ; un HMAC avec une clé de 32 octets aléatoires, non.

## 2. Comment ça marche (sous le capot)
`HMAC(K, m) = H((K ⊕ opad) ‖ H((K ⊕ ipad) ‖ m))` : la clé est mélangée (XOR, « ou exclusif ») avec deux constantes, et le hachage est fait **deux fois**, la clé « enveloppant » le message. Cette double enveloppe protège contre une faiblesse des hachages de type SHA-2 (l'**extension de longueur** : prolonger un message sans connaître son début). Côté machine : deux passes SHA-256, quelques microsecondes sur le CPU. La **clé** est le seul secret : ici 32 octets tirés par `randomBytes`, chiffrés par DPAPI (`safeStorage`), jamais en base en clair.

## 3. En pratique
```ts
import { createHmac, randomBytes } from 'node:crypto'
const key = randomBytes(32)                          // créée une fois, à l'activation de la sonde
const fp = createHmac('sha256', key)
  .update(`${kind}|${promptVersion}|${canonicalJson(input)}`)  // ① entrée normalisée
  .digest('hex').slice(0, 16)                        // ② tronquée : assez pour comparer, moins à stocker
```
⚠️ Extrait **probable** (conception de la spec 019, research R3), pas encore codé.

## Utilisé dans ce cours
- [[Sonde sans contenu — télémétrie minimisée, empreintes HMAC et pseudonymes]] — empreintes d'entrée / sortie des tâches d'IA et pseudonymes d'objets.
- [[Pont MCP — relais stdio, canal nommé et secret partagé]] — même famille d'idée : un **secret partagé** prouve que l'appelant est légitime (comparé à temps constant).
- [[Glossaire — Empreinte SHA-256]] — le hachage sans clé, et sa limite face au dictionnaire.

## Retenir et vérifier
- **À retenir** : empreinte **avec clé** ; sans la clé, ni calcul ni dictionnaire possible ; la sécurité repose **entièrement** sur le secret de la clé.
> **Q :** Pourquoi tronquer l'empreinte à 16 hexadécimaux (64 bits) n'est-il pas un problème ici ? **R :** On ne s'en sert que pour **comparer** des tâches d'une même app sur 30 jours ; 2⁶⁴ valeurs rendent une collision accidentelle négligeable, et la clé empêche de fabriquer une collision exprès.

**Pièges** : ⚠️ `sha256(clé + message)` « fait maison » au lieu de `createHmac` — vulnérable à l'extension de longueur ; ⚠️ stocker la clé dans la même base que les empreintes — le voleur aurait les deux.

## Évolution du 07/10 (soir) — dans le code
`src/main/domain/analyste/fingerprint.ts` utilise bien `createHmac('sha256', clé)` (pas de concaténation « maison »), tronqué à 16 hex (empreintes) ou 12 (pseudonymes). Les champs sont séparés par le caractère nul `\u0000`, qu'un texte saisi ne contient pas en pratique : `("ab", "c")` et `("a", "bc")` ne donnent pas la même chaîne. La clé vit dans le `SecretStore` (secret `analyste-hmac`), jamais dans la base. ⚠️ Le calcul des empreintes de tâches d'IA dans l'`AIGateway` (T018) n'est pas encore branché ; seuls les pseudonymes servent déjà.
