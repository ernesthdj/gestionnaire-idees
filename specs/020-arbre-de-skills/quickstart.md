# Quickstart — Arbre de skills (spec 020)

Guide de validation. Prérequis : Claude Code connecté ; quelques skills personnels (`~/.claude/skills`) ; un projet lié
avec `.claude/skills` (le Brainstormer lui-même) ; au moins un plugin installé.

## §1 Voir (US1)
1. `npm run dev` → navigation **Skills**. Attendu : tronc « Toi », une branche par famille, un nœud par skill (famille
   par icône + libellé, ⚠ si scripts), grappe « N skills de plugins ».
2. Survole `hub` : liens « appelle » vers `graphify` et `professor`.
3. Filtre « personnels », cherche « photo ». Clic sur un nœud → fiche (SKILL.md, fichiers, liens).
4. Modifie à la main la description d'un skill personnel : la toile se met à jour.
5. Automatique : `npm test -- skills/inventory skills/links skills/tree`.

## §2 Comprendre (US2)
1. « Analyser les skills » → progression ; fiches, étoiles (grille justifiée), branches par domaine, liens pointillés.
2. Change les étoiles d'un skill (4 ★) et son domaine → « Annuler » dans la notification ; relance l'analyse : ta note
   reste.
3. Usage : « N appels / 30 j » sur `hub` et `brainstorm`.
4. Automatique : `npm test -- skills/card-check skills/usage` (aucun texte de conversation conservé).

## §3 Faire évoluer (US3)
1. Sélectionne un skill personnel → onglet Conversation : « rends ses déclencheurs plus clairs ». Attendu : carte
   « Brouillon prêt », différences, rien sur le disque.
2. Installer → confirmation → fichier modifié ; menu ⋯ « Revenir à la version précédente » → contenu d'origine exact.
3. Pendant qu'un brouillon est ouvert, modifie le fichier à la main → Installer : avertissement « le fichier a changé ».
4. Skill de plugin : pas de modification possible ; « Dupliquer en skill personnel » → brouillon.
5. Clic dans le vide → conversation « Skills » : « crée un skill pour préparer mes séances photo » → nœud fantôme.
6. Automatique : `npm test -- skills/installer skills/draft` (chemins, exécutables, conflit, écriture atomique).

## §4 Importer dans la bibliothèque (US4, D12)
1. « Importer depuis GitHub… » → adresse d'un dépôt public de skills → progression → résumé (N skills, verdicts des
   règles fixes) → « Voir sur la toile » : branche Bibliothèque, grappe du dépôt dépliée, nœuds « disponible ».
2. Adresse piégée (`ext::sh -c …`) : refus immédiat.
3. Clic sur un skill disponible : verdict « (règles) », SKILL.md, scripts décochés ; « Installer… » → audit par Claude →
   brouillon → différences → Installer. Un verdict aggravé par Claude arrête tout et demande un second clic.
4. Clic sur le dépôt : « Mettre à jour » (la copie est remplacée ; les skills inchangés gardent l'audit de Claude) ;
   « Retirer de la bibliothèque… » (copie supprimée, skills installés intacts).
5. Ferme l'app pendant une copie → au redémarrage, seule la copie courante reste sous `skill-library/<hôte>/<auteur>/`.
6. Automatique : `npm test -- reprise/git-url reprise/clone-service skills/skill-import skill-import-dialog`.
