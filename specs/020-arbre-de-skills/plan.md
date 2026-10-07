# Implementation Plan: Arbre de skills (spec 020)

**Branch**: `main` (spec `020-arbre-de-skills`) | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

## Summary

Une page **Skills** qui inventorie en lecture seule les skills de Claude Code (personnels, de projet, de plugins), détecte
les liens écrits entre eux et les dispose en **arbre de compétences** (tronc, branches par domaine) ; une **fiche
technique** par skill. Claude rédige fiches, notes (grille à 4 critères) et liens de sens par une tâche `skill_card`
**sans outil** ; l'usage sur 30 jours est compté dans les historiques de Claude Code en ne lisant que les noms de skills.
Deux conversations (générale, par skill) où Claude ne produit que des **brouillons** (outil MCP `skill_brouillon`) ;
mentalyas **installe** (version sauvegardée, écriture atomique, annulable) ou **revient** en arrière. Import GitHub en
**quarantaine** (contrôle d'URL et clone repris de la spec 017 US5), audit `skill_audit` sans outil + règles fixes,
scripts exclus par défaut.

## Technical Context

**Language/Version**: TypeScript 5 strict
**Primary Dependencies**: Electron, React, React Flow, Zod, Drizzle ; Node `fs` (lecture, `fs.watch`, écriture atomique),
`worker_threads` (comptage d'usage) ; git (`GitCli.runGit`) ; Claude Code via `AIGateway` (tâches) et
`ConversationService` (conversations) ; pont MCP (2 outils). **Aucune dépendance npm nouvelle** (en-tête YAML lu par un
petit analyseur maison, sous-ensemble clé : valeur).
**Storage**: migration `0033_skills` (+ down) : `skill_cards`, `skill_domains` (7 domaines semés), `skill_links`,
`skill_drafts`, `skill_versions`, `skill_imports`, `skill_import_candidates` ; versions de fichiers dans
`<profil>/skill-versions/`, quarantaine dans `<profil>/skill-quarantine/`.
**Testing**: Vitest — purs (en-tête, liens écrits, disposition, grille, contrôles de fiche, règles fixes d'audit, contrôle
d'URL, chemins / noms, différences) ; intégration (inventaire sur arborescences temporaires dont liens symboliques
hostiles, comptage d'usage sur historiques fictifs, installation / retour arrière / conflit disque sur dossier
temporaire, import avec git réel sur un dépôt local jetable et Claude simulé, nettoyage de quarantaine) ; renderer + axe
(page, arbre, fiche, brouillon, import).
**Target Platform**: Windows 11
**Performance Goals**: page utilisable < 2 s avec 150 skills (SC-007) ; inventaire < 300 ms ; comptage d'usage hors du
fil principal
**Constraints**: aucun fichier de skill modifié sans clic (SC-002) ; aucun texte de conversation conservé (SC-004) ;
aucun fichier importé exécuté (SC-005) ; Claude sans accès disque pour l'analyse et l'audit
**Scale/Scope**: ~25 fichiers main / shared, ~12 renderer ; 1 migration ; fixtures (skills fictifs, historiques fictifs,
dépôt de démonstration)

## Constitution Check (4.3.0)

| Principe | Vérification | Statut |
|---|---|---|
| I Sécurité | Racines de skills fixes, `realpath` + inclusion, identifiants résolus par le main ; écriture seulement sur « Installer » / « Revenir » avec version sauvegardée (4.3.0) ; jamais d'exécutable depuis un brouillon de Claude ; scripts d'import seulement autorisés un par un, jamais exécutés ; git par chemin absolu, arguments fixes, hooks désactivés, `--` avant l'URL ; IPC Zod ; Markdown rendu sans HTML | ✅ |
| II Humain dans la boucle | Claude ne crée que des brouillons ; installation, retour arrière, corrections = gestes de mentalyas, lots annulables ; import : choix explicite, « dangereux » verrouillé | ✅ |
| III IA cadrée | Tâches `skill_card` et `skill_audit` par l'`AIGateway`, **sans outil**, texte du skill balisé comme donnée, sorties Zod fermées + contrôles ; audit doublé de règles fixes prioritaires ; conversations = outils MCP de lecture / brouillon | ✅ |
| IV Local d'abord | Inventaire et usage locaux ; usage = noms de skills seulement ; seuls les textes des skills partent chez Claude (à la demande) ; journal `ai_calls` | ✅ |
| V Tests | Tout le pur testé, git réel sur dépôt temporaire, CLI simulé, fixtures fictives | ✅ |
| VI Simplicité | Aucune dépendance ; réutilise carte React Flow, conversations, pont MCP, `neurons.hidden`, `GitCli`, et livre enfin le clone de la spec 017 US5 (deux usages) | ✅ |

## Project Structure

```text
src/shared/skills/frontMatter.ts          en-tête YAML minimal (pur)
src/shared/skills/model.ts                familles, identifiants, domaines de départ, grille, extensions exécutables
src/shared/ipc/skills.ts                  vues et contrats
src/shared/reprise/gitUrl.ts              contrôle d'URL (spec 017 T028, livré ici)
src/main/domain/skills/                   pur : links.ts (liens écrits), cardCheck.ts, auditRules.ts, paths.ts (noms,
                                          chemins relatifs), diff.ts (différences par fichier)
src/main/application/skills/SkillInventory.ts      inventaire 3 familles, surveillance, cache
src/main/application/skills/SkillCardService.ts    analyse (file de 3), corrections, liens
src/main/application/skills/SkillUsageScanner.ts   + worker : comptage d'usage
src/main/application/skills/SkillDraftService.ts   brouillons (MCP), duplication
src/main/application/skills/SkillInstaller.ts      installer, versions, revenir
src/main/application/skills/SkillImportService.ts  import, repérage, audit, choix, quarantaine
src/main/application/reprise/CloneService.ts       clone contrôlé (spec 017 T029, livré ici)
src/main/application/ai/SkillCardTask.ts, SkillAuditTask.ts ; src/main/infrastructure/ai/SkillCardFrame.ts, SkillAuditFrame.ts
src/main/application/mcp/SkillTools.ts             skills_lire, skill_brouillon
src/main/infrastructure/db/…                       migration 0033 (+ down), SkillRepository
src/main/ipc/skillsHandlers.ts
src/renderer/src/skills/SkillsPage.tsx             arbre (carte 62 %) + volet 38 %
src/renderer/src/skills/skillTree.ts               disposition (pure)
src/renderer/src/skills/SkillNode.tsx, SkillPanel.tsx (Fiche · SKILL.md · Fichiers · Conversation),
                         DraftPanel.tsx, ImportDialog.tsx, SkillsConversation.tsx
tests/fixtures/skills/                    skills fictifs (dont abîmé, liens, scripts), historiques .jsonl fictifs,
                                          dépôt de démonstration (dont un skill malveillant)
```

## Lots
1. **Voir (US1)** : modèle, en-tête, inventaire (3 familles, chemins sûrs, surveillance), liens écrits, IPC, page Skills
   (entrée de navigation), arbre par familles, fiche brute, filtres, grappe de plugins. Test guidé.
2. **Comprendre (US2)** : migration 0033 (cartes, domaines, liens), tâche `skill_card` + contrôles, analyse à la
   demande, usage (worker), corrections annulables, branches par domaine, liens pointillés, fiche complète. Test guidé.
3. **Faire évoluer (US3)** : migration (brouillons, versions), outils MCP, conversations (neurones cachés), brouillons et
   différences, installer / revenir / conflit disque, duplication, nœuds fantômes, consigne. Test guidé.
4. **Importer (US4)** : `gitUrl.ts` et `CloneService` (spec 017 T028–T029), quarantaine, repérage, règles fixes,
   tâche `skill_audit`, écran d'import, choix, brouillons, nettoyage. Test guidé (aussi T031 de la spec 017 pour le clone).
5. **Finitions** : mesure SC-007, démo, FOUNDATION, CLAUDE.md, JOURNAL.

## Complexity Tracking
| Écart | Pourquoi | Alternative plus simple écartée |
|---|---|---|
| Comptage d'usage dans un worker | Historiques de plusieurs Mo, lecture en flux | Fil principal : gel de l'app |
| Versions de fichiers dans le profil | Retour arrière exact même pour un skill hors dépôt git | git dans `~/.claude/skills` : imposé à l'utilisateur, l'app ne commite pas |
| Audit doublé de règles fixes | Une consigne cachée pourrait adoucir le verdict de Claude | Claude seul : contournable |
| Analyseur YAML maison | Éviter une dépendance pour 3 champs ; pas de types ni d'ancres (sûr) | Bibliothèque YAML complète : surface d'attaque, dépendance |
