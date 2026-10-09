import type { GitDiffLine, GitDiffView, GitFileStatus } from '@shared/git/model'

/**
 * Analyseurs des sorties machine de git (spec 021 T005) : `status --porcelain=v2 --branch -z`, log `-z`, branches,
 * diff unifié borné, clés de configuration, progression. Purs ; une sortie inattendue donne une vue vide ou partielle,
 * jamais une exception.
 */

export interface ParsedStatusEntry {
  readonly path: string
  readonly origPath?: string
  readonly status: GitFileStatus
  readonly staged: boolean
}

export interface ParsedStatus {
  readonly branch: string | null
  readonly detached: boolean
  /** Branche sans commit (`branch.oid (initial)`). */
  readonly unborn: boolean
  readonly head: string | null
  readonly upstream: { readonly remote: string; readonly branch: string } | null
  readonly ahead: number
  readonly behind: number
  readonly entries: readonly ParsedStatusEntry[]
}

const CODE: Readonly<Record<string, GitFileStatus>> = { M: 'M', T: 'M', A: 'A', D: 'D', R: 'R', C: 'A', U: 'U' }

/** `XY` de porcelain v2 : X = index (préparé), Y = copie de travail ; `.` = inchangé. */
function sides(path: string, xy: string, origPath?: string): ParsedStatusEntry[] {
  const out: ParsedStatusEntry[] = []
  const [x = '.', y = '.'] = xy
  const extra = origPath === undefined ? {} : { origPath }
  if (x !== '.') out.push({ path, status: CODE[x] ?? 'M', staged: true, ...extra })
  if (y !== '.') out.push({ path, status: CODE[y] ?? 'M', staged: false })
  return out
}

export function parseStatus(output: string, maxEntries = 10_000): ParsedStatus & { readonly total: number } {
  const records = output.split('\0')
  let branch: string | null = null
  let detached = false
  let unborn = false
  let head: string | null = null
  let upstream: ParsedStatus['upstream'] = null
  let ahead = 0
  let behind = 0
  const entries: ParsedStatusEntry[] = []
  let total = 0
  const push = (list: ParsedStatusEntry[]): void => {
    for (const entry of list) {
      total += 1
      if (entries.length < maxEntries) entries.push(entry)
    }
  }
  for (let index = 0; index < records.length; index++) {
    const record = records[index] ?? ''
    if (record === '') continue
    if (record.startsWith('# ')) {
      const [, key = '', ...rest] = record.split(' ')
      const value = rest.join(' ')
      if (key === 'branch.oid') {
        unborn = value === '(initial)'
        head = unborn ? null : value
      } else if (key === 'branch.head') {
        detached = value === '(detached)'
        branch = detached ? null : value
      } else if (key === 'branch.upstream') {
        const slash = value.indexOf('/')
        upstream = slash < 0 ? null : { remote: value.slice(0, slash), branch: value.slice(slash + 1) }
      } else if (key === 'branch.ab') {
        const match = /^\+(\d+) -(\d+)$/.exec(value)
        ahead = Number(match?.[1] ?? 0)
        behind = Number(match?.[2] ?? 0)
      }
      continue
    }
    const kind = record[0]
    if (kind === '?') {
      push([{ path: record.slice(2), status: '?', staged: false }])
    } else if (kind === '1') {
      // 1 XY sub mH mI mW hH hI <chemin> : le chemin est le reste (il peut contenir des espaces).
      const parts = record.split(' ')
      push(sides(parts.slice(8).join(' '), parts[1] ?? '..'))
    } else if (kind === '2') {
      // 2 XY sub mH mI mW hH hI Xscore <chemin>, puis l'ancien chemin dans l'enregistrement suivant.
      const parts = record.split(' ')
      const origPath = records[index + 1] ?? ''
      index += 1
      push(sides(parts.slice(9).join(' '), parts[1] ?? '..', origPath))
    } else if (kind === 'u') {
      const parts = record.split(' ')
      push([{ path: parts.slice(10).join(' '), status: 'U', staged: false }])
    }
  }
  return { branch, detached, unborn, head, upstream, ahead, behind, entries, total }
}

export interface ParsedCommit {
  readonly hash: string
  readonly parents: readonly string[]
  readonly authorName: string
  readonly authorEmail: string
  readonly date: string
  readonly subject: string
}

/** Sortie de `logArgs` : enregistrements séparés par NUL, champs par 0x1f. */
export function parseLog(output: string): ParsedCommit[] {
  const commits: ParsedCommit[] = []
  for (const record of output.split('\0')) {
    const fields = record.replace(/^\n/, '').split('\x1f')
    if (fields.length < 6) continue
    const [hash = '', parents = '', authorName = '', authorEmail = '', date = '', ...subject] = fields
    if (!/^[0-9a-f]{40}$/.test(hash)) continue
    commits.push({
      hash,
      parents: parents.split(' ').filter((parent) => parent !== ''),
      authorName,
      authorEmail,
      date,
      subject: subject.join('\x1f')
    })
  }
  return commits
}

export interface ParsedBranch {
  readonly name: string
  readonly remote: boolean
  readonly current: boolean
  readonly upstream: string | null
  readonly ahead: number
  readonly behind: number
}

/** Sortie de `branchesArgs` (`for-each-ref`), une ligne par branche. */
export function parseBranches(output: string): ParsedBranch[] {
  const branches: ParsedBranch[] = []
  for (const line of output.split('\n')) {
    const [ref = '', upstream = '', track = '', headMark = ''] = line.split('\x1f')
    const remote = ref.startsWith('refs/remotes/')
    const name = ref.replace(/^refs\/(heads|remotes)\//, '')
    if (name === '' || (!remote && !ref.startsWith('refs/heads/')) || name.endsWith('/HEAD')) continue
    branches.push({
      name,
      remote,
      current: headMark.trim() === '*',
      upstream: upstream === '' ? null : upstream,
      ahead: Number(/ahead (\d+)/.exec(track)?.[1] ?? 0),
      behind: Number(/behind (\d+)/.exec(track)?.[1] ?? 0)
    })
  }
  return branches
}

/** Diff unifié d'un fichier → blocs bornés, lignes numérotées ; binaire résumé. */
export function parseDiff(path: string, output: string, maxLines = 5_000): GitDiffView {
  if (/^Binary files .* differ$/m.test(output) || /^GIT binary patch$/m.test(output)) {
    return { path, binary: true, truncated: false, hunks: [] }
  }
  const hunks: { header: string; lines: GitDiffLine[] }[] = []
  let oldNo = 0
  let newNo = 0
  let count = 0
  let truncated = false
  for (const line of output.split('\n')) {
    const header = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (header !== null) {
      oldNo = Number(header[1])
      newNo = Number(header[2])
      hunks.push({ header: line, lines: [] })
      continue
    }
    const hunk = hunks.at(-1)
    if (hunk === undefined || line.startsWith('\\')) continue
    if (count >= maxLines) {
      truncated = true
      break
    }
    if (line.startsWith('+')) hunk.lines.push({ kind: 'add', newNo: newNo++, text: line.slice(1) })
    else if (line.startsWith('-')) hunk.lines.push({ kind: 'del', oldNo: oldNo++, text: line.slice(1) })
    else if (line.startsWith(' ')) hunk.lines.push({ kind: 'ctx', oldNo: oldNo++, newNo: newNo++, text: line.slice(1) })
    else continue
    count += 1
  }
  return { path, binary: false, truncated, hunks }
}

/** Fichier non suivi présenté comme un ajout complet (lu par le main, ≤ 1 Mo). */
export function addedFileDiff(path: string, text: string, maxLines = 5_000): GitDiffView {
  const lines = text.split(/\r?\n/)
  if (lines.at(-1) === '') lines.pop()
  return {
    path,
    binary: false,
    truncated: lines.length > maxLines,
    hunks: [
      {
        header: `@@ -0,0 +1,${lines.length} @@`,
        lines: lines.slice(0, maxLines).map((text, index) => ({ kind: 'add' as const, newNo: index + 1, text }))
      }
    ]
  }
}

/** Clés de `config --local --list --name-only -z`, en minuscules (git ignore la casse des sections et des clés). */
export function parseConfigNames(output: string): string[] {
  return [
    ...new Set(
      output
        .split('\0')
        .map((name) => name.trim().toLowerCase())
        .filter((name) => name !== '')
    )
  ]
}

/** Pourcentage de « Receiving objects: 45% » dans un morceau de progression ; `null` sinon. */
export function parseProgress(text: string): number | null {
  const matches = [...text.matchAll(/Receiving objects:\s+(\d{1,3})%/g)]
  const last = matches.at(-1)?.[1]
  return last === undefined ? null : Math.min(100, Number(last))
}
