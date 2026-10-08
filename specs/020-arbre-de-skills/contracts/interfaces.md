# Contracts — Arbre de skills (spec 020)

Format IPC uniforme `{ success, data } | { success: false, error }` ; entrées Zod ; canaux sans paramètre :
`z.undefined()`. Le renderer ne transmet jamais de chemin : seulement des identifiants de skills, de brouillons,
d'imports.

## Voir
| Canal | Entrée | Sortie | Erreurs |
|---|---|---|---|
| `skills:list` | `undefined` | `{ skills: SkillView[], links: SkillLinkView[], domains: DomainView[], scannedAt }` | — |
| `skills:get` | `{ skillId }` | `SkillDetailView` : vue + `markdown` (≤ 200 Ko), `files: { path, size, executable }[]`, `card?`, `origin`, `versions` | `NOT_FOUND`, `TOO_LARGE` |
| `skills:changed` (événement) | — | `{ scannedAt }` | — |

`SkillView` : `{ id, family, name, description, origin (libellé), hasScripts, damaged, sameNameAs?, modifiedAt,
contentHash, domainId?, stars?, starsSource?, usage?: { calls30d, lastAt } }`.

## Comprendre
| Canal | Entrée | Sortie | Erreurs |
|---|---|---|---|
| `skills:cards` | `{}` | `{ cards: Record<skillId, SkillCardView>, domains, links }` (fiches, domaines, liens de sens) | — |
| `skills:analyze` | `{ skillIds?: string[] ≤ 30 }` | `{ analysisId }` | `ANALYSIS_RUNNING`, `AI_UNAVAILABLE` |
| `skills:analyzeProgress` (événement) | — | `{ analysisId, done, total, failed }` | — |
| `skills:setStars` | `{ skillId, stars: 1..5 \| null }` | `{ batchId }` | `NOT_FOUND` |
| `skills:setDomain` | `{ skillId, domainId }` | `{ batchId }` | `NOT_FOUND`, `VALIDATION` |
| `skills:acceptDomain` | `{ domainId }` (domaine proposé) | `{}` | `NOT_FOUND` |
| `skills:link` | `{ from, to, kind }` | `{ batchId }` | `VALIDATION` |
| `skills:unlink` | `{ linkId }` | `{ batchId }` | `NOT_FOUND` |
| `skills:usage` | `undefined` | `Record<skillId, { calls30d, lastAt }>` | — |

## Faire évoluer
| Canal | Entrée | Sortie | Erreurs |
|---|---|---|---|
| `skills:conversation` | `{ skillId? }` | `{ neuronId }` | — |
| `skills:drafts` | `{ skillId? }` | `SkillDraftView[]` | — |
| `skills:draftDiff` | `{ draftId }` | `{ files: { path, status, before, after }[], diskChanged, isNew }` | `NOT_FOUND` |
| `skills:install` | `{ draftId, confirm: true, acceptDiskChange?: true }` | `{ batchId, skillId }` | `DISK_CHANGED`, `NAME_TAKEN`, `READ_ONLY_FAMILY`, `VALIDATION` |
| `skills:discardDraft` | `{ draftId }` | `{}` | `NOT_FOUND` |
| `skills:restore` | `{ skillId, confirm: true }` | `{ batchId }` | `NO_VERSION`, `READ_ONLY_FAMILY` |
| `skills:duplicate` | `{ skillId }` | `{ draftId }` | `NAME_TAKEN` |

## Importer
| Canal | Entrée | Sortie | Erreurs |
|---|---|---|---|
| `skills:import` | `{ url: string ≤ 500 }` (dépôt déjà présent : mise à jour) | `{ importId }` | `URL_REFUSED`, `IMPORT_RUNNING` |
| `skills:importProgress` (événement) | — | `{ importId, step, done?, total?, errorCode? }` | — |
| `skills:library` | `{}` | `LibraryRepoView[]` (dépôts de la bibliothèque et leurs skills disponibles, D12) | — |
| `skills:librarySkill` | `{ candidateId }` | `{ skill: LibrarySkillView, markdown }` | `NOT_FOUND` |
| `skills:libraryInstall` | `{ candidateId, scripts: string[], unlockDangerous?: true }` | `{ draftId }` (audit de Claude d'abord si besoin) | `VALIDATION`, `DANGEROUS_LOCKED`, `IMPORT_RUNNING` |
| `skills:libraryRemove` | `{ repoId, confirm: true }` | `{}` | `NOT_FOUND`, `IMPORT_RUNNING` |
| `skills:importCancel` | `{ importId }` | `{}` | — |

## Outils MCP
| Outil | Entrée | Effet |
|---|---|---|
| `skills_lire` | `{ skill?: string }` (identifiant) | Toile (noms, descriptions, familles, domaines, étoiles, liens) ; avec `skill` : son `SKILL.md` (≤ 60 000 car.) et ses fichiers ; lecture par le main dans les racines connues |
| `skill_brouillon` | `{ skill: [a-z0-9-]{1,64}, famille: perso \| projet, projet?: uuid, description ≤ 600, contenu ≤ 100 000, annexes?: { chemin, contenu }[] ≤ 20 }` | Crée ou remplace le brouillon ouvert ; **aucune écriture disque** ; marqué « par Claude », historisé ; annexes exécutables refusées |

## Tâches AIGateway (sans outil)
- `skill_card` : entrée balisée (`<skill>`, `<toile>`, `<domaines>`), sortie `SkillCard` (voir
  `docs/brainstorm/L3-skills-comprendre.md` §2).
- `skill_audit` : entrée balisée (`<skill>`, `<fichiers>`, `<scripts>` extraits), sortie
  `{ verdict, raisons, role }` (voir `docs/brainstorm/L3-skills-importer.md` §3).

## Commandes git
`git clone --depth 1 --no-recurse-submodules -c core.hooksPath=<vide> -- <url> <skill-library/<hôte>/<auteur>/<dépôt>@<version>>` ;
`git -C <même dossier> rev-parse HEAD` (D12 : aucun renommage). Aucune autre commande.
