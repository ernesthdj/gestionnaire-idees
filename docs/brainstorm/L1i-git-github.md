# L1i — Git et GitHub dans le Brainstormer (brouillon, niveau 1)

> Brainstorm du 2026-10-07 avec mentalyas. Document construit au fil des réponses ; rien n'est encore décidé.
> Statut : **niveau 1 validé** ; niveaux 2 à 4 rédigés le 2026-10-07 (§9), **à valider en bloc**.

## 1. L'idée en une phrase
Faire du Brainstormer le **prolongement du git local vers GitHub** : récupérer un projet depuis un lien GitHub,
voir **qui a fait quoi et quand**, puis créer un dépôt sur son propre compte et y commiter, tirer (pull) et pousser
(push) sans quitter l'app.

## 2. Usages exprimés
| # | Usage | Détail |
|---|-------|--------|
| G1 | Récupérer un projet par lien GitHub | Projets open source à étudier (« scrapper »), projets de collègues |
| G2 | Travailler à plusieurs | Collaboration avec des collègues sur un même dépôt |
| G3 | Chronologie des contributions | Qui a fait quoi et quand, par collaborateur |
| G4 | Publier sur son GitHub | Créer un dépôt sur le compte de mentalyas à partir d'un projet local |
| G5 | Synchroniser | Commit, pull, push au quotidien |

## 3. Ce qui existe déjà
- **Initialiser git** (spec 016) : `git init`, premier commit d'un projet.
- **Commiter l'étape** (spec 013) : commit du livrable d'une étape.
- **Clone contrôlé** prévu (spec 017 US5 = spec 020 T026–T027) : adresse vérifiée, `--depth 1`, sans sous-modules,
  hooks désactivés, quarantaine. Un clone **superficiel** ne donne pas l'historique : G3 demandera un clone complet.
- **Reprise d'un projet** (spec 017) : explorateur, diagnostic, cartographie : un projet cloné en profitera.

## 4. Décisions
- **D1 — Collaboration par git / GitHub seulement** : les collègues gardent leurs outils ; le Brainstormer récupère
  leur travail (pull) et le montre (chronologie, auteurs). Aucune donnée de l'app (cartes, fiches) n'est partagée ;
  tout reste sur le poste de mentalyas.
- **D2 — Claude propose, mentalyas clique** : Claude peut préparer le message de commit (Conventional Commits) et
  proposer un découpage en commits ; seul un clic de mentalyas, après lecture du diff, commite ou pousse. L'app ne
  pousse jamais d'elle-même.
- **D3 — Connexion par git et `gh` du poste** : l'app lance `git` et `gh` (chemin absolu, sans shell) déjà connectés
  par mentalyas (gestionnaire d'identifiants Windows, `gh auth login`) ; elle ne lit, ne stocke ni ne journalise
  aucun jeton. `gh` absent ou non connecté : message qui indique la commande à lancer. Le programme `gh` s'ajoute à
  la liste du principe I.
- **D4 — Périmètre complet** : en plus de clone / commit / pull / push : **branches** (créer, changer, voir la
  courante), **conflits guidés par Claude** (il explique les deux versions et propose ; mentalyas valide fichier par
  fichier), **pull requests** (ouvrir, voir celles des collègues et leur statut, via `gh`), **issues** (voir, relier aux
  nœuds ou étapes de la carte). Le découpage MVP / suite se fera au signal de complexité.
- **D5 — Chronologie = frise + carte colorisée** : une frise des commits (une ligne par auteur, curseur de temps) ;
  en déplaçant le curseur, les nœuds de la cartographie (spec 017) se colorent selon qui les a touchés : une
  « rediffusion » du projet. Couleur + initiales (jamais la couleur seule, WCAG). Noms et e-mails des auteurs : lus
  dans git, affichés, jamais envoyés ailleurs ni écrits dans le dépôt public de l'app.
- **D6 — Volet « Dépôt » sur la carte du projet** : volet latéral à onglets Changements (diff, commit) · Branches ·
  Historique (frise) · PR · Issues ; badge sur le nœud genesis (« 3 à pousser · 2 à tirer », branche courante). Le
  clone par lien passe par l'import de projet existant (spec 017 « Reprendre un projet » : dossier, git… et lien
  GitHub), qui crée le genesis puis ouvre la reprise.
- **D7 — Open source : les quatre usages** : **étudier** (reprise en lecture, conversations), **extraire** des
  morceaux vers `snippets/` / `techno/` (licence lue et affichée avant toute copie, attribution gardée), **forker et
  contribuer** (fork sur le compte de mentalyas, PR vers l'origine), **suivre** ses mises à jour (pull, « ce qui a
  changé depuis ta dernière visite »).

## 5. Lots proposés (découpage)
| Lot | Contenu | Usages |
|-----|---------|--------|
| A | Volet Dépôt local : changements, diff, commit (message proposé par Claude), branches, badge | G5 |
| B | Publier sur GitHub (`gh repo create`, privé par défaut), pull / push, remote suivi | G4, G5 |
| C | Cloner par lien (clone complet) → import + reprise ; suivre les mises à jour | G1, D7 |
| D | Historique : frise par auteur + carte colorisée | G3 |
| E | Conflits guidés par Claude | G2 |
| F | Pull requests, issues (liées aux nœuds), fork | G2, D7 |
| G | Extraire un morceau (licence, attribution) | D7 |

MVP proposé : **A + B + C** (le git local prolongé vers GitHub, et la récupération par lien), puis D, E, F, G.

## 6. Sécurité (macro)
- **Code cloné = non fiable** : jamais exécuté par l'app (ni `npm install`, ni scripts, ni hooks : `core.hooksPath`
  vers un dossier vide pour tout dépôt cloné) ; adresse contrôlée (`https://` / `git@`, pas d'`ext::`, de `file://`
  ni d'option déguisée), protocole et taille bornés.
- **Textes venus de GitHub = données** (README, messages de commit, issues, PR, noms d'auteurs) : jamais des
  consignes pour Claude ; balisés comme tels dans ses cadres.
- **Push** : destination affichée (dépôt + branche) avant le clic ; jamais `--force` ; refus vers `main` d'un dépôt
  tiers sans fork.
- **Avant le premier push d'un dépôt** : recherche de fichiers sensibles (`.env`, clés, `*.pem`…) et du `.gitignore` ;
  alerte bloquante si trouvés.
- **Aucun jeton** lu, stocké ni journalisé (D3) ; e-mails d'auteurs seulement affichés (D5).
- **Commits de Claude** : messages proposés, jamais de ligne `Co-Authored-By` ajoutée d'office (règle de mentalyas).

## 7. Point de constitution
Principe II : « l'app ne commite jamais d'elle-même » et **ne pousse jamais**. G4–G5 exigent un amendement
limité : commit et push **uniquement sur clic de mentalyas**, diff affiché avant (D2). Principe I : ajouter `gh`
(D3). Les exceptions existantes (branches `analyste/*`, écriture des skills) ne changent pas.

## 8. Questions ouvertes (niveaux 2–3) — tranchées, **proposé, à valider par mentalyas**
- [x] **Hooks git de mentalyas dans ses propres projets : les exécuter au commit ?** → **Oui, mais seulement dans un
  dépôt marqué « de confiance »** (la marque existante de la spec 014, `trusted_projects`) ; partout ailleurs, et
  toujours pour un dépôt cloné, les hooks sont désactivés (`core.hooksPath` vers un dossier vide, `core.fsmonitor`
  coupé). Un hook qui échoue bloque le commit et sa sortie s'affiche ; **jamais** de `--no-verify`.
  *Pourquoi :* un hook est un programme ; dans ses projets, c'est son filet (lint, tests) et le contourner trahirait
  la règle « jamais `--no-verify` » ; dans un dépôt d'autrui, c'est du code non fiable. Réutiliser la marque de
  confiance évite un deuxième réglage (YAGNI) et garde un seul geste conscient. *Détail :* `L3-git-depot-local.md` §2.
- [x] **Clone complet d'un gros dépôt : limite de taille, ou clone partiel ?** → **Clone partiel
  `--filter=blob:none` par défaut** pour la reprise par lien, case « Tout télécharger maintenant » pour travailler hors
  ligne ; **pas de plafond dur**, un avertissement à 500 Mo reçus (« Continuer / Annuler ») ; l'import de skills
  (spec 020) garde son clone superficiel `--depth 1` borné à 50 Mo. Un seul `CloneService` à deux profils.
  *Pourquoi :* le clone partiel apporte **tout l'historique** (commits, auteurs, dates, noms de fichiers : tout ce que
  G3 et la frise demandent) pour une fraction du poids ; le contenu des anciennes versions n'arrive que si on ouvre
  leur diff. Un plafond dur bloquerait les grands projets open source qu'on veut justement étudier.
  *Détail :* `L3-git-cloner.md` §1.
- [x] **Où vont les dépôts clonés ?** → **Dans un dossier parent choisi au sélecteur natif à chaque clone**, pré-
  positionné sur le dernier dossier de clone, sinon la racine des projets (spec 016) ; **jamais** dans le profil de
  l'app ; pas d'inscription d'office au registre du hub.
  *Pourquoi :* le dossier de données de l'app ne doit jamais être ouvert à Claude (constitution I), or un projet
  repris a ses conversations ; le sélecteur natif est déjà la règle de la spec 017 (FR-001) ; laisser l'Archiviste
  inscrire au hub ce qui mérite de l'être évite de mêler projets d'étude et projets de mentalyas.
  *Détail :* `L2-git-cloner.md` UC-1.

## 9. Niveaux 2–4 (rédigés le 2026-10-07)
| Niveau | Fichier | Lot | Complexité |
|--------|---------|-----|------------|
| 2 | `L2-git-depot-local.md` | A — volet Dépôt local | Niveau 3 (socle commun) |
| 2 | `L2-git-publier.md` | B — publier, tirer, pousser | Niveau 3 |
| 2 | `L2-git-cloner.md` | C — cloner par lien, suivre | Niveau 3 |
| 2 | `L2-git-historique.md` | D — frise + carte colorisée | Niveau 2 suffisant |
| 2 | `L2-git-conflits.md` | E — conflits guidés | Niveau 3 |
| 2 | `L2-git-pr-issues.md` | F — PR, issues, fork | Niveau 3 |
| 2 | `L2-git-extraire.md` | G — extraire (licence) | Niveau 2 suffisant |
| 3 | `L3-git-depot-local.md` | A + socle (`GitRunner`, tables, codes d'erreur) | — |
| 3 | `L3-git-publier.md` | B + **amendement de constitution proposé** (§7, 4.3.0 → 4.4.0) | — |
| 3 | `L3-git-cloner.md` | C + réconciliation du clone (spec 017 US5 / spec 020 R7) | — |
| 3 | `L3-git-conflits.md` | E | — |
| 3 | `L3-git-pr-issues.md` | F | — |
| 4 | `L4g-git.md` | Parcours écran (badge, volet à 5 onglets, publier, push, lien, rediffusion, conflits) | — |

**MVP confirmé : A + B + C** (le git local prolongé vers GitHub, et la récupération par lien), avec un garde-fou :
sans le lot E, un pull qui rencontre des conflits **annule proprement la fusion** et explique quoi faire.
**Ordre de suite ajusté : E, puis D, F, G** (au lieu de D, E, F, G) — la collaboration (G2) rencontre des conflits
dès le premier pull divergent, alors que la frise (D) n'est qu'en lecture. *Proposé, à valider par mentalyas.*
