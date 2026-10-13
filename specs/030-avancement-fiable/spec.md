# Feature Specification: Avancement fiable (spec 030)

**Feature Branch**: `main` · **Created**: 2026-10-13 · **Status**: Livrée (2026-10-13) — lots 1 à 4 (C4, C2, C3, C1), e2e `tests/e2e/avancement.e2e.ts`

> Réparation pendant le gel des fonctionnalités (critique du 2026-10-13) : la carte de structure doit dire où en est
> le projet. Source : `docs/AUDIT-2026-10-12-bike-cycle.md` §3.1 et §4.1 (C1, C2, C3, C4). Spec légère (décisions +
> tâches, sans plan ni recherche) : elle corrige l'existant des specs 009 « Carte de structure » et 017 D21
> « Avancement vivant », sans nouvelle vue. Hors périmètre : F1 (lier `TASKS.md` aux éléments) et C5 (chemins suivis
> automatiquement), après le gel.

## Problème

Sur Bike_cycle, 6 fonctionnalités codées, testées et commitées : la carte en montre 2 « à faire » ou « en cours 90 % »,
et des modules « à faire » avec des enfants livrés. Claude ne peut faire avancer que l'élément de sa conversation
(par identifiant, que `structure_lire` ne donne pas) ; mentalyas ne peut pas corriger un statut ; un commit ne remonte
pas vers la carte ; un module garde son statut propre quel que soit celui de ses enfants.

## Décisions

| # | Décision |
|---|----------|
| D1 | **C4 — MCP** : `element_avancer.element` accepte l'identifiant **ou la clé** d'un élément ; une clé se cherche dans le projet de la conversation (ou `projet`, pour une session sans neurone). `structure_lire` affiche l'identifiant de chaque élément. Message d'erreur explicite si l'élément est introuvable (« pas une étape du plan d'attaque »). Une conversation ne touche jamais un autre projet (inchangé). |
| D2 | **C2 — Statut manuel** : la carte de détails d'un élément **sans sous-éléments** offre un choix de statut (À faire, En cours, Livrée, Bloquée ; le statut courant reste proposé s'il est autre). Écriture marquée « par toi » (`user`), annulable, résumée « Statut d'un élément : … » dans l'Historique. |
| D3 | **Avancement au changement de statut** (domaine pur) : Livrée → 100 %, reste effacé (comme `element_avancer`) ; quitter Livrée ou Faite → l'avancement à 100 % est effacé (sinon un élément « à faire » afficherait 100 %), un avancement partiel est gardé ; À faire efface l'avancement. |
| D4 | **C3 — Statut affiché des parents**, calculé, jamais stocké : un élément qui a des sous-éléments est « livrée » quand tous le sont (livrée ou faite), « bloquée » s'il est bloqué lui-même, « en cours » dès qu'un sous-élément est livré, en cours ou a un avancement, sinon son propre statut. Utilisé pour la pastille, le nom accessible et la carte de détails (« d'après ses sous-éléments »). |
| D5 | **C1 — Livrée au commit** : après un commit réussi dans le volet Dépôt, l'app cherche les éléments **feuilles** du projet, ni livrés ni faits, dont un chemin couvre un fichier commité (même fichier, ou dossier parent). S'il y en a, le volet propose « Passer en livrée » avec une case par élément, cochée d'office ; un clic écrit un seul lot « par toi », annulable. Rien n'est écrit sans ce clic. |
| D6 | Un élément sans chemin n'est jamais proposé au commit (limite connue, A27) : D2 permet de le corriger à la main. |
| D7 | Aucune migration, aucune dépendance : le statut, l'avancement et le journal d'annulation `element_progress` existent déjà. |

## Exigences

- **FR-001** `element_avancer` : `element` = identifiant ou clé (1–300 caractères) ; champ `projet` optionnel.
- **FR-002** `structure_lire` : chaque ligne porte l'identifiant de l'élément.
- **FR-003** IPC `element:setStatus` `{ elementIds: uuid[1..50], status }` (Zod) : tous du même projet, sinon refus ;
  un seul lot `user` ; retourne `{ batchId }`.
- **FR-004** IPC `structure:covered` `{ genesisId, paths: ProjectFile[1..2000] }` : éléments feuilles non livrés dont un
  chemin couvre l'un des fichiers ; lecture seule.
- **FR-005** Renderer : choix de statut dans la carte de détails d'une feuille ; statut calculé des parents (D4) ;
  proposition « Passer en livrée » dans l'onglet Changements après un commit.

## Critères de réussite

- **SC-001** Sur le profil démo, un élément passé « livrée » à la main, puis annulé, revient à son état d'avant.
- **SC-002** Un module dont tous les enfants sont livrés s'affiche « livrée » ; dès qu'un enfant avance, « en cours ».
- **SC-003** Un commit qui touche le fichier d'un élément propose de le passer « livrée » ; un clic le fait.
- **SC-004** Claude fait avancer un autre élément du projet par sa clé ; un élément d'un autre projet est refusé.
