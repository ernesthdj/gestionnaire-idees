# Feature Specification: Wireframes et parcours dans les widgets (spec 026)

**Feature Branch**: `main` · **Created**: 2026-10-10 · **Status**: Livrée
**Input**: « Pour la gestion des wireframes dans le widget, je dois d'abord pouvoir connecter un nœud au widget, ainsi
le widget est d'avance connecté au contexte, et avoir des boutons prédéfinis pour faire certaines choses, notamment
générer un wireframe, avec un prompt bien plus complet et clair. » — mentalyas, 2026-10-10.
Source : brainstorm `docs/brainstorm/L1m-ecrans-wireframes.md` (décisions 1 à 5). Reprend la spec 015 US4 (D5, D6 :
construction à partir du contexte complet du nœud), dont les tâches T012, T013 et T016 sont absorbées ici.

## Décisions (2026-10-10, validées par mentalyas)

| # | Sujet | Décision |
|---|-------|----------|
| D1 | Contexte | Un nœud (idée ou étape de plan) se branche sur un widget comme aujourd'hui (specs 005, 015). Dès qu'un nœud est branché, **Claude reçoit son contexte complet (valeurs comprises)** à chaque génération du widget, et plus seulement la structure des entrées (spec 015 FR-014, constitution 3.0 : plus d'anonymisation). Le canal `gi.onInputs` reste soumis à l'autorisation (spec 005). |
| D2 | Boutons prédéfinis | Un widget relié à au moins un nœud propose trois actions : **🖼 Wireframe**, **🔀 Parcours**, **🛠 Adapter au nœud**. Chacune envoie une **consigne complète figée dans le code** (cadre `WidgetFrame`), jamais un texte de l'interface. Le champ libre reste là pour retoucher ensuite. |
| D3 | Wireframe | Écrans tirés du nœud, **basse fidélité** par défaut (gris, blocs, vrais libellés tirés du nœud), navigation entre écrans, **panneau de réglages** (le « mini CMS ») : textes et libellés, mise en page, états (vide, chargement, erreur, connecté), mobile ou bureau, afficher ou masquer des zones, couleurs et tailles, rendu basse fidélité ou maquette colorée. Les réglages sont enregistrés (D5). |
| D4 | Parcours | Parcours **jouable** : chaque écran est une étape de l'utilisateur, les boutons mènent à l'écran suivant comme dans l'app finale, avec une carte du parcours (étapes, embranchements, cas d'erreur), un fil d'Ariane et « Recommencer ». |
| D5 | État persistant | Un widget enregistre son état (`gi.saveState`) et le relit à l'ouverture (`gi.state`, `gi.onState`) : **JSON borné (64 Ko, mêmes règles que le résultat)**, revalidé dans le main, un état par widget, gardé d'une version à l'autre. Claude reçoit l'état actuel quand il fait évoluer le widget, pour garder les réglages compatibles. Aucune donnée de l'app n'y entre ; l'état n'est jamais exécuté hors du cadre isolé. Les points de sauvegarde (spec 024) ne l'incluent pas encore. |
| D6 | Pas de construction automatique | Brancher un nœud ne lance plus rien tout seul (amende spec 015 D6) : le widget propose les trois boutons, mentalyas choisit. Wireframe et Parcours repartent d'une page blanche (la version précédente reste dans l'historique) ; Adapter part du code existant. |
| D7 (2026-10-10, demande de mentalyas) | Panneau de réglages flottant | Le « mini CMS » sort du wireframe : le widget **déclare** ses réglages (`gi.settings([...])` : texte, texte long, liste, interrupteur, couleur, curseur ; clé, libellé, groupe, aide, valeur par défaut) et **l'app dessine elle-même** le panneau dans un bloc flottant « ⚙ Réglages » posé à droite du widget et relié à lui, comme le cadre résultat. Chaque changement arrive en direct dans le widget (`gi.onSettings`) et est enregistré ; « Réinitialiser » revient aux valeurs par défaut. Déclaration validée par le main (40 réglages au plus, libellés et options bornés), valeurs revalidées contre la déclaration ; les libellés du widget sont affichés comme du texte, jamais comme du balisage. Le panneau se déplace, se redimensionne, se supprime comme un bloc (il revient à la prochaine déclaration) et suit son widget (masqué si le widget est supprimé). |
| D8 (2026-10-10, demande de mentalyas) | Échelle et plein écran | Sur la carte, un widget est un aperçu : un écran d'application ne tient pas lisiblement dans la taille d'un nœud (72 à 120 px). Le bouton **⤢ Plein écran** de son en-tête ouvre le même cadre isolé à taille réelle (pas de réduction au-delà de 760 px), avec ses réglages ancrés à droite et la demande à Claude en bas ; Échap ou « Fermer » revient à la carte. Le délai d'un widget passe à 10 minutes (un wireframe de plusieurs écrans dépassait les 4 minutes) et l'échec dit sa vraie raison. |

## User Stories

### US1 — Générer un wireframe ou un parcours depuis un nœud (P1) 🎯
mentalyas tire un lien de l'idée « Demande de devis » vers un widget vide ; le widget affiche « 🖼 Wireframe »,
« 🔀 Parcours », « 🛠 Adapter au nœud ». Un clic sur Wireframe : Claude construit les écrans à partir de la fiche, du
plan et des documents du nœud ; la version arrive comme toujours (« À revoir » pour la lecture des entrées).

**Scénarios**
1. Widget sans nœud branché → pas de boutons ; l'invitation dit de brancher un nœud pour générer un wireframe.
2. Nœud branché → les trois boutons ; un clic envoie la consigne de l'action et le contexte complet du nœud.
3. Pendant la génération → « Claude construit… » ; un échec est dit sans perdre la version affichée.
4. La conversation du widget garde la trace : « 🖼 Wireframe à partir de « Demande de devis » ».
5. Une retouche par le champ libre reçoit aussi le contexte du nœud.

### US3 — Le panneau de réglages à côté du wireframe (P1, D7)
Le wireframe généré déclare ses réglages ; un bloc « ⚙ Réglages » apparaît à droite du widget, relié par un trait.
mentalyas change le titre ou l'état de l'écran dans ce panneau : le wireframe se met à jour aussitôt, et le réglage
est toujours là à la réouverture.

**Scénarios**
1. `gi.settings(champs)` valide → bloc Réglages créé à droite (s'il n'existe pas), champs dessinés par l'app.
2. Déclaration invalide (type inconnu, clé en double, plus de 40 champs) → refusée, le widget l'affiche.
3. Changer un champ → `gi.onSettings` reçoit toutes les valeurs ; enregistré, retrouvé à la réouverture.
4. Valeur hors déclaration (option absente, nombre hors bornes, couleur non hexadécimale) → ramenée à la valeur par défaut.
5. Widget supprimé → panneau masqué ; panneau supprimé → recréé à la prochaine déclaration.

### US2 — Mes retouches restent (P1)
Dans le wireframe, mentalyas change un libellé dans le panneau de réglages, ferme l'app, la rouvre : le réglage est
toujours là. Une nouvelle version demandée à Claude garde les réglages qu'elle comprend.

**Scénarios**
1. `gi.saveState(données)` → enregistré (regroupé si rafale) ; à la réouverture, `gi.onState` reçoit l'état.
2. État hors bornes (64 Ko, profondeur, non-JSON) → refusé, le widget l'affiche dans son bandeau d'erreur.
3. Widget supprimé → son état part avec lui (cascade).

## Exigences
- FR-001 `widget:build { blockId, action: 'wireframe' | 'parcours' | 'adapter' }` ; refus `INVALID_STATE` sans nœud branché.
- FR-002 Contexte des nœuds = assemblage des specs 015 (parties cochées), en JSON, borné (`INPUT_MAX_CHARS` par entrée),
  transmis comme donnée délimitée ; une source disparue est ignorée.
- FR-003 Consignes des actions dans `WidgetFrame` (version 4) ; la demande ne porte que le nom de l'action.
- FR-004 `widget:state { blockId }` et `widget:saveState { blockId, data }` ; bornes vérifiées par le main (`checkResult`
  avec 64 Ko) ; table `widget_states` (migration + down).
- FR-006 (2026-10-10, demande de mentalyas) **Échelle** : le contenu d'un widget s'adapte à la taille de son bloc. Le
  document isolé le met en page sur au moins 760 px de large, puis le réduit (`zoom`, jusqu'à la moitié) pour tenir
  dans le bloc ; il garde ainsi l'échelle des nœuds de la carte. Le cadre le dit à Claude (concevoir pour 760 px).
- FR-007 (D7) Déclaration `widgetIo:declareSettings { blockId, versionId, fields }` (version affichée seulement),
  lecture `widgetIo:settings { blockId }` (panneau) et `widgetIo:settingsValues { blockId }` (widget), écriture
  `widgetIo:setSettings { blockId, values }` ; table `widget_settings` (migration + down) ; bloc `settings`.
- FR-005 Tests : unitaires (demande construite, consignes, bornes de l'état), intégration (service + dépôt), renderer
  (boutons, axe), e2e (brancher une idée fictive, cliquer Wireframe avec Claude simulé, réglage gardé après relance).
