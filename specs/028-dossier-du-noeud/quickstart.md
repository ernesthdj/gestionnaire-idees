# Quickstart — 028 Le dossier du nœud

Validation de bout en bout, faite par Claude dans l'app réelle (Playwright, profil e2e fictif ; Claude simulé par
`GI_E2E_CLAUDE_REPLY` quand il faut une réponse), captures relues. Préalable : `npm run e2e` construit `out/`.

1. **Document d'un élément (US1, MVP)** — profil démo, élément « Données » de la carte de structure : un document est
   créé pour lui (outil `document_ecrire` appelé par le pont) → un dossier de verre apparaît à gauche de l'élément,
   relié ; clic → éventail ; clic sur le document → lecteur `.md` mis en forme dans l'onglet du nœud. Glisser le
   dossier, relancer l'app : même place.
2. **Documents existants (US1, R4)** — profil avec deux documents de la spec 012, l'un déplacé : après la mise à jour,
   le premier est dans le dossier de son genesis, le second reste affiché à la même place (épinglé) ; capture avant /
   après identique pour l'épinglé.
3. **Quatre sources (US2)** — élément qui couvre des fichiers : dossier présent sans action ; conversation d'une étape :
   un fichier écrit par Claude (hook simulé) entre avec « nouveau » ; « + » sur un fichier hors projet → message de
   refus ; « Retirer » puis Historique › Annuler.
4. **Tout voir (US3)** — élément de `boutique-demo` (ou projet généré de 500 fichiers) : « Tout voir (N) » → vue
   Dossier, filtre Code + recherche, ouverture d'un fichier, « ← Dossier » au même défilement ; mesure < 1 s.
5. **Claude lit le dossier (US4)** — tests d'intégration du pont : `dossier_lire` liste et lit un fichier rangé,
   refuse un fichier non rangé, un `.env`, un autre arbre.
6. **Épingler (US5)** — menu « ··· » d'un document → « Épingler sur la carte » → cadre de lecture à côté du dossier ;
   « Désépingler » ; relance : état gardé.
7. **Grande carte (US6)** — 30 dossiers visibles : dézoom sous 0,45 → pastilles « 📁 N » ; glisser et zoomer la carte :
   écarts entre images mesurés (95ᵉ centile < 17 ms visé, aucune image > 50 ms).
8. **Ranger ailleurs (US7)** — glisser une feuille de l'éventail sur un autre élément du même projet → rangée dans les
   deux ; vers un nœud d'un autre projet → refus ; « Ranger aussi dans… » au clavier ; « Demander à Claude de le
   compléter » → consigne préparée, rien d'envoyé.
9. **Accessibilité** — `expectNoAxeViolations` sur le dossier fermé, ouvert, la vue Dossier et le menu ; parcours
   complet au clavier ; animations réduites : aucun mouvement.

Commandes : `npm run typecheck`, `npm run lint`, `npx prettier --check src tests`, `npm test`, `npm run e2e`.
