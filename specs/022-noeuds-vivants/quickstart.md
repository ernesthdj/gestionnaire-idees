# Quickstart — validation de la spec 022

Prérequis : `npm install` (ajoute `lucide-react`), puis `npm run typecheck`, `npm run lint`, `npx prettier --check src tests`,
`npm test` verts. Référence visuelle : prototype validé (artifact « Nœuds vivants », v23).

## US1 — Carte des idées (`npm run seed:demo`)
1. Ouvrir Idées : les genesis sont des orbes, les étapes de petits cercles avec pictogramme, rang et pastille ; chaque
   grande étape a sa couleur ; tout flotte doucement.
2. Le plan d'une idée éclose se déploie en sens alterné (étapes en colonne, sous-étapes en ligne, puis en colonne…).
3. Clic sur une étape : carte à droite ; clic sur une autre : deuxième carte ; glisser l'en-tête (poignée) : la carte
   suit le nœud au zoom ; double-clic sur l'en-tête : elle se recolle.
4. « Fiche » s'étire vers le bas, « Discuter » vers la droite (la conversation habituelle) ; un livrable : son fichier
   s'ouvre dans le lecteur (Différence / Contenu) ; Échap replie le lecteur puis ferme la carte active.
5. ▾ sur une étape : ses sous-étapes rentrent en glissant, ▸ N ; fermer / rouvrir l'app : repli conservé.
6. « Réorganiser » : le plan se transpose en glissant ; molette : zoom avec amorti ; Animations réduites : plus rien ne
   bouge de lui-même.
7. Vérifier l'inventaire §1–§5 (`inventory.md`) : chaque geste existant fonctionne encore.
8. Thème Carbone (Réglages) : surfaces noires, liserés argentés, éclat qui tourne autour des cartes.

## US2 — Skills
Éventail autour de « Toi » conservé, nœuds en cercles colorés par branche ; clic : carte (Fiche, SKILL.md, Fichiers,
Conversation, gestes) ; bibliothèque dépliée (~300 nœuds) fluide ; inventaire §6.

## US3 — Structure
Éléments en cercles ; Progression / Architecture glisse ; ▸ N inchangé ; carte avec fichiers liés dans le lecteur.

## US4 — Blocs
Widgets, notes, cadres flottent ; glisser précis ; carte avec leurs actions (relancer, voir le code, supprimer…).

## US5 — Main et agents (dépôt de test jetable)
Trois discussions : ★ Main puis deux ⑂ agents avec leur branche ; messages en parallèle, anneaux qui tournent ; un
fichier écrit par un agent n'existe que sur sa branche ; « Garder » fusionne après aperçu, « Jeter » supprime.
