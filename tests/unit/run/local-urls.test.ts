import { describe, expect, it } from 'vitest'
import { localUrls } from '../../../src/shared/run/urls'

describe('adresses locales d’une sortie (spec 025)', () => {
  it('should_find_local_dev_addresses_and_ignore_remote_ones', () => {
    const output = [
      '\u001b[32m  ➜  Local:\u001b[39m   \u001b[36mhttp://localhost:\u001b[1m5173\u001b[22m/\u001b[39m',
      '  ➜  Network: http://0.0.0.0:5173/',
      'Serveur sur http://127.0.0.1:8000.',
      'Docs : https://vitejs.dev/guide/ et http://localhost.exemple.invalid/',
      'encore http://localhost:5173/'
    ].join('\n')
    expect(localUrls(output)).toEqual(['http://localhost:5173/', 'http://127.0.0.1:8000'])
  })
})
