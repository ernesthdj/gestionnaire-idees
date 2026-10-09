/** Ligne de tâche Spec Kit : case, identifiant, puis étiquettes entre crochets (`[P]`, `[US4]`). */
const TASK_LINE = /^(\s*[-*] \[[ xX]\] )(T\d{3,4})((?: \[[A-Za-z0-9]{1,8}\])*)(?=\s|$)/gm

/**
 * Mise en valeur des tâches d'un `tasks.md` avant son rendu Markdown (spec 023 D13) : l'identifiant passe en gras, les
 * étiquettes deviennent des pastilles (code en ligne). Le reste du texte est inchangé.
 */
export function decorateTasks(text: string): string {
  return text.replace(TASK_LINE, (_line, box: string, id: string, tags: string) => {
    const chips = [...tags.matchAll(/\[([A-Za-z0-9]{1,8})\]/g)].map((match) => ` \`${match[1] ?? ''}\``).join('')
    return `${box}**${id}**${chips}`
  })
}
