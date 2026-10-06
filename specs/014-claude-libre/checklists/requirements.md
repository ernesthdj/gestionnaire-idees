# Specification Quality Checklist: Claude libre — parité avec le terminal

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-06
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- D1–D6 tranchées par mentalyas le 2026-10-06 ; aucune clarification ouverte.
- Choix par défaut à confirmer à la relecture : mode retenu par conversation (pas par neurone) ; « Toujours » par
  projet lié, stocké dans l'app (jamais dans le dépôt) ; avertissement Libre une fois par conversation ; dossier de
  données de l'app jamais autorisable ; réglages utilisateur désactivés par défaut ; livrable étendu aux suppressions
  et aux changements faits par commande (projet sous git).
- Mention « Claude Code » / « CLI » : nom du produit utilisé par mentalyas, pas un détail d'implémentation.
- Point technique ouvert pour le plan (recherche) : relais des demandes de permission vers l'app — protocole de
  contrôle du CLI (`--permission-prompt-tool stdio`, à confirmer par un essai lancé par mentalyas) ou, à défaut, outil
  de permission sur le pont MCP. Le comportement spécifié est le même dans les deux cas.
- Risque de sécurité assumé (D1, mode Libre) : documenté dans la spec, à refléter dans la constitution 4.0.0.
