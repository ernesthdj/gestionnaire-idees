# Niveau 3 — Conception Technique : SK-A — Voir la toile de skills
> Basé sur : L1h-arbre-de-skills.md (A1, A3, A6, A8) + L2-skills-voir.md · Date : 2026-10-07

## 1. Contrat IPC
| Canal | Entrée (Zod) | Sortie | Erreurs |
|-------|--------------|--------|---------|
| `skills:list` | `undefined` | `SkillsView` : `{ skills: SkillView[], links: SkillLinkView[], domains: DomainView[], scannedAt }` | — |
| `skills:get` | `{ skillId }` | `SkillDetailView` : vue + `markdown` (≤ 200 Ko, texte), `files: { path, size, executable }[]`, fiche (lot B) | `NOT_FOUND`, `TOO_LARGE` |
| `skills:changed` (événement) | — | `{ scannedAt }` | — |

- `skillId` = `<famille>:<clé>` calculé par le main (`perso:hub`, `projet:<genesisId>:journal`, `plugin:<marketplace>/<plugin>:<nom>`) ;
  le renderer ne donne **jamais** de chemin.
- `SkillView` : `{ id, family, name, description, title, origin (libellé lisible, sans chemin absolu), hasScripts,
  damaged, shadowedBy (id de celui qui l'emporte), modifiedAt, contentHash, domain?, stars?, usage? }`.

## 2. Inventaire (`SkillInventory`, main)
| Famille | Racine | Règle |
|---------|--------|-------|
| perso | `os.homedir()/.claude/skills/*/SKILL.md` | 1 niveau |
| projet | `<dossier lié>/.claude/skills/*/SKILL.md` pour chaque genesis lié (spec 008/016/017) | 1 niveau, dossier lié vérifié |
| plugin | `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/**/skills/*/SKILL.md` | seule la version la plus récente (tri semver) de chaque plugin ; profondeur ≤ 6 |

- Lecture : `realpath` de chaque fichier ; refus s'il sort de sa racine (lien symbolique) ; `SKILL.md` ≤ 200 Ko ; fichiers
  annexes listés (≤ 300), jamais lus au lot A.
- En-tête : front matter YAML entre `---` lu par un analyseur **sans exécution** (sous-ensemble clé : valeur, chaînes ;
  `name`, `description`, `trigger` facultatif), Zod ; échec → `damaged: true`.
- `executable` : extension parmi `.sh .bash .ps1 .bat .cmd .js .mjs .cjs .ts .py .rb .exe .dll` ou bit d'exécution.
- Ombre : même `name` en perso et plugin → le perso l'emporte (comportement de Claude Code à confirmer au plan ; sinon
  simple mention « même nom »).
- Surveillance : `fs.watch` sur les racines perso et projets (récursif sous Windows), regroupement 1 s → réinventaire →
  `skills:changed`. Les plugins sont relus à l'ouverture de la page seulement.

## 3. Liens écrits (pur, `domain/skills/links.ts`)
- Pour chaque skill A et chaque autre skill B : lien « appelle » A → B si le texte de A contient `/<B.name>` suivi d'une
  frontière (espace, ponctuation, fin) **ou** « skill <B.name> » / « skill `<B.name>` » (mot entier, insensible à la casse).
- Exclus : auto-lien ; noms de moins de 3 caractères ; occurrences dans un bloc de code de type URL (`https?://…/<nom>`).
- Sortie : `{ from, to, kind: 'appelle', origin: 'ecrit', evidence: 'ligne N' }` ; recalcul à chaque inventaire.

## 4. Disposition (pure, `renderer/src/skills/skillTree.ts`)
- Tronc « Toi » au centre ; N branches (domaines ; au lot A, familles) réparties en éventail sur 360° ; le long d'une
  branche, les skills par note décroissante (puis nom), en rangées de 3 perpendiculaires à la branche, pas de 200 px.
- Nœud 208 × 104 px ; aucun chevauchement (test) ; mêmes entrées → mêmes positions.

## 5. Données
Rien de stocké au lot A (inventaire en mémoire, recalculé). Lots B et C ajoutent les tables (voir leurs L3).

## 6. Cas limites
- **Volumétrie :** ~120 skills ; inventaire < 300 ms (lecture des seuls `SKILL.md`), mis en cache jusqu'au prochain
  changement surveillé.
- **Concurrence :** un seul inventaire à la fois (promesse partagée).
- **Dossier absent** (`~/.claude/skills` inexistant) : famille vide, pas d'erreur.

## 7. Sécurité
| Risque | Vecteur | Mitigation |
|--------|---------|------------|
| Lecture hors des dossiers de skills | Lien symbolique, chemin forgé | Racines fixes, `realpath` + inclusion, `skillId` résolu par le main |
| Injection par le texte d'un skill | Consigne cachée | L'app ne l'interprète jamais ; rendu Markdown assaini (pas de HTML brut) |
| Fuite de chemins personnels | Affichage | Origine en libellé relatif (« personnel », « plugin vercel 0.50.0 ») |
| YAML piégé | Balises, références | Analyseur minimal sans types ni ancres |
