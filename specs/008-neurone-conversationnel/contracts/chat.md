# Contrats — lot A

## Outils MCP ajoutés (neurone courant = `GI_NEURON_ID` de la conversation)
| Outil | Entrée | Sortie |
|-------|--------|--------|
| `neurone_contexte` | `{ id? }` | titre, état, couche, fiche, maturité |
| `fiche_ecrire` | `{ id?, resume?, points_cles?, decisions?, questions_ouvertes?, manques? }` (au moins un champ ; listes ≤ 30 éléments de ≤ 500 car.) | fiche à jour ; 1 opération d'Historique « par Claude » |
| `maturite_evaluer` | `{ id?, niveau: insuffisant\|suffisant\|complet, manques: string[] ≤ 12 }` | niveau enregistré |
Sans `id` ni neurone courant → `ENTREE_INVALIDE` ; neurone d'un autre arbre → `NON_MODIFIABLE`.

## Poignée de main (spec 007, étendue)
`{ hello: "gi-mcp/1", token, neuron?: uuid }` — `neuron` facultatif (CLI externe : aucun).

## IPC
| Canal | Entrée | Sortie |
|-------|--------|--------|
| `chat:open` | `{ neuronId }` | `ChatView` |
| `chat:send` | `{ neuronId, text: 1..20 000 }` | `{ ok }` (la réponse arrive par événements) |
| `chat:stop` | `{ neuronId }` | `{ ok }` |
| `chat:close` | `{ neuronId }` | `{ ok }` |

## Événements main → fenêtre (charge commune `{ neuronId }`)
| Événement | + champs |
|-----------|----------|
| `chat:delta` | `text` (morceau de réponse) |
| `chat:tool` | `label` (« fiche mise à jour », « carte lue »…) |
| `chat:turnEnd` | `message` (réponse complète enregistrée) |
| `chat:error` | `code` (`CLAUDE_NOT_FOUND`, `NOT_LOGGED_IN`, `LIMIT_REACHED`, `PROCESS_FAILED`), `message`, `resetsAt?` |
| `chat:quota` | `status` (`allowed`\|`allowed_warning`\|`rejected`), `utilization`, `resetsAt` |
