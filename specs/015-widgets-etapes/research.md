# Research — 015 Widgets branchés sur les étapes de plan

## R1 — Pas de migration : nouvelle nature de source et parties normalisées à la lecture
- **Décision** : `source_kind` gagne `plan_step` (enum TypeScript ; la colonne SQLite est un texte sans contrainte,
  migration 0014). Les parties d'une idée stockées avec l'ancien vocabulaire sont converties à la lecture par une
  fonction pure : `identity`/`original` → `identity`, `tree` → `plan`, `document` → `annexes`, `answers` → retirée ;
  `sheet` ajoutée si le branchement avait l'identité (comportement « tout coché » d'origine). L'ancien `step`
  (prochaine étape d'un document éclos) reste lisible ; il n'est plus créable.
- **Pourquoi** : l'empreinte d'autorisation (`ioFingerprint`) inclut les parties ; des parties converties changent
  l'empreinte → l'autorisation est redemandée une fois, sans code dédié (spec US3 #2). Aucune réécriture en base, donc
  aucun `down` à écrire et aucun risque sur les données d'archive.
- **Écartée** : migration SQL de `parts_json` (réversible seulement de façon approximative).

## R2 — Assemblage pur et borné
- **Décision** : `assemblePlanStep(facts, parts)` et `assembleIdea(facts, parts)` restent purs ; les faits sont lus par
  le service : étape et ses ancêtres (`PlanRepository.node`/`steps`), fiches (`readSheet`), sous-arbre
  (`PlanRepository.steps(genesisId)` filtré), documents annexés (`DocumentService.read`, dernière version connue si le
  fichier a disparu), action finale et fichiers du livrable (`FinalRepository.get`/`files`, chemins et statuts).
- **Borne** : 200 Ko par entrée, mesurés sur le JSON assemblé. Au-delà, on retire dans cet ordre jusqu'à passer sous la
  borne : contenus des documents (du plus long au plus court, remplacés par un extrait de 2 000 caractères), puis
  fiches du chemin du plus éloigné au plus proche ; `truncated: true` est ajouté à l'entrée.
- **Pourquoi** : ce qui est proche de l'étape porte le plus de sens pour un widget « bien cadré ».

## R3 — Brancher depuis la carte
- **Décision** : `onConnect` regarde le type du nœud source : `neuron` → `idea`, `plan` (élément `step`) → `plan_step`
  avec l'identifiant de l'étape ; fantôme, barre de proposition, document, livrable → rien. `PlanNode` expose une
  poignée source connectable (aujourd'hui `isConnectable={false}`) seulement vers un widget (`isValidConnection`).
- **Trait** : `IoLinkView` existe déjà ; `buildGraph` résout `plan_step` vers l'identifiant du nœud d'étape.

## R4 — Revue et description pour Claude
- **Décision** : la revue affiche « 1.2 · Titre » pour une étape (rang via `rankLabel`), les libellés de parties
  selon la nature (`STEP_PART_LABELS`, `IDEA_PART_LABELS`), et « ancienne source » pour `step`. La description des
  entrées (`shapeOf`, déjà dérivée des données assemblées) suit automatiquement ; la description d'outil
  `widget_poser` mentionne les entrées d'étape (identité, fiche, chemin, sous-étapes, annexes).

## R5 — Construire depuis le nœud (D5, D6)
- **Décision** : nouvelle opération `WidgetService.build(blockId, { adapt })` qui passe par la tâche `widget` existante
  (AIGateway, cadre figé, sortie validée) avec, dans la demande, le **contexte complet** des sources (l'assemblage de
  la spec 015 avec toutes les parties, valeurs comprises), délimité comme donnée. `connect` déclenche `build` si le
  widget n'a pas de version ; sinon l'interface propose « Adapter au nœud ».
- **Pourquoi** : réutilise le circuit de génération, de validation et de versions ; la règle « structure seulement »
  (spec 005 FR-012) venait de l'anonymisation, retirée en constitution 3.0.

## R6 — Contexte préparé, actualisé sur demande (D7)
- **Décision** : la sortie de la tâche `widget` gagne deux champs facultatifs : `extraction` (consigne, 2 000
  caractères) et `context` (JSON, 50 Ko). Table `widget_contexts` (par widget) : consigne, données, empreinte SHA-256
  du contexte source assemblé, date. À la lecture des entrées, empreinte actuelle ≠ empreinte gardée → `stale`.
  « Actualiser » lance une petite tâche `widget_context` (même passerelle, sans outils) : consigne + contexte actuel →
  JSON validé ; le code ne change pas, l'autorisation non plus (même nature de données).
- **Transmis au widget** : `gi.onInputs(inputs)` reçoit en plus une entrée `{ kind: 'context', data, stale }` si la
  version est autorisée.
- **Écartée** : relance automatique (coût continu, choix de mentalyas).
