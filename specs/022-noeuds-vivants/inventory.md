# Inventaire des fonctionnalités actuelles (spec 022, D23)

> Règle : **rien n'est retiré**. Chaque ligne dit où la fonctionnalité se trouve après la refonte. « Inchangé » = même
> place, même geste. Une ligne sans place bloque la livraison de sa carte. Relevé sur le code au 2026-10-08
> (`src/renderer/src/canvas/`, `skills/`, `chat/`).

## 1. Carte des idées — gestes de la toile (`IdeasCanvas.tsx`)

| Fonctionnalité | Aujourd'hui | Après la refonte |
|---|---|---|
| Nouvelle idée | Double-clic dans le vide → champ en place | Inchangé |
| Boîte à outils | Clic droit dans le vide → Nouvelle idée · Note · Widget IA | Inchangé |
| Déplacer la vue | Glisser le fond, flèches du clavier (pas de 64 px) | Inchangé |
| Zoom | Molette, boutons +, −, tout afficher (React Flow) | Molette et boutons **avec amorti** (D20) ; mêmes boutons, mêmes libellés |
| Sélection multiple | Ctrl/Cmd/Maj + clic ; Ctrl/Cmd/Maj + glisser = rectangle | Inchangé (sans carte de détails) |
| Supprimer | Suppr sur la sélection ou l'idée focalisée → confirmation | Inchangé |
| Lien libre | Tirer depuis la poignée d'une idée vers une autre | Inchangé (poignée gardée sur l'orbe) |
| Brancher sur un widget | Tirer une idée ou une étape vers un widget → revue | Inchangé |
| Clic sur une idée / étape / élément | Ouvre la conversation dans le volet de droite | Ouvre la **carte de détails** (D5, D15) ; « Discuter » y ouvre la même conversation |
| Double-clic sur une idée | Ouvre la conversation | Ouvre la carte **sur la discussion** (D10) |
| Entrée sur un nœud | Ouvre la conversation | Ouvre la carte, focus dedans ; Entrée sur « Discuter » ouvre la conversation |
| Menu d'une idée | Clic droit / touche Menu / Maj+F10 | Inchangé (menu identique, §3) ; aussi un bouton « ⋯ » dans la carte |
| Clic dans le vide | Ferme le volet (conversation, fantôme) | Ne ferme plus rien (D15) ; « Fermer les cartes » et ✕ |
| Glisser une idée | L'épingle à sa place (physique) | Inchangé |
| Glisser une étape / un document / un livrable | Décalage mémorisé, la branche suit | Inchangé (décalage appliqué à la nouvelle disposition) |
| Physique des idées | Les nouvelles se placent sans chevaucher ; « Libérer » | Inchangé (place des genesis) ; les plans prennent la disposition alternée (D11) |
| Dérive des idées brutes | `data-drift` : les idées brutes ondulent | Étendue à **tous** les nœuds (D3) |
| Carte vide | Message « Double-clique n'importe où… » + raccourci global | Inchangé |
| Sélection connue de Claude | `useSelectionSync` (pont MCP) | Inchangé |
| Cadrage initial et « Recentrer » | `fitBounds` sur idées et blocs | Inchangé, glissé avec amorti |

## 2. Barre d'outils (`CanvasToolbar.tsx`)

| Fonctionnalité | Après la refonte |
|---|---|
| Compteurs « N brute · N en dév. · N éclose » | Inchangé |
| Filtres « Toutes natures », « Toutes catégories », recherche | Inchangé |
| « Reprendre un projet existant » (assistant d'import, spec 017) | Inchangé |
| « + Bloc » | Inchangé |
| « Recentrer » | Inchangé (avec amorti) |
| — | **Ajout** : « Réorganiser » (D22) |

## 3. Menu d'une idée (`NeuronMenu.tsx`)

Titre modifiable · nature (Action / Réflexion, marque ✦ si proposée par l'IA) · catégorie · relier à une idée (avec
libellé) · nombre de liens · lier un dossier de projet · ouvrir la conversation · libérer (physique) · supprimer.
→ **Inchangé**, ouvert par clic droit comme aujourd'hui et par « ⋯ » dans la carte de détails.

## 4. Nœuds de la carte des idées (`canvas/nodes/`)

| Nœud | Fonctionnalités actuelles | Après la refonte |
|---|---|---|
| Idée (`NeuronNode`) | Titre, état (brute / en dév. / éclose), maturité, catégorie et nature (✦ IA), badge « par Claude », poignée de lien, dérive | Orbe (D11) ; titre dessous ; état et maturité par l'aspect + carte ; catégorie (anneau fin) et nature ✦ dans la carte et le nom accessible ; badge « par Claude » sur l'orbe ; poignée gardée |
| Étape (`PlanNode` step) | Rang ①②③, titre, statut, poignée vers widget ; boutons action finale : Accepter, Refuser, Lire, Exécuter, Arrêter | Petit cercle (D11, D17) avec pictogramme, rang et pastille de statut ; **tous les boutons** dans la carte de détails (mêmes libellés, mêmes effets) ; poignée gardée |
| Fantôme (`PlanNode` ghost) | Étape proposée : ✓ Valider, ✗ Refuser ; clic = détail (volet `GhostPanel` : Pourquoi, Attend) | Cercle en pointillés ; ✓ / ✗ gardés sur le nœud **et** dans la carte ; le détail (Pourquoi, Attend) dans la carte |
| Barre de plan (`PlanBarNode`) | Compteur et état du plan | Inchangé (au-dessus du genesis) |
| Action finale (`FinalPanel`) | Livrable annoncé, pourquoi elle est prête | Dans la carte de l'étape (fiche) |
| Document (`DocumentNode`) | Aperçu du texte, redimensionnable, « Montrer dans l'Explorateur », glisser | Cercle « document » ; aperçu et texte complet dans le **lecteur** de la carte (D13) ; « Montrer dans l'Explorateur » dans la carte ; glisser gardé |
| Livrable (`DeliverableNode`) | Liste des fichiers (statut), lire un fichier, redimensionnable, glisser | Cercle « livrable » avec trombone ; liste dans la carte, lecture dans le **lecteur** (Différence / Contenu, comme `FileViewer`) ; glisser gardé |
| Visionneuse (`FileViewer`) | Volet : différence et contenu coloré, numéros de ligne, première ligne changée | Dans le lecteur de la carte (même composant, D18) |
| Élément de structure (`ElementNode`) | Type, numéro de progression, titre, résumé, statut, couche, chemins, ▸ N / ▾ (repli mémorisé), focus des liens au survol | Petit cercle (US3) ; repli ▸ N gardé (même IPC) ; résumé, couche, chemins, statut dans la carte ; focus au survol gardé |
| Barre de structure (`StructureBarNode`) | Bascule Progression / Architecture, choix d'architecture (annulable) | Inchangé |
| Bande de couche (`LayerBandNode`) | Couches de la vue Architecture | Inchangé |
| Widget (`WidgetNode`) | Exécution en bac à sable, version affichée, voir le code, relancer, supprimer, entrées (revue) | Inchangé dans son cadre (US4 : flottaison + carte de détails avec les mêmes actions) |
| Résultat (`ResultNode`) | Cadre résultat d'un widget, supprimer | Inchangé (US4) |
| Bloc, note libre, note de carte, cadre (`BlockNode`, `LabelNode`, `MapNoteNode`, `FrameNode`) | Texte, modifier, supprimer, redimensionner, glisser | Inchangé (US4 : flottaison + carte) |
| Liens libres (`MapLinkEdge`) et branches (`BranchEdge`) | Libellés, focus | Inchangé ; couleur de branche (D17) pour les liens d'arbre |

## 5. Conversation (`chat/ChatPanel.tsx` et voisins)

Fil, réponse en direct, orbe « Claude réfléchit » et morphing, Arrêter / Échap, permissions (aperçu du changement,
commande exacte, Annuler), modes de travail, modèle, dossier lié, onglet « Fiche du neurone », consommation.
→ **Tout le composant est repris tel quel** dans l'étirement de droite de la carte (D10) ; seule la place change.

## 6. Arbre de skills (`skills/`)

| Fonctionnalité | Après la refonte |
|---|---|
| Disposition en éventail autour de « Toi », branches par famille / domaine (`skillTree.ts`) | Inchangé (D17) |
| Grappe de plugins repliée « Déplier » | Inchangé (pastille ▸ N) |
| Filtres « Familles affichées », « Analyser les skills », « Bibliothèque », « À analyser » | Inchangé |
| Liens écrits et liens de sens (pointillés) | Inchangé |
| Nœud brouillon « Brouillon · à installer », fantômes | Inchangé (cercle en pointillés) |
| Volet du skill : onglets Fiche · SKILL.md · Fichiers · Conversation ; Gestes : Dupliquer, Revenir, Supprimer (confirmations) ; plugin en lecture seule | Dans la carte : Fiche (étirement bas), SKILL.md et Fichiers (lecteur droite), Conversation (droite) ; **mêmes gestes et confirmations** |
| Fiche technique : Note, Domaine, Entrées et sorties, Liens de sens, Corriger, Analyser | Dans l'étirement « Fiche complète » |
| Brouillon : Installer, Jeter, différences | Dans la carte du brouillon (lecteur pour les différences) |
| Bibliothèque : skill disponible (verdict sûr / à revoir / dangereux), Installer…, Supprimer une copie, version, dépôt, déplier sur la toile | Carte de détails du skill disponible, mêmes gestes ; panneau du dépôt inchangé |
| Import GitHub (`ImportDialog`) | Inchangé |

## 7. Coquille

Navigation (Idées, À valider, Historique, Skills, Analyste), titre, consommation 5 h / 7 j, thème, Réglages, toasts
avec annulation → **inchangé** ; ajouts : équipe en cours (D19), thème Carbone (D21).
