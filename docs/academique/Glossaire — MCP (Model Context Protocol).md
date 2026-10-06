---
type: glossaire
subject: MCP (Model Context Protocol)
tags: [#glossaire, #mcp, #ia, #protocole]
date: 2026-10-06
niveau: intermédiaire
---

# MCP (Model Context Protocol)

> **En 30 secondes** — **MCP** est un protocole ouvert qui standardise la façon dont un agent IA (ici Claude Code) découvre et appelle des **outils** fournis par un programme tiers, le **serveur MCP**. L'agent demande la liste des outils (nom, description, schéma JSON des entrées), puis envoie des appels ; le serveur répond par du texte ou des données.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : chaque application voulait brancher l'IA à sa façon (API maison, extensions, copier-coller). MCP fixe **une prise standard** : un serveur écrit une fois marche avec tout client compatible.
- **Analogie (multiprise)** : la **prise USB** des outils IA. L'agent est l'ordinateur, chaque serveur MCP est un périphérique ; à la connexion, le périphérique annonce ce qu'il sait faire et l'ordinateur s'en sert sans pilote sur mesure. *Où ça boite* : un périphérique USB ne décide rien ; un serveur MCP peut **refuser** un appel (validation, droits).

## 2. Comment ça marche (sous le capot)
Messages **JSON-RPC 2.0** (requête `{ id, method, params }`, réponse `{ id, result | error }`). Deux transports courants : **stdio** (le client lance le serveur comme processus enfant et lui parle par stdin/stdout — c'est le cas ici) ou **HTTP**. Méthodes clés : `initialize`, `tools/list`, `tools/call`. Le serveur peut aussi envoyer des **instructions** générales que l'agent lit au démarrage.

## 3. En pratique
```ts
// src/mcp-relay/relay.ts — déclarer un outil avec le SDK officiel
server.registerTool(name, { description: tool.description, inputSchema: tool.input }, async (args) => {
  const result = await client.call(name, args)         // transmis au main par le canal nommé
  return { content: [{ type: 'text', text: result.text }] }
})
await server.connect(new StdioServerTransport())        // transport stdio
```
Côté Claude Code, un outil s'appelle `mcp__<serveur>__<outil>` (ex. `mcp__brainstormer__plan_proposer`) — c'est ce nom qu'on autorise dans `--allowedTools` ou qu'on désigne comme `--permission-prompt-tool`.

## Utilisé dans ce cours
- [[Pont MCP — relais stdio, canal nommé et secret partagé]] — le serveur de l'app, en relais.
- [[Piloter Claude Code — processus enfant, flux stream-json et session reprise]] — la config MCP passée au CLI (`--strict-mcp-config`).
- [[Permissions relayées — l'humain dans la boucle d'un agent]] — un outil MCP qui sert de guichet de permission.
- [[Plan d'attaque — étapes ordonnées, dépendances sans cycle et verrou]] — `plan_proposer`, outil métier.

## Retenir et vérifier
- **À retenir** : outils décrits par un schéma ; découverte puis appel ; transport stdio = processus enfant.
> **Q :** Pourquoi la **description** d'un outil compte-t-elle autant que son code ? **R :** C'est elle que le modèle lit pour choisir l'outil ; une description floue lui fait prendre l'outil voisin (cas `dessiner` vs `plan_proposer`, 05/10).

**Pièges** : ⚠️ croire que le schéma côté serveur suffit — si un autre programme peut atteindre le moteur, il faut revalider derrière.
