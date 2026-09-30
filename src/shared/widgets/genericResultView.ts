/**
 * Vue générique d'un cadre résultat (spec 005 FR-007) : code FIGÉ de l'application, sans IA. Elle tourne dans le
 * même bac à sable qu'un widget et reçoit le résultat par le pont (`gi.onInputs`). Tout est écrit par
 * `textContent` : un résultat qui contient du HTML ou du script s'affiche comme du texte, jamais interprété.
 */

/** Au-delà, les lignes d'une liste ne sont pas dessinées (un compteur le dit) : la carte reste fluide (SC-004). */
export const GENERIC_VIEW_MAX_ROWS = 1000
const MAX_COLUMNS = 30
const MAX_CELL_CHARS = 200

export const GENERIC_RESULT_HTML = '<main id="gi-result" aria-live="polite"></main>'

export const GENERIC_RESULT_CSS = `
#gi-result { height: 100%; overflow: auto; padding: 12px; }
.gi-muted { color: var(--color-content-muted); margin: 0; }
.gi-value { margin: 0; font-size: 28px; font-weight: 600; overflow-wrap: anywhere; }
.gi-text { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 6px 8px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--color-surface-raised); overflow-wrap: anywhere; }
th { position: sticky; top: -12px; background: var(--color-surface-raised); font-weight: 600; }
td.gi-number, th.gi-number { text-align: right; font-variant-numeric: tabular-nums; }
ol, ul { margin: 0; padding-left: 20px; }
li { padding: 2px 0; }
dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; }
dt { color: var(--color-content-muted); }
dd { margin: 0; min-width: 0; }
dd > dl, li > dl { padding-left: 8px; border-left: 2px solid var(--color-surface-raised); }
`

export const GENERIC_RESULT_JS = `
const root = document.getElementById('gi-result')
const MAX_ROWS = ${GENERIC_VIEW_MAX_ROWS}
const MAX_COLUMNS = ${MAX_COLUMNS}
const MAX_CELL_CHARS = ${MAX_CELL_CHARS}

const el = (tag, text, className) => {
  const node = document.createElement(tag)
  if (text !== undefined) node.textContent = text
  if (className !== undefined) node.className = className
  return node
}
const isPlain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isScalar = (value) => value === null || typeof value !== 'object'
const scalarText = (value) => (value === null ? '—' : value === true ? 'oui' : value === false ? 'non' : String(value))
const cellText = (value) => {
  const text = isScalar(value) ? scalarText(value) : JSON.stringify(value)
  return text.length > MAX_CELL_CHARS ? text.slice(0, MAX_CELL_CHARS) + '…' : text
}
const more = (hidden, word) => el('p', '… et ' + hidden + ' ' + word + (hidden > 1 ? 's' : '') + ' de plus', 'gi-muted')

function table(rows) {
  const columns = []
  for (const row of rows.slice(0, MAX_ROWS)) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key) && columns.length < MAX_COLUMNS) columns.push(key)
    }
  }
  const numeric = columns.map((key) => rows.slice(0, MAX_ROWS).every((row) => row[key] === undefined || typeof row[key] === 'number'))
  const node = el('table')
  const head = el('tr')
  columns.forEach((key, index) => {
    const th = el('th', key, numeric[index] ? 'gi-number' : undefined)
    th.scope = 'col'
    head.append(th)
  })
  const thead = el('thead')
  thead.append(head)
  const tbody = el('tbody')
  for (const row of rows.slice(0, MAX_ROWS)) {
    const tr = el('tr')
    columns.forEach((key, index) => {
      tr.append(el('td', row[key] === undefined ? '' : cellText(row[key]), numeric[index] ? 'gi-number' : undefined))
    })
    tbody.append(tr)
  }
  node.append(thead, tbody)
  const wrap = el('div')
  wrap.append(node)
  if (rows.length > MAX_ROWS) wrap.append(more(rows.length - MAX_ROWS, 'ligne'))
  return wrap
}

function list(items) {
  const wrap = el('div')
  const node = el('ol')
  for (const item of items.slice(0, MAX_ROWS)) {
    const li = el('li')
    li.append(isScalar(item) ? scalarText(item) : render(item, false))
    node.append(li)
  }
  wrap.append(node)
  if (items.length > MAX_ROWS) wrap.append(more(items.length - MAX_ROWS, 'élément'))
  return wrap
}

function tree(object) {
  const keys = Object.keys(object)
  if (keys.length === 0) return el('p', 'Aucune donnée', 'gi-muted')
  const node = el('dl')
  for (const key of keys) {
    const dd = el('dd')
    dd.append(isScalar(object[key]) ? scalarText(object[key]) : render(object[key], false))
    node.append(el('dt', key), dd)
  }
  return node
}

function render(value, top) {
  if (Array.isArray(value)) {
    if (value.length === 0) return el('p', 'Liste vide', 'gi-muted')
    return value.every(isPlain) ? table(value) : list(value)
  }
  if (isPlain(value)) return tree(value)
  const text = scalarText(value)
  return el('p', text, top && text.length <= 40 ? 'gi-value' : 'gi-text')
}

const waiting = () => root.replaceChildren(el('p', 'En attente du résultat…', 'gi-muted'))
waiting()
gi.onInputs((inputs) => {
  const result = inputs[0]
  if (result === null || typeof result !== 'object' || result.kind !== 'result') { waiting(); return }
  root.replaceChildren(render(result.data, true))
})
`
