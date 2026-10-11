# Quickstart — vérifier le panneau de conversation (spec 027)

## Prérequis

- `npm run build` (ou `npx electron-vite build`) ; profil e2e fictif (`--e2e`, coffre temporaire `GI_E2E_VAULT`,
  `GI_E2E_EMPTY=1`) ; Claude simulé (`GI_E2E_CLAUDE_REPLY`) pour les e2e automatiques, Claude réel pour la passe
  finale (comme l'audit du 11/10).

## Automatique

```bash
npm run typecheck && npm run lint && npx prettier --check src tests && npm test
npm run e2e        # dont tests/e2e/side-panel.e2e.ts
```

## Scénarios (e2e, puis passe réelle)

1. **Lisible à tout zoom (US1, SC-001)** : créer un projet de zéro → la conversation du genesis s'ouvre dans le
   panneau, consigne préparée dans le champ ; dézoomer au plus loin, « Recentrer », « Tout afficher » → panneau
   inchangé (même boîte à l'écran, texte à 14 px).
2. **Onglets (US2)** : plan validé, « Discuter » sur l'étape ① → deuxième onglet affiché, le genesis reste ; une
   demande de permission dans l'onglet non affiché → « ⏸ » sur son onglet et sur son nœud ; fermer la carte de
   l'étape → l'onglet reste ; × → l'onglet se ferme, le tour continue.
3. **Nœud retrouvé (US3)** : faire sortir le nœud de l'écran, « Centrer sur le nœud » → il revient au centre avec
   l'anneau ; onglet d'une étape née en Workflow, vue Progression affichée → la vue bascule puis centre.
4. **Dépôt (US4)** : badge du dépôt → onglet « ⎇ Dépôt » ; `Ctrl+Maj+G` le ferme ; les conversations restent.
5. **Largeur (US5)** : poignée à 50 % (souris), puis → × 3 (44 % ; la poignée est le bord gauche du panneau : → le resserre, ← l'élargit) ; fermer et relancer l'app → 44 %.
6. **Lecteur** : carte d'un élément → fichier → il s'ouvre dans l'onglet du nœud ; « ← Conversation » ; Échap dans
   le lecteur revient à la conversation, Échap ensuite rend le focus à la carte.
7. **Fenêtre étroite** : vue de 1 000 px → panneau en surimpression, fermable.

## Attendu

Aucune violation axe ; animations coupées avec « réduire les animations » ; aucune régression des e2e existants
(conversations, Workflow, widgets, Git), leurs sélecteurs mis à jour du « détail de carte » vers le panneau.
