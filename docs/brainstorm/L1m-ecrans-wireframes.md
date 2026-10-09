# L1m — Wireframes et parcours dans les widgets : le bac à sable visuel (idée, 2026-10-10)

> Brainstorm de niveau 1, mené avec Claude Code dans le terminal à partir d'une synthèse de Gemini apportée par
> mentalyas. Les points listés en « Décisions » ont été validés par mentalyas. Ce qui reste ouvert est listé à la fin.
> Aucune spec n'est écrite : elle viendra après la fin de la spec 024 (US4, US5) et de la spec 021.
> **Réécrit le 2026-10-10** : une première version prévoyait une vue « Écrans » dédiée. Mentalyas a fait remarquer
> que l'app sait déjà presque tout faire avec ses widgets ; vérification faite dans le code, la vue dédiée est
> abandonnée au profit de trois ajouts aux widgets.

## Idée de mentalyas (2026-10-10)

> « Sur un projet de zéro, je brainstorme avec Claude et, sur cette base, il me génère un départ de wireframes et de
> userflows en proposition, modifiables par mes soins, ou même supprimables pour en créer d'autres en promptant. […]
> L'écran des wireframes et des userflows, c'est mon **sandbox visuel** pour permettre à Claude de générer du code
> précis et de qualité sur la base de ce que je teste visuellement. »

> « On a le widget iframe qui permet à Claude de me générer des wireframes en HTML : il peut, par frame, me générer des
> mini CMS qui me permettent de retoucher des détails sans reprompter, comme le fait Claude Design. »

> « Je me demande si on ne peut pas déjà se faire des wireframes et des userflows avec la config actuelle de notre app.
> […] Je peux connecter le nœud concerné à un widget et demander de générer un wireframe sur la base du contexte de ce
> nœud, et là, dans le widget, j'aurai déjà tout, mini CMS, etc. Pareil si je demande de créer un userflow sur la base
> de mon texte. Du coup, on aura connecté contexte et widget avec les outils générés dedans, persistants visuellement
> sur la cartographie, et toi tu auras accès à tout quand tu veux. C'est pas suffisant ? Au lieu de recréer de
> nouvelles fenêtres. »

La synthèse de Gemini (« Wireframe Canvas & AI Co-Design Engine ») proposait un éditeur vectoriel (Fabric.js ou
Konva.js), une page dédiée et un format JSON d'écrans. **Tout cela est écarté** : les widgets de l'app couvrent le
besoin.

## Exemple concret (fil conducteur)

Un site vitrine pour un photographe : une galerie de photos, la création d'un compte, et des devis générés pour les
clients selon la prestation.

1. Mentalyas brainstorme avec Claude dans la conversation du genesis : Claude saisit le contexte.
2. Claude découpe le projet en étapes ou en specs (plan d'attaque), chacune avec ses propres questions.
3. Selon les réponses, Claude écrit les use cases (documents sur les nœuds).
4. Mentalyas relie un nœud (ex. « Demande de devis ») à un widget et demande un wireframe : Claude génère, dans le
   widget, les écrans avec leur panneau de réglages et leur navigation.
5. Même chose pour un parcours (« de la galerie au devis envoyé ») : un widget qui montre le parcours et permet de le
   jouer.
6. Mentalyas retouche dans le widget, sans repasser par Claude. Ses réglages restent, et le widget reste visible sur la
   carte, à côté du nœud qu'il illustre.
7. Claude relit le widget (code et réglages) quand il en a besoin, pour écrire la spec, la carte de structure, le plan
   et le code.

## Ce qui existe déjà (vérifié dans le code le 2026-10-10)

| Besoin | Dans l'app |
|---|---|
| Brainstormer, découper, questionner | Conversation du genesis (spec 008), plan d'attaque en fantômes (spec 011), documents des nœuds (spec 012) |
| Relier un nœud à un widget, avec son contexte | Branchement d'une idée ou d'une étape sur un widget, parties transmises choisies (specs 005, 015) |
| Claude génère un écran ou un parcours | Widget HTML posé par Claude (`widget_poser`, pont MCP spec 007), versions (spec 004) |
| Mini CMS, plusieurs écrans, navigation, mode jouer | Libre dans le widget : HTML et JavaScript dans le cadre isolé `gi-widget://` (aucune connexion, aucun cadre, aucun envoi de formulaire) |
| Visible sur la carte, à côté du nœud | Bloc widget de la carte, de 520 × 440 par défaut jusqu'à 1600 × 1200 |
| Tirer spec, structure, plan du travail fait | `document_ecrire`, `structure_dessiner`, `plan_proposer` (pont MCP) |

## Décisions (validées par mentalyas, 2026-10-10)

### 1. Pas de nouvelle vue : les wireframes et les parcours sont des widgets
Un wireframe ou un parcours est un **widget relié au nœud dont il montre le contexte** (idée, étape, use case). Il vit
sur la carte du projet, à côté de ce nœud.

### 2. Le bac à sable visuel, en amont du code
On teste et on travaille le parcours utilisateur avec Claude **avant** d'écrire les specs et le code ; les widgets
validés deviennent la référence visuelle à partir de laquelle Claude produit un travail précis.

### 3. Claude propose, mentalyas retouche dans le widget
- Claude génère les écrans et le parcours dans le widget ; mentalyas en redemande, en supprime, en crée d'autres par
  consigne.
- Claude joint à chaque wireframe **son panneau de réglages** (le « mini CMS ») : textes et libellés, mise en page,
  états de l'écran (vide, chargement, erreur, connecté, mobile ou bureau), afficher ou masquer, couleurs et tailles.
- **Basse fidélité par défaut**, maquette colorée à la demande (un réglage « rendu »).
- Un parcours est **jouable** : les boutons mènent aux écrans cibles, comme dans l'app finale.

### 4. Les deux sens
D'un nœud (idée, spec, user story, fonctionnalité) vers ses écrans ; et, une fois le parcours validé, des écrans vers
la spec, la carte de structure, le plan d'attaque et des écrans de référence rangés dans le projet.

### 5. Ce qui manque : trois ajouts aux widgets (la future spec)
1. **État persistant d'un widget** : aujourd'hui un widget reçoit ses entrées et peut publier un résultat, mais il ne
   retrouve pas son propre état à la réouverture ; les réglages du mini CMS seraient perdus. Ajout : le widget
   enregistre son état (JSON borné, validé à la frontière) et le relit à l'ouverture.
2. **Claude lit et modifie un widget existant** : par le pont MCP, Claude peut créer un widget mais ne peut pas lire
   son code ni son état (`carte_lire` les compte seulement). Ajouts : lire un widget (code, état, nœud relié) et en
   écrire une nouvelle version (annulable, marquée « par Claude »), au lieu d'en poser un nouveau.
3. **Plein écran** pour tester un parcours confortablement, avec retour à la carte.

## Contraintes (constitution, règles du dépôt)

- **Sécurité** : rien ne change dans l'isolement des widgets (CSP sans connexion, aucun cadre, aucun envoi) ; l'état
  enregistré est du JSON borné, revalidé, jamais exécuté hors du cadre ; le mode jouer reste dans le widget.
- **Humain dans la boucle** : toute écriture de Claude est marquée et annulable ; les écrans de référence et la spec ne
  sont écrits dans le projet que sur geste de mentalyas.
- **Local d'abord** : widgets et états dans la base chiffrée, avec le canevas du projet (et ses points de sauvegarde).
- **Simplicité** : aucune nouvelle bibliothèque, aucune nouvelle fenêtre ; trois ajouts ciblés aux widgets.

## Questions ouvertes (pour la spec)

1. L'état d'un widget est-il compris dans ses versions (une nouvelle version garde-t-elle les réglages, ou repart-elle
   de ceux que Claude propose) ?
2. Les points de sauvegarde (spec 024 US2) incluent-ils l'état des widgets (aujourd'hui : les blocs, pas l'état) ?
3. Un parcours sur plusieurs widgets (un widget par écran, reliés par des liens de la carte) ou toujours un seul widget
   par parcours ?
4. Faut-il une consigne type (« wireframe », « parcours ») pour que Claude génère toujours le même genre de panneau de
   réglages, ou le laisser libre ?
5. Bornes de l'état enregistré (taille, nombre de clés).
