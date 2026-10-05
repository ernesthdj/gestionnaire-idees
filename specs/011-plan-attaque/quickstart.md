# Quickstart — valider la spec 011

Prérequis : `npm run dev` (ou `npm run seed:demo`), pont MCP enregistré (Réglages › Claude Code), Claude Code connecté.

## Automatique
- `npm test` : `domain/plan` (cycles, rangs, `respectsDependencies`), `planLayout` (déterminisme, incrément : un ajout
  ne déplace que la branche et ce qui est en dessous), dépôts et services (proposition → décision → lot annulable,
  garde de verrou sur chaque chemin d'écriture, D6 à l'annulation), outils MCP, rendu des nœuds (a11y, axe).
- `npm run typecheck && npm run lint && npm run build`.

## Manuel (test guidé)
1. Un genesis, quelques échanges, `maturite_evaluer` → complet. Demander « propose-moi un plan » : 3 fantômes numérotés
   à droite du genesis, en pointillés, avec ✓ / ✗ ; Historique inchangé.
2. « Tout valider » : le genesis prend un cadenas, 3 étapes naissent ; l'Historique montre un seul lot ; l'annuler
   retire les étapes et le cadenas.
3. Ouvrir ② : Claude cite la fiche du genesis. Le faire mûrir, valider ②.1 et ②.2 : seule la branche ② s'allonge,
   ③ descend, rien d'autre ne bouge.
4. Glisser ③ au-dessus de ② : renumérotation ; si ③ attend ②, refus avec message.
5. Demander à Claude de modifier la fiche du genesis verrouillé : refus « nœud verrouillé » ; renommer le genesis :
   refus ; changer le statut d'une étape : permis.
6. Fermer, rouvrir : même disposition. Thème sombre : genesis / étape / sous-étape / fantôme / verrouillé distincts.
