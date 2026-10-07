# Niveau 4 (amendement) — Parcours écran : Git et GitHub dans le Brainstormer
> Projet : Gestionnaire_idées · Basé sur : L1i-git-github.md, L2-git-*.md (GIT-A à GIT-G), L3-git-*.md
> Amende : L4-parcours.md, L4d-reprise.md (assistant « Reprendre un projet ») · Date : 2026-10-07
> Règles : `docs/claude/ergonomie-ui.md` (Fitts, Hick, Miller, grille 8 px, 62/38, 1 CTA par écran, WCAG AA)

## 0. Principes d'interface de la fonctionnalité
- **Un seul endroit** : le volet « Dépôt » (droite, 38 % ; la carte garde 62 %), ouvert depuis le badge du genesis.
  Cinq onglets (Hick : ≤ 7) : **Changements · Branches · Historique · PR · Issues** ; PR et Issues masqués hors
  GitHub.
- **Un CTA (bouton principal) par onglet**, toujours au même endroit : en bas du volet, pleine largeur, 40 px de haut
  (Fitts : grand, proche de la liste qu'il conclut). Les actions secondaires sont des boutons de 32 px.
- **État toujours visible** (Nielsen 1) : en-tête du volet = branche courante + écart avec GitHub, en texte.
- **Jamais la couleur seule** : statuts de fichier = icône + lettre ; écart = flèches + nombres + mots ; auteurs =
  couleur + initiales ; verdicts = icône + libellé. Contraste ≥ 4,5:1 (texte), ≥ 3:1 (pastilles).
- **Clavier** : `Ctrl+Maj+G` ouvre / ferme le volet Dépôt ; flèches dans les listes ; `Espace` coche un fichier ;
  `Ctrl+Entrée` déclenche le CTA de l'onglet ; modales avec piège de focus et `Échap`.
- **Grille 8 px** : marges internes 16 px, lignes de liste 32 px, espacement entre groupes 24 px.
- Exemples ci-dessous : noms et comptes **fictifs** (`ana-dev`, `mentalyas-demo`, `projet-demo`).

## 1. Parcours principaux

### P1 — Le commit du soir (lot A)
| Étape | Écran | Action utilisateur | Fonctionnalité liée |
|-------|-------|---------------------|----------------------|
| 1 | E1 Carte du projet | Voit sur le genesis : `⎇ main · 4 modifiés · ↑0 ↓0` | GIT-A UC-1 |
| 2 | E1 | Clic sur le badge → volet Dépôt, onglet Changements | GIT-A |
| 3 | E2 Changements | Clic sur `src/app.ts` → diff sous la liste ; coche 3 fichiers (`Espace`) | GIT-A UC-2 |
| 4 | E2 | « Proposer un message » → `feat(demo): ajoute l'export CSV` + carte « Claude suggère 2 commits » | GIT-A UC-2, UC-3 |
| 5 | E2 | Corrige un mot ; CTA **Commiter (3 fichiers)** | GIT-A |
| 6 | E2 | Toast « Commit a1b2c3d sur main » ; badge `↑1` ; le CTA devient **Pousser (1)** | GIT-A → GIT-B |

### P2 — Publier un projet sur son GitHub (lot B)
| Étape | Écran | Action utilisateur | Fonctionnalité liée |
|-------|-------|---------------------|----------------------|
| 1 | E2 | Projet sans remote : bandeau « Pas encore sur GitHub » + CTA **Publier sur GitHub** | GIT-B UC-1 |
| 2 | E3 Publier (modale) | Voit « Connecté : mentalyas-demo » ; nom proposé, description, **Privé** coché | GIT-B |
| 3 | E3 | Bloc « Contrôle avant publication » : ✓ `.gitignore` présent, ✓ aucun fichier sensible (12 commits) | GIT-B GB-4 |
| 4 | E3 | CTA **Publier** → progression → « En ligne : mentalyas-demo/projet-demo » (lien) | GIT-B |
| 4 bis | E3 | Cas bloquant : « ⛔ `.env` dans le commit 9f8e7d6 (3 août) » + explication ; CTA désactivé | GIT-B |

### P3 — Récupérer le travail d'une collègue, puis conflit (lots B, E)
| Étape | Écran | Action utilisateur | Fonctionnalité liée |
|-------|-------|---------------------|----------------------|
| 1 | E2 | En-tête : « ↓2 à tirer (vérifié il y a 1 min) » ; bouton **Tirer (2)** | GIT-B UC-2, UC-3 |
| 2 | E2 | Divergence : message « Toi et ana-dev avez chacun des commits » + CTA **Fusionner** | GIT-B UC-3 |
| 3 | E7 Résolution | Conflits : la carte cède la place à la vue de résolution (62 %), la liste des fichiers reste à droite (38 %) | GIT-E UC-1 |
| 4 | E7 | Fichier `src/prix.ts` : trois colonnes La tienne · La leur · Proposition ; explication de Claude au-dessus | GIT-E UC-2 |
| 5 | E7 | Choisit bloc par bloc (5 boutons radio), aperçu ; **Valider ce fichier** | GIT-E |
| 6 | E7 | Tous résolus → CTA **Terminer la fusion** ; retour à la carte, `↑2` → **Pousser (2)** | GIT-E UC-3, GIT-B UC-4 |

### P4 — Étudier un projet open source et le suivre (lot C)
| Étape | Écran | Action utilisateur | Fonctionnalité liée |
|-------|-------|---------------------|----------------------|
| 1 | E5 Reprendre un projet · Source | Choisit **Depuis un lien GitHub**, colle l'adresse | GIT-C UC-1 |
| 2 | E5 | « Où le ranger ? » → sélecteur natif (pré-positionné) ; nom du dossier proposé | GIT-C |
| 3 | E5 · Clone | Progression par phase, **Annuler** ; option « Tout télécharger » repliée | GIT-C |
| 4 | E5 · Aperçu / Confidentialité | Suite de la spec 017 → genesis, analyse, guide de reprise | spec 017 |
| 5 | E1 (une semaine plus tard) | Badge « ✦ 14 nouveautés » sur le genesis | GIT-C UC-2 |
| 6 | E2 Historique | Section « Depuis ta dernière visite » ; **Tirer (14)** ; modules touchés surlignés sur la carte | GIT-C UC-2 |

### P5 — Rejouer qui a fait quoi (lot D)
| Étape | Écran | Action utilisateur | Fonctionnalité liée |
|-------|-------|---------------------|----------------------|
| 1 | E2 Historique | Frise : une ligne par auteur (initiales + couleur), zoom Semaine / Mois / Année | GIT-D UC-1 |
| 2 | E2 | CTA **Rejouer sur la carte** | GIT-D UC-2 |
| 3 | E6 Carte en mode Historique | Les nœuds prennent couleur + initiales ; curseur et ▶ en bas de la carte | GIT-D UC-2 |
| 4 | E6 | Clic sur un module → panneau « AD 62 % · MD 30 % · LB 8 % » + derniers commits | GIT-D |
| 5 | E6 | **Quitter la rediffusion** (ou `Échap`) → carte normale | GIT-D |

### P6 — Contribuer à un projet tiers (lot F)
| Étape | Écran | Action utilisateur | Fonctionnalité liée |
|-------|-------|---------------------|----------------------|
| 1 | E4 Récapitulatif de push | Push vers un dépôt tiers refusé : « Tu n'as pas les droits : forke d'abord » + CTA **Forker** | GIT-B GB-7, GIT-F UC-4 |
| 2 | E4 | Récapitulatif du fork (« origin → ton fork, upstream → l'original ») → **Forker** | GIT-F |
| 3 | E2 PR | CTA **Nouvelle PR** → formulaire ; « Proposer » remplit titre et description | GIT-F UC-1 |
| 4 | E2 PR | Récapitulatif `auteur-x/projet:main ← mentalyas-demo:fix/typo` → **Ouvrir la PR** → « #57 ouverte » | GIT-F |

### P7 — Relier une issue à la carte (lot F)
| Étape | Écran | Action utilisateur | Fonctionnalité liée |
|-------|-------|---------------------|----------------------|
| 1 | E2 Issues | Liste ; glisse `#42 Export lent` sur le nœud « Export » (ou menu ⋯ « Relier à un nœud ») | GIT-F UC-3 |
| 2 | E1 | Le nœud porte la pastille `#42` ; clic → détail de l'issue dans le volet | GIT-F |

### P8 — Garder un morceau dans sa bibliothèque (lot G)
| Étape | Écran | Action utilisateur | Fonctionnalité liée |
|-------|-------|---------------------|----------------------|
| 1 | Explorateur de reprise | Menu ⋯ sur une fonction → « Extraire vers ma bibliothèque » | GIT-G |
| 2 | E8 Extraire (modale) | Lit « Licence : MIT — copie permise, garder la mention » ; choisit `snippets/csv/` | GIT-G |
| 3 | E8 | Aperçu avec en-tête d'attribution → **Extraire** | GIT-G |

## 2. Maquettes (ASCII)

### E1 — Badge sur le nœud genesis
```
┌──────────────────────────────────────┐
│ ◆ Projet démo                        │
│ Application de suivi d'export        │
├──────────────────────────────────────┤
│ ⎇ main   ● 4 modifiés   ↑1 ↓2        │   ← badge cliquable (32 px), ouvre le volet Dépôt
└──────────────────────────────────────┘
États du badge (texte toujours présent) : « à jour » · « ⚠ fusion en cours » · « ✦ 14 nouveautés »
· « non vérifié depuis 2 h » · « dossier introuvable » · « pas de git — Initialiser »
```

### E2 — Volet Dépôt, onglet Changements (38 % à droite)
```
┌─ Dépôt ───────────────────────────────────────────── ⟳ ─ ✕ ┐
│ ⎇ main ▾      ↑1 à pousser · ↓2 à tirer (il y a 1 min)     │  en-tête : état + Tirer / Pousser (secondaires)
│ [ Tirer (2) ]  [ Pousser (1) ]                              │
├─────────────────────────────────────────────────────────────┤
│ Changements │ Branches │ Historique │ PR │ Issues          │  onglets (32 px)
├─────────────────────────────────────────────────────────────┤
│ Fichiers modifiés (4)                     [Tout décocher]  │
│ ☑ M  src/app.ts                     +12 −3                 │  ligne 32 px ; lettre + icône
│ ☑ M  src/export/csv.ts              +40 −0                 │
│ ☑ A  docs/export.md                 +18                    │
│ ☐ M  .env               🔒 fichier sensible, jamais commité │  case verrouillée, raison en texte
├─────────────────────────────────────────────────────────────┤
│ src/app.ts                                                 │  diff du fichier sélectionné
│  41   const rows = load()                                   │
│  42 − export(rows)                                          │  − / + en plus de la couleur
│  42 + exportCsv(rows, { separator: ';' })                   │
├─────────────────────────────────────────────────────────────┤
│ Message                              [ Proposer un message ]│
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ feat(demo): ajoute l'export CSV                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ✦ Claude suggère 2 commits  [Voir le découpage]             │
├─────────────────────────────────────────────────────────────┤
│ [            Commiter (3 fichiers)            ]   Ctrl+Entrée│  CTA unique, 40 px
└─────────────────────────────────────────────────────────────┘
```

### E3 — Publier sur GitHub (modale, 560 px)
```
┌─ Publier sur GitHub ─────────────────────────────────── ✕ ┐
│ Compte connecté : mentalyas-demo (via gh)                  │
│ Nom du dépôt   [ projet-demo                          ]    │
│ Description    [ Suivi d'export (facultatif)          ]    │
│ Visibilité     (●) Privé   ( ) Public                      │
│                                                            │
│ Contrôle avant publication                                 │
│  ✓ .gitignore présent                                      │
│  ✓ Aucun fichier sensible dans les 12 commits              │
│                                                            │
│ Sera créé : mentalyas-demo/projet-demo (privé)             │
│ Sera poussé : main — 12 commits                            │
│                                      [Annuler] [ Publier ] │
└────────────────────────────────────────────────────────────┘
Bloquant : « ⛔ .env ajouté dans le commit 9f8e7d6 (3 août) — il serait public sur GitHub. Retire-le de l'historique
(terminal ou conversation avec Claude), puis réessaie. » ; [Publier] désactivé, pas de « publier quand même ».
gh absent : « Installe GitHub CLI : winget install GitHub.cli, puis gh auth login » + [Copier la commande].
```

### E4 — Récapitulatif de push (modale)
```
┌─ Pousser ──────────────────────────────────────────── ✕ ┐
│ Destination  origin → mentalyas-demo/projet-demo         │
│ Branche      feat/export → feat/export (nouvelle)        │
│ Commits (3)                                              │
│  • a1b2c3d  feat(demo): ajoute l'export CSV   il y a 1 h │
│  • d4e5f6a  test(demo): couvre le séparateur  il y a 1 h │
│  • 0b1c2d3  docs(demo): explique l'export      il y a 5 min│
│ ✓ Aucun fichier sensible                                 │
│                                    [Annuler] [ Pousser ] │
└──────────────────────────────────────────────────────────┘
Refus possibles (texte + action) : « Une collègue a poussé entre-temps → [Tirer d'abord] » ·
« Branche principale d'un dépôt tiers → [Créer une branche] » · « Pas de droits d'écriture → [Forker] ».
```

### E5 — Reprendre un projet : source « lien » (assistant de la spec 017, étendu)
```
┌─ Reprendre un projet existant ─────────────────────────── ✕ ┐
│ ① Source   ② Clone   ③ Aperçu   ④ Confidentialité          │  étapes (texte + numéro)
│                                                            │
│ ( ) Un dossier de mon poste                                │
│ (●) Un lien GitHub (ou une adresse git)                    │
│     [ https://github.com/auteur-x/projet-libre        ]    │
│     ✓ Adresse valide — github.com / auteur-x / projet-libre│
│     Dossier : C:\…\projets\ [Choisir…]  Nom [projet-libre] │
│     ▸ Options : ☐ Tout télécharger maintenant (hors ligne) │
│                                                            │
│                                   [Annuler] [ Cloner ]     │
└────────────────────────────────────────────────────────────┘
② Clone : « Réception des objets — 42 % (38 Mo) » + barre + [Annuler] ; au seuil : « Ce dépôt dépasse 500 Mo.
[Continuer] [Annuler] ». Adresse refusée : « Seules les adresses https:// et git@ sont acceptées. »
```

### E6 — Carte en mode Historique (rediffusion)
```
┌─ Carte du projet — Rediffusion ─────────────────────────────────── [Quitter la rediffusion] ┐
│   ┌───────────┐        ┌───────────┐         ┌───────────┐                                 │
│   │ AD Export │───────▶│ MD Prix   │◀────────│ — Config  │   AD/MD/LB = initiales + couleur │
│   └───────────┘        └───────────┘         └───────────┘   « — » = jamais touché (neutre) │
│                                                                                             │
│ Légende : ■ AD ana-dev   ■ MD mentalyas-demo   ■ LB lou-bot     Mode : (●) principal ( ) dernier │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ ◀◀  ▶  ▶▶   2026-03 ──────────────●──────────────────── 2026-10    12 sept. 2026 · 214/530 │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### E7 — Résolution de conflit (62 % vue / 38 % liste)
```
┌─ Fusion de origin/main dans main ─────────────────────────────┐┌─ Fichiers en conflit (3) ─────┐
│ src/prix.ts — bloc 1 / 2                                      ││ ✓ src/a.ts        résolu      │
│ Claude : « Ta version arrondit au centime ; celle d'ana-dev    ││ ● src/prix.ts     en cours    │
│ ajoute la TVA. La proposition garde les deux. » ⚠ à vérifier  ││ ○ logo.png        binaire     │
│┌ La tienne ───────────┐┌ La leur ─────────────┐┌ Proposition ┐││                               │
││ round(p, 2)          ││ p * (1 + tva)        ││ round(p *   │││                               │
││                      ││                      ││ (1+tva), 2) │││                               │
│└──────────────────────┘└──────────────────────┘└─────────────┘││                               │
│ Choix : (●) Proposition ( ) La tienne ( ) La leur             ││                               │
│         ( ) Les deux    ( ) Éditer à la main                  ││ [Abandonner la fusion]        │
│ [◀ Bloc précédent] [Bloc suivant ▶]   [Voir l'aperçu complet] ││                               │
│ [               Valider ce fichier               ]            ││ [  Terminer la fusion  ] (grisé│
└───────────────────────────────────────────────────────────────┘└ tant qu'un fichier reste) ───┘
```
CTA de la vue : **Valider ce fichier** ; « Terminer la fusion » n'est actif (et seul CTA) qu'une fois tout résolu.

### E8 — Extraire (modale)
```
┌─ Extraire vers ma bibliothèque ─────────────────────── ✕ ┐
│ Origine : auteur-x/projet-libre · src/csv/parse.ts · 4f3e2d1│
│ Licence : MIT ✓ — copie permise, garder la mention       │
│ Destination : (●) snippets/ [csv ▾]  ( ) techno/ [ ▾ ]   │
│ Nom : [ parse-csv.ts ]                                   │
│ Aperçu : /* Origine : … Licence : MIT … */ + code         │
│                                  [Annuler] [ Extraire ]  │
└──────────────────────────────────────────────────────────┘
```

## 3. Inventaire des écrans
| Écran | Rôle | Fonctionnalités présentes |
|-------|------|----------------------------|
| **E1** Carte du projet + badge genesis | Voir l'état d'un coup d'œil | GIT-A UC-1, GIT-B (écart), GIT-C (nouveautés), GIT-E (fusion en cours), GIT-F (pastilles `#42`) |
| **E2** Volet Dépôt (38 %, 5 onglets) | Travailler au quotidien | Changements (GIT-A), Branches (GIT-A UC-4), Historique (GIT-C UC-2, GIT-D UC-1), PR / Issues (GIT-F) |
| **E3** Publier sur GitHub (modale) | Mettre en ligne | GIT-B UC-1 |
| **E4** Récapitulatif de push (modale) | Vérifier la destination | GIT-B UC-4, renvoi vers fork (GIT-F) |
| **E5** Reprendre un projet · lien (assistant spec 017) | Faire entrer un dépôt | GIT-C UC-1 |
| **E6** Carte en mode Historique | Rejouer | GIT-D UC-2 |
| **E7** Résolution de conflit (62 / 38) | Décider bloc par bloc | GIT-E |
| **E8** Extraire (modale) | Garder un morceau | GIT-G |

## 4. Diagramme de parcours (Mermaid)
```mermaid
journey
    title Git et GitHub — une semaine type
    section Lundi : étudier
      Coller un lien GitHub, cloner: 4: mentalyas
      Lire le guide de reprise: 5: mentalyas, Claude
    section Mardi : travailler
      Relire le diff, commiter avec le message de Claude: 5: mentalyas, Claude
      Publier sur GitHub en privé: 4: mentalyas
    section Jeudi : collaborer
      Tirer le travail d'ana-dev: 4: mentalyas
      Résoudre un conflit avec Claude: 3: mentalyas, Claude
      Pousser: 5: mentalyas
    section Vendredi : comprendre
      Rejouer l'historique sur la carte: 5: mentalyas
      Ouvrir une PR vers le projet libre: 4: mentalyas, Claude
```

## 5. Points de friction identifiés
- **Peur de casser** (commit, push) → récapitulatif systématique, diff visible avant le CTA, privé par défaut,
  « Abandonner la fusion » toujours là ; vocabulaire expliqué en infobulle (`?` à côté de « tirer », « pousser »).
- **`gh` pas installé / pas connecté** → message unique avec la commande et [Copier] ; le reste du volet (lot A)
  fonctionne sans `gh`.
- **Compteur « à tirer » périmé** (fetch jamais en fond) → âge affiché (« il y a 2 h ») et ⟳ dans l'en-tête.
- **Trop de fichiers modifiés** → liste virtualisée, filtre par dossier, « Tout décocher » ; jamais « tout cocher »
  par défaut.
- **Conflits nombreux** → progression « 1 / 3 résolus », reprise après fermeture, propositions de Claude sur clic
  (pas de rafale).
- **Hook qui échoue** → sortie du hook dans un panneau repliable avec « Demander à Claude d'expliquer » (tâche sans
  outil) ; pas de bouton pour passer outre.
- **Couleurs d'auteurs proches** → palette à teintes espacées + initiales + motif de bordure (plein / pointillé) au-delà
  de 8 auteurs.
- **Volet trop chargé** (Miller) → en-tête (état), onglets, liste, détail, CTA : 5 groupes séparés par des filets.

## Hypothèses à valider
1. Raccourci `Ctrl+Maj+G` libre dans l'app (à vérifier contre les raccourcis existants au plan).
2. La résolution de conflit **remplace temporairement la carte** (62 %) plutôt que d'ouvrir une fenêtre séparée.
3. Tirer / Pousser vivent dans l'**en-tête** du volet (visibles depuis tous les onglets) ; le CTA de l'onglet
   Changements devient « Pousser » quand il n'y a plus rien à commiter.
