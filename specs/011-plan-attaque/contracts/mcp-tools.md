# Contrat — outils MCP ajoutés (spec 011)

Tous respectent les règles des specs 007–008 : appelant = conversation d'un neurone, cible dans son arbre, entrée
validée par Zod (`src/shared/mcp/tools.ts`), erreurs `MCP_ERROR_CODES`.

## `plan_proposer` (writes : non — aucune donnée de mentalyas n'est écrite)
```
{ id?: Id,                       // parent ; défaut : le neurone de la conversation
  etapes: [{ cle: string(1..24), titre: string(1..120), pourquoi: string(1..300), attend?: string[] }] (1..12) }
```
- Ordre du tableau = rang proposé. `attend` : clés de la même proposition, ou ids d'étapes sœurs existantes.
- Refus : parent hors de l'arbre (`INTROUVABLE`), profondeur > 4 (`LOT_INVALIDE`), > 12 étapes (`LOT_TROP_GROS`),
  cycle ou étape placée avant ce qu'elle attend (`LOT_INVALIDE`), titres tous déjà refusés (`LOT_INVALIDE`, liste).
- Réponse : « 3 étapes proposées à mentalyas (en attente de sa validation) ».

## `verrou_proposer` (writes : non)
```
{ id?: Id, raison: string(1..300) }
```
- Refus : déjà verrouillé (`NON_MODIFIABLE`). Pose `lock_proposed_at` ; mentalyas voit la proposition sur le nœud et
  dans le chat.

## `etape_modifier` (writes : oui — opération « par Claude », annulable)
```
{ id: Id, statut?: 'a_faire'|'en_cours'|'fait'|'bloque', attend?: Id[] }   // au moins un champ
```
- `attend` remplace les dépendances de l'étape (frères seulement, sans cycle, cohérent avec les rangs).
- Permis sur une étape verrouillée (statut et dépendances ne sont pas son contexte).

## Changements d'outils existants
- `fiche_ecrire`, `maturite_evaluer`, `noeud_modifier` : refus `NON_MODIFIABLE` « nœud verrouillé » si la cible l'est.
- `neurone_contexte` : ajoute verrou, rang, statut, chemin (genesis → parent) et la liste des enfants
  (rang, titre, statut, attend).
- `retirer` : accepte une étape (archive l'étape et ses descendants, renumérote les frères, retire les dépendances).
- `MCP_INSTRUCTIONS` : une ligne — « Un nœud mûr : propose son plan (`plan_proposer`) ; un nœud dont tu as tout ce
  qu'il te faut : propose de le verrouiller (`verrou_proposer`). Un nœud verrouillé ne s'écrit plus. »
