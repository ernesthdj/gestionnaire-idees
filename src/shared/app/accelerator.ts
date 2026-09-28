/**
 * Validation d'un raccourci global au format Electron (`Control+Alt+Space`). Au moins un modificateur est exigé :
 * un raccourci global sans modificateur volerait une touche ordinaire à toutes les applications.
 */

const MODIFIERS = new Set([
  'Command',
  'Cmd',
  'Control',
  'Ctrl',
  'CommandOrControl',
  'CmdOrCtrl',
  'Alt',
  'Option',
  'AltGr',
  'Shift',
  'Super',
  'Meta'
])

const NAMED_KEYS = new Set([
  'Space',
  'Tab',
  'Backspace',
  'Delete',
  'Insert',
  'Return',
  'Enter',
  'Up',
  'Down',
  'Left',
  'Right',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Escape',
  'Esc',
  'Plus'
])

function isKey(key: string): boolean {
  return (
    /^[A-Z0-9]$/.test(key) || /^F([1-9]|1\d|2[0-4])$/.test(key) || NAMED_KEYS.has(key) || /^[`\-=[\];',./\\]$/.test(key)
  )
}

export function isValidAccelerator(accelerator: string): boolean {
  if (accelerator.length === 0 || accelerator.length > 60) return false
  const parts = accelerator.split('+')
  const key = parts.pop()
  if (key === undefined || !isKey(key) || parts.length === 0) return false
  return parts.every((part) => MODIFIERS.has(part)) && new Set(parts).size === parts.length
}
