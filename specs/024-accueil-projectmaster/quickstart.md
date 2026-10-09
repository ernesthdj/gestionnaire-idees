# Quickstart — Accueil ProjectMaster (spec 024)

## Prérequis
- `npm run typecheck`, `npm run lint`, `npx prettier --check src tests`, `npm test` verts.
- Coffre de test : une copie de `ProjectsMaster/` (ou le profil démo, qui crée un coffre fictif).

## Scénarios
1. **Project Manager (US1)** — Lancer l'app : le Project Manager s'affiche avant tout canevas ; la liste montre les
   brainstorms du coffre et les externes.
2. **Reprise exacte (US1)** — Ouvrir `gestionnaire-idees`, déplacer des nœuds, plier une branche, passer un genesis en
   Workflow, ouvrir une carte ; quitter l'app ; relancer, recharger : tout est identique.
3. **Anomalies (US1)** — Un fichier modifié et une session restée ouverte : signalés à l'ouverture, actions sur clic.
4. **Points de sauvegarde (US2)** — Poser « avant refonte », supprimer trois nœuds, revenir au point : ils reviennent ;
   annuler le retour : ils repartent.
5. **De zéro (US3)** — « essai-local » sans GitHub : dossier dans `projects/`, registre, canevas, première question du
   brainstorm liée à la description.
6. **Projet en chantier (US4)** — Un dossier hors du coffre : aperçu des écritures, `.brainstormer/` créé et ignoré par
   git, référence externe ; rôle « mon propre dépôt » ; (après spec 021) rôle « collaborateur » : branche personnelle,
   push vers la branche par défaut refusé.
7. **Depuis un lien Git (US5)** — Un petit dépôt public : clone dans le coffre, canevas ouvert, contenu jamais exécuté.
8. **Fin de session (US6, après spec 021)** — Décocher graphe et cours : commit avec diff sur clic, journaux, session
   fermée, `pm.bat` le voit.
9. **Coffre (US7)** — Profil neuf : choisir ou créer un coffre ; `pm.bat` lit le coffre créé.
10. **Passage de la carte unique (R10)** — Sur une copie du profil réel : inventaire avant / après identique, genesis du
    Brainstormer dans `gestionnaire-idees`, le reste dans « Idées en vrac ».
