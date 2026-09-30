# Test manuel guidé — 006 Widgets proposés au verrouillage

Lancer `npm run dev`. Claude doit être configuré (Réglages → IA). Cocher au fur et à mesure ; noter tout écart.

## Lot 1 — Propositions

Ce lot ne fait que **proposer** : cocher un outil n'a encore aucun effet à la confirmation (lot 2). Ce qu'on vérifie
ici, c'est la pertinence des propositions et l'aperçu.

### Une idée qui appelle un outil

Préparer une idée Action chiffrée, par exemple « Organiser un week-end à Bruges pour 4 » : répondre à au moins trois
questions avec des montants et des dates (hôtel 180 €, train 60 € par personne, départ le 14 novembre…).

- [ ] Verrouiller → l'aperçu du plan s'affiche comme avant, puis une section **« Outils proposés »** (1 à 3 outils,
      par exemple un tableau des dépenses, un compte à rebours).
- [ ] Chaque outil a un titre, une phrase qui dit ce qu'il fait pour CETTE idée, et une ligne « lit : … » (plus
      « produit un résultat » quand il en produit un). Les propositions te paraissent-elles utiles ?
- [ ] Toutes les cases sont **décochées** ; le compteur dit « Aucun outil coché : aucune génération ».
- [ ] Cocher deux outils → « 2 outils cochés : 2 générations Claude à la confirmation » ; décocher → le compteur suit.
- [ ] « Réviser » avec une consigne → le nouvel aperçu repart **sans rien de coché** (ses propositions peuvent changer).
- [ ] Corriger un élément (Modifier) → les propositions et les cases restent.
- [ ] Confirmer → l'idée éclot comme d'habitude, **aucun widget n'est créé** (normal au lot 1).

### Une idée qui n'en appelle pas

- [ ] Une idée Réflexion sans chiffres (« Faut-il changer de métier ? ») → le plus souvent **aucune section
      « Outils proposés »** : l'aperçu est identique à celui d'aujourd'hui.

### Outil déjà branché

- [ ] Sur une idée éclose, créer un widget (clic droit → Widget IA), le faire générer, lui brancher l'idée (lien tiré de
      l'idée), autoriser. Approfondir l'idée, répondre, reverrouiller → cet outil (ou un équivalent) n'est **pas**
      reproposé.

### Sans Claude

- [ ] Désactiver Claude (Réglages → IA) et laisser l'IA locale active : verrouiller → aperçu marqué « Produit par l'IA
      locale », **aucune** section « Outils proposés ».

### Coût

- [ ] Après quelques verrouillages : `node scripts/ai-usage.cjs` → les appels `synthetiser` ne coûtent pas
      sensiblement plus qu'avant (quelques dizaines de jetons de sortie par outil proposé).
