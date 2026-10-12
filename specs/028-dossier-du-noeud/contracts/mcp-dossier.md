# Contrat MCP — le dossier vu par Claude (spec 028)

## `dossier_lire` (nouveau, `writes: false`)

Entrée (Zod stricte) : `{ id?: uuid, sorte?: 'docs' | 'code' | 'autres', fichier?: string ≤ 512 }`. Sans `id` : le
nœud de la conversation (`conversationTarget`).

| Cas | Réponse |
|---|---|
| sans `fichier` | liste texte : chemin, source (document, ajouté, conversation, couvert), date, « nouveau » ; 200 lignes au plus, puis « et N autres (filtre `sorte`) » |
| avec `fichier` rangé | en-tête « Fichier `chemin` (rangé : source) » puis le contenu, préfixé comme donnée ; 200 Ko au plus, sinon tronqué et signalé |
| nœud d'un autre arbre que la conversation | `NON_MODIFIABLE` |
| fichier non rangé dans ce nœud | `INTROUVABLE` |
| fichier sensible (`.env`, clés…), même rangé à la main | `SECRET_REFUSE` |
| fichier binaire | `ENTREE_INVALIDE` |

Aucun nouveau code d'erreur (`MCP_ERROR_CODES` inchangé).

## `neurone_contexte` (existant)

Sortie complétée d'une section `Dossier :` (30 premières entrées : chemin, source, « nouveau » ; puis « et N autres :
dossier_lire »). La section `Documents :` actuelle y est fusionnée (un document est une entrée du dossier).

## `document_ecrire` (existant)

Entrée inchangée. Accepte **tout nœud** de l'arbre de la conversation (le refus `kind = 'element'` du 2026-10-12 est
levé) ; le document est rangé dans le dossier du nœud, même lot d'Historique. Description de l'outil et consigne de
conversation (`frame.ts`) : « Le dossier du nœud réunit ses documents et fichiers ; lis-les avec `dossier_lire` ; un
document que tu rédiges y est rangé. »
