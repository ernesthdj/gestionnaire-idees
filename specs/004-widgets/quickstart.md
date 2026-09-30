# Test manuel guidé — 004 Boîte à outils et mini-widgets

Lancer `npm run dev` (données réelles) ou `npm run seed:demo` (profil fictif). Claude doit être configuré
(Réglages → IA) pour les parties 3 et 4. Cocher au fur et à mesure ; noter tout écart.

## 1. Boîte à outils (US1)

- [ ] Clic droit dans le vide de la carte → panneau « Outils de la carte » au point du clic, focus sur « Nouvelle idée ».
- [ ] Flèches haut/bas, Début/Fin parcourent les 3 outils ; `Échap` ferme ; un clic ailleurs ferme.
- [ ] « Nouvelle idée » ouvre la saisie d'idée à cet endroit.
- [ ] Clic droit sur une idée, un lien, une note ou un widget → ce panneau ne s'ouvre pas.

## 2. Notes (US2)

- [ ] « Note » crée une note à l'endroit du clic, directement en écriture.
- [ ] `Échap`, `Ctrl+Entrée` ou un clic ailleurs enregistre ; double-clic (ou ✎) rouvre l'édition.
- [ ] Déplacement et redimensionnement : la taille s'arrête aux bornes ; les idées ne la chevauchent pas.
- [ ] Suppression → notification « Annuler » ; l'annulation (et l'Historique) la fait revenir.
- [ ] Fermer puis relancer l'app : la note est toujours là, même texte, même place.

## 3. Widget IA (US3)

- [ ] « Widget IA » crée un cadre vide : « Décris l'outil voulu : Claude le fabriquera ici. »
- [ ] Demander « un compte à rebours de 5 minutes avec démarrer / pause / remise à zéro » → indicateur « l'IA
      réfléchit » + moteur (« Claude Sonnet 5.5 »), champ figé, puis le widget s'affiche et fonctionne (< 60 s, SC-001).
- [ ] Demander une évolution (« ajoute une barre de progression ») → version 2 affichée, sélecteur de version visible.
- [ ] Revenir à `v1` par le sélecteur → la version 1 s'affiche ; repasser à `v2`.
- [ ] Bouton `</>` → onglets HTML / CSS / TypeScript, code affiché comme du texte ; re-clic → retour au widget.
- [ ] « Conversation (n) » dépliée : demandes et réponses dans l'ordre.
- [ ] Déplacer le widget par sa barre de titre, y compris en passant vite au-dessus du cadre : le glisser ne décroche pas.
- [ ] Redimensionner : impossible sous 240 × 160 et au-dessus de 1600 × 1200 ; le widget s'adapte.
- [ ] Bouton ↻ : le widget repart de zéro.
- [ ] Changer le thème (clair ↔ sombre) : le widget suit.
- [ ] Supprimer le widget → « Annuler » le restaure avec ses versions.
- [ ] Relancer l'app : le widget, sa version affichée et sa conversation sont conservés.
- [ ] Réglages → IA : « Modèle des widgets » modifiable ; la génération suivante l'utilise (étiquette du moteur).

## 4. Évasion du bac à sable (SC-002)

Demander à Claude, dans un widget : « Un panneau de diagnostic : un bouton par test, qui affiche RÉUSSI ou BLOQUÉ —
fetch vers https://example.com, image https://example.com/x.png, WebSocket wss://example.com, accès à
parent.document, accès à window.top.location.href, window.open, alert, localStorage, location.href vers
https://example.com, présence de window.api, création d'un RTCPeerConnection. »

- [ ] Chaque test affiche BLOQUÉ (ou une erreur) ; aucun n'affiche RÉUSSI.
- [ ] Aucune fenêtre ni boîte de dialogue ne s'ouvre ; l'app ne navigue nulle part ; la carte reste utilisable.
- [ ] Après le test de navigation, ↻ réaffiche le widget.

## 5. Échecs (US3 scénarios 5 et 6)

- [ ] Claude coupé (clé retirée ou hors ligne) → message habituel dans la chatbox, pas de génération locale,
      la version précédente reste affichée.
- [ ] Coût : `node scripts/ai-usage.cjs` → une génération ≤ 0,10 € (SC-003).
