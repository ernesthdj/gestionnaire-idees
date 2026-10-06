import { WRITE_TOOLS } from '@shared/mcp/hook'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Argument entre guillemets doubles de bash : `\`, `"`, `$` et `` ` `` échappés, rien n'est interprété. */
export function bashQuote(value: string): string {
  return `"${value.replace(/[\\"$`]/g, (char) => `\\${char}`)}"`
}

/**
 * Réglages injectés par `--settings` dans chaque conversation (spec 014 R5) : un hook `PreToolUse` sur les outils
 * d'écriture, qui lance le relais de l'app en mode hook. Claude Code exécute la commande avec Git Bash (vérifié sur
 * 2.1.291) : `ELECTRON_RUN_AS_NODE` est posé pour cette seule commande, jamais dans l'environnement de `claude`, dont
 * les commandes Bash hériteraient. Le neurone passe en argument, validé.
 */
export function hookSettings(input: {
  readonly electronPath: string
  readonly relayPath: string
  readonly profileDir: string
  readonly neuronId: string
}): string {
  if (!UUID.test(input.neuronId)) throw new Error('Identifiant de neurone invalide pour le hook')
  const path = (value: string): string => bashQuote(value.replace(/\\/g, '/'))
  const command =
    `GI_PROFILE_DIR=${path(input.profileDir)} ELECTRON_RUN_AS_NODE=1 ` +
    `${path(input.electronPath)} ${path(input.relayPath)} --hook ${input.neuronId}`
  return JSON.stringify({
    hooks: {
      PreToolUse: [{ matcher: WRITE_TOOLS.join('|'), hooks: [{ type: 'command', command, timeout: 60 }] }]
    }
  })
}
