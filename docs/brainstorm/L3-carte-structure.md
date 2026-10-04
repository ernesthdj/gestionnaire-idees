# Niveaux 2-3 — P1 Carte de structure d'un projet
> Basé sur : L1e-chirurgie-projet.md (arbitrages 20 à 24), spec 007 (pont), spec 008 (neurone conversationnel)
> Date : 2026-10-04 · Points ouverts L1e §7 tranchés par défaut : un composant peut regrouper plusieurs fichiers ;
> la carte vit dans l'app (export vers le projet plus tard).

## 1. Cas d'usage
| # | Cas | Déroulé |
|---|-----|---------|
| UC-1 | Cartographier | Genesis lié à un dossier → chat → « Cartographier ce projet » → Claude lit CLAUDE.md, docs, specs, `src/` et appelle `structure_dessiner` → les éléments typés apparaissent autour du genesis, niveau 1 déplié |
| UC-2 | Lire la structure | Un élément montre son type, son titre, son statut, son résumé, ses fichiers, son nombre d'enfants |
| UC-3 | Déplier / replier | « ▸ 5 » sur un module montre ses 5 enfants ; « ▾ » les replie ; état mémorisé ; les liens vers un élément replié se rattachent à son ancêtre visible |
| UC-4 | Travailler sur un élément | Clic → la conversation de l'élément s'ouvre, **dans le dossier du projet**, avec son contexte (projet, chemin d'ancêtres, fichiers, fiche du projet, sa fiche) |
| UC-5 | Recartographier | Relancer la cartographie : les éléments sont **mis à jour par leur clé** (pas de doublons) ; les absents ne sont retirés que si Claude le demande (`retirer_absents`) — annulable |

## 2. Règles
| # | Règle |
|---|-------|
| R1 | Un élément est un **neurone** (`kind = 'element'`) : il a sa conversation et sa fiche (spec 008). Il appartient à un genesis (`genesis_id`) et a un parent (genesis ou élément). |
| R2 | Types : `module`, `fonctionnalite`, `composant`, `donnee`, `interface`, `tache`, `decision`, `operation` (P3). Statuts : `idee`, `specifiee`, `en_cours`, `livree`, `a_faire`, `faite`, `bloquee` (selon le type). |
| R3 | Chaque élément a une **clé stable** unique dans son projet (ex. `module:main`, `composant:src/main/mcp/PipeServer.ts`) : redessiner met à jour au lieu de dupliquer. |
| R4 | Chemins : relatifs au dossier du projet, sans `..` ni chemin absolu, 20 au plus ; affichés, jamais exécutés. |
| R5 | `structure_dessiner` est **tout ou rien**, une opération d'Historique « par Claude », annulable ; ≤ 300 éléments et 600 liens par appel. |
| R6 | Liens typés : `depend_de`, `appelle`, `lit_ecrit`, `implemente`, `teste`, `bloque` (table `map_links`, colonne `relation`). |
| R7 | Affichage : position calculée par l'interface autour du genesis (arbre en colonnes), niveaux repliés par défaut au-delà du niveau 1 ; ≤ 12 enfants conseillés par élément (consigne à Claude). |
| R8 | Conversation d'un élément : dossier de travail = dossier du projet du genesis ; une conversation peut écrire la fiche de n'importe quel élément **de son projet**, jamais d'un autre. |
| R9 | P1 reste en **lecture** côté projet (outils Read/Glob/Grep) ; l'écriture arrive en P2. |

## 3. Données (migration `0020_project_elements` + down)
| Table | Ajout |
|-------|-------|
| `neurons` | `kind` + `element` ; `genesis_id` (→ genesis), `element_type`, `element_key`, `element_status`, `paths_json`, `collapsed` (bool) ; index unique (`genesis_id`, `element_key`) |
| `map_links` | `from_kind` / `to_kind` + `element` ; `relation` (nullable) |
Un élément a `root_id = son id` (il n'entre pas dans les requêtes de l'ancien moteur de croissance, qui filtrent par racine) et `state = 'raw'` (restaurable par l'Historique).

## 4. Outils MCP
| Outil | Entrée | Effet |
|-------|--------|-------|
| `structure_dessiner` | `{ projet?: id, elements: [{ cle, type, titre, resume?, statut?, chemins?, parent? }], liens?: [{ de, vers, relation, libelle? }], retirer_absents? }` | Crée / met à jour par clé, relie ; parent = clé du lot ou clé existante, absent = enfant du genesis |
| `structure_lire` | `{ projet? }` | Arbre des éléments (clé, type, titre, statut, chemins), pour mettre à jour sans se tromper de clé |
`projet` par défaut : le genesis de la conversation appelante (ou le genesis de l'élément appelant).

## 5. Interface
- `ElementNode` : pastille de type (icône + couleur), titre, statut, résumé (2 lignes), « N fichiers », « ▸ N » / « ▾ ».
- `buildGraph` : arbre visible par genesis (repli), positions en colonnes à droite du genesis, liens de hiérarchie et liens typés (style par relation ; regroupés vers l'ancêtre visible, avec le nombre).
- Chat : bouton « Cartographier ce projet » (genesis lié) ; en-tête d'un élément : type, chemin d'ancêtres, fichiers.

## 6. Sécurité
| Risque | Mitigation |
|--------|------------|
| Chemin hors projet | Chemins relatifs validés (Zod : pas de `..`, pas de lettre de lecteur, pas de `/` initial) ; jamais ouverts par l'app |
| Écriture dans un autre projet | Garde « même projet » (genesis) côté main |
| Carte géante | Bornes par appel ; repli par défaut |
