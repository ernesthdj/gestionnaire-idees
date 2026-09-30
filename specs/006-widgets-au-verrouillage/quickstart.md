# Test manuel guidé — 006 Widgets proposés au verrouillage

Lancer `npm run dev`. Claude doit être configuré (Réglages → IA). Cocher au fur et à mesure ; noter tout écart.

## Lot 1 — Propositions

Validé le 2026-09-30. (Au lot 1, cocher n'avait encore aucun effet ; c'est le lot 2 qui crée les outils.)

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
- [ ] Confirmer sans rien cocher → l'idée éclot comme d'habitude, aucun widget n'est créé.

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

### Verdict toujours affiché (retour de test du 2026-09-30)

- [ ] Chaque aperçu montre une ligne **« Outils suggérés »** : la liste des outils, ou « aucun — » suivi de la raison
      donnée par Claude (contexte insuffisant et ce qui manque, ou idée qui n'appelle pas d'outil).

## Lot 2 — Éclosion et génération

Reprendre une idée qui propose au moins deux outils (par ex. le week-end à Bruges), jusqu'à l'aperçu.

### Les outils arrivent avec l'éclosion

- [ ] Cocher deux outils, dont un qui « produit un résultat », puis **Confirmer**.
- [ ] Dès la fin de l'animation, deux cadres de widget apparaissent **autour de l'idée** (à gauche d'abord), sans
      recouvrir l'idée, sa prochaine étape ni un autre objet ; chacun est **relié à l'idée** par un trait bleu (sauf un
      outil qui ne lit rien de l'idée) et porte le titre proposé.
- [ ] Chaque cadre dit « Claude prépare cet outil… » (sous sa description) ; la chatbox est figée et montre
      l'animation de l'IA. Les outils se remplissent **l'un après l'autre** ; la carte reste utilisable pendant ce temps.

### Revue avant lecture de l'idée

- [ ] Un outil généré et branché affiche le bandeau **« À revoir »** : il n'affiche encore aucune donnée de l'idée.
- [ ] « Revoir » → la revue précoche **exactement** les parties annoncées dans l'aperçu (les autres décochées) →
      Autoriser → l'outil affiche les données de l'idée.
- [ ] L'outil qui « produit un résultat » : après autorisation (et une saisie si besoin), son **cadre résultat**
      apparaît à sa droite.
- [ ] La conversation de l'outil montre la demande partie à Claude (la proposition, jamais les réponses de l'idée).

### Annuler l'éclosion

- [ ] Recommencer sur une autre idée : cocher un outil, Confirmer, puis **« Annuler »** dans la notification
      d'éclosion → l'idée revient en développement ; le cadre de l'outil et son trait disparaissent avec elle.

### Échec et Réessayer

- [ ] Couper le réseau (ou retirer la clé Claude dans Réglages → IA) juste avant de confirmer avec un outil coché →
      l'idée éclot quand même ; le cadre dit « La fabrication de cet outil n'a pas abouti. », la raison est dans sa
      conversation, un bouton **« Réessayer »** est proposé.
- [ ] Rétablir, cliquer « Réessayer » → l'outil est généré.
- [ ] Fermer l'app pendant qu'un outil est en préparation, relancer → le cadre est là, vide, avec « Réessayer ».

### Pas de doublon

- [ ] Approfondir une idée qui a reçu des outils, répondre, reverrouiller → ses outils (même pas encore générés) ne
      sont pas reproposés.

### Coût

- [ ] `node scripts/ai-usage.cjs` : une génération `widget` par outil coché, aucune pour un verrouillage sans case
      cochée.
