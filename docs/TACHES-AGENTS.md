# Tâches — Pipelines d'agents (Modes de Claude et agents qui communiquent)

> Origine : brainstorm du neurone « Modes de Claude et agents qui communiquent » (2026-10-14). Règles arrêtées : agents en
> file simple PO → Architecte → Backend → Frontend → QA ; échange par documents `.md` versionnés ; branches en chaîne ;
> le QA seul fusionne sur `main` ; plafond de 3 allers-retours QA, réglable au lancement ; validation de mentalyas à la fin.

## Lot 1 — Fondations

- [ ] T001 Profils d'agents : rôle, mode de permissions, modèle, effort, skills consultables, créés dans la page Skills
- [ ] T002 Documents du pipeline : spec signée du PO (ID de tâche, PO seul peut modifier), rapports d'agent, journal par projet et journal global court (taille limitée, condensation)

## Lot 2 — Exécution

- [ ] T003 Moteur d'enchaînement : une session `claude -p` par agent, dans l'ordre, sur des branches en chaîne
- [ ] T004 QA : vérification contre `main`, merge, renvoi dans la boucle, arrêt au plafond (3 par défaut, réglable au lancement), validation finale
- [ ] T005 Rattacher un pipeline à une tâche ou un module mûr, condition de lancement (doc prête), arrêt si contexte manquant

## Lot 3 — Visuel

- [ ] T006 Vue animée sur la carte : agents en nœuds, signaux entre eux, progression, couleurs validation/erreur, clic = chat, nœud vert à la validation

## Lot 4 — Extensions

- [ ] T007 Étendre à un module entier : enchaîner les sous-nœuds dont la doc est prête
- [ ] T008 Personnages évolutifs des agents (idée à part, sans impact fonctionnel, à faire en dernier)
