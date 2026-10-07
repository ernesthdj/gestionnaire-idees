# Analysis Report — spec 020 « Arbre de skills » (/speckit-analyze, 2026-10-07)

| ID | Catégorie | Gravité | Emplacement | Constat | Recommandation |
|----|-----------|---------|-------------|---------|----------------|
| H1 | Sécurité / constitution I | HIGH | research R5, T023 ; SC-002 | Conversations Skills avec outils d'écriture : en mode « Libre », Claude pourrait écrire directement dans `~/.claude/skills` | Outils limités à `Read Glob Grep` + `skills_lire` / `skill_brouillon`, mode figé, test des arguments |
| H2 | Constitution I | HIGH | data-model `allowed_scripts`, T021, T030 | Brouillon d'import avec scripts autorisés retravaillé par Claude : exécutable écrit depuis un brouillon de Claude | Réécriture par Claude vide `allowed_scripts`, origine → `claude` |
| M1 | Coordination | MEDIUM | T012 | Numéro de migration en conflit possible avec un travail parallèle | Prochain numéro libre au moment de coder |
| M2 | Couverture | MEDIUM | SC-006 | Aucune mesure | Chronomètre au test guidé T019 |
| L1 | Couverture | LOW | FR-008 | Plugins non surveillés | Préciser FR-008 |

**Métriques** : 36 exigences (29 FR + 7 SC), 34 tâches, couverture 97 %, CRITICAL 0, HIGH 2, MEDIUM 2, LOW 1.

## Remédiation
Appliquée le 2026-10-07 après validation de mentalyas : H1 → research R5, T023 ; H2 → data-model, T021 ; M1 → T012 ;
M2 → T019 ; L1 → FR-008.
