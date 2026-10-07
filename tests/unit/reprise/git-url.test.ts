import { describe, expect, it } from 'vitest'
import { GIT_URL_MAX, checkGitUrl, type GitUrlRefusal } from '../../../src/shared/reprise/gitUrl'

const reasonOf = (input: string): GitUrlRefusal | 'ok' => {
  const result = checkGitUrl(input)
  return result.ok ? 'ok' : result.reason
}

describe('contrôle des adresses de dépôt (spec 020 T026 = spec 021 T027 = spec 017 T028)', () => {
  it('should_accept_https_and_scp_forms_when_the_address_is_clean', () => {
    expect(checkGitUrl('https://github.com/exemple/projet.git')).toEqual({
      ok: true,
      url: 'https://github.com/exemple/projet.git',
      display: 'https://github.com/exemple/projet.git',
      host: 'github.com',
      owner: 'exemple',
      repo: 'projet',
      hadCredentials: false
    })
    expect(checkGitUrl('git@gitlab.example.org:groupe/sous-groupe/outil.git')).toMatchObject({
      ok: true,
      display: 'git@gitlab.example.org:groupe/sous-groupe/outil.git',
      host: 'gitlab.example.org',
      owner: 'sous-groupe',
      repo: 'outil'
    })
  })

  it('should_accept_port_trailing_slash_and_encoded_segments_when_they_stay_safe', () => {
    expect(checkGitUrl('https://git.example.org:8443/equipe/depot/')).toMatchObject({
      ok: true,
      host: 'git.example.org',
      owner: 'equipe',
      repo: 'depot'
    })
    expect(reasonOf('https://dev.example.org/org/Mon%20Projet/_git/depot')).toBe('ok')
    expect(checkGitUrl('https://example.org/seul')).toMatchObject({ ok: true, repo: 'seul' })
    expect(checkGitUrl('https://example.org/seul')).not.toHaveProperty('owner')
  })

  it('should_lowercase_the_host_and_scheme_when_they_are_uppercase', () => {
    expect(checkGitUrl('HTTPS://GitHub.COM/Exemple/Projet')).toMatchObject({
      ok: true,
      url: 'https://github.com/Exemple/Projet',
      host: 'github.com',
      owner: 'Exemple'
    })
  })

  it('should_strip_and_flag_credentials_when_the_address_contains_them', () => {
    const withToken = checkGitUrl('https://quelquun:jeton-fictif-123@github.com/exemple/projet.git')
    expect(withToken).toMatchObject({
      ok: true,
      display: 'https://github.com/exemple/projet.git',
      hadCredentials: true
    })
    if (!withToken.ok) throw new Error('attendu : accepté')
    expect(withToken.display).not.toContain('jeton')
    expect(withToken.url).toBe('https://quelquun:jeton-fictif-123@github.com/exemple/projet.git')

    const userOnly = checkGitUrl('https://jeton-seul@github.com/exemple/projet')
    expect(userOnly).toMatchObject({ ok: true, display: 'https://github.com/exemple/projet', hadCredentials: true })
  })

  it('should_show_the_real_host_when_an_address_hides_it_behind_a_fake_userinfo', () => {
    const tricked = checkGitUrl('https://github.com:443@hote-piege.example/exemple/projet')
    expect(tricked).toMatchObject({ ok: true, host: 'hote-piege.example', hadCredentials: true })
    if (!tricked.ok) throw new Error('attendu : accepté')
    expect(tricked.display).toBe('https://hote-piege.example/exemple/projet')
  })

  it('should_refuse_command_running_transports_when_the_address_uses_them', () => {
    for (const hostile of [
      'ext::sh -c touch% /tmp/piege',
      'ext::sh',
      'fd::17',
      'fd::0,1/projet',
      'https://github.com/a::b',
      'git@github.com:ext::x',
      'transport::https://github.com/exemple/projet'
    ])
      expect(reasonOf(hostile), hostile).not.toBe('ok')
  })

  it('should_refuse_other_schemes_when_they_are_not_https_or_scp', () => {
    for (const hostile of [
      'ssh://git@github.com/exemple/projet.git',
      'http://github.com/exemple/projet.git',
      'file:///C:/depots/projet',
      'file://hote/partage/projet',
      'git://github.com/exemple/projet.git',
      'ftp://example.org/projet',
      'javascript:alert(1)',
      'utilisateur@github.com:exemple/projet',
      'github.com/exemple/projet',
      'github.com:exemple/projet'
    ])
      expect(reasonOf(hostile), hostile).toBe('SCHEME')
  })

  it('should_refuse_local_paths_when_they_are_given_instead_of_an_address', () => {
    for (const hostile of [
      'C:\\depots\\projet',
      'C:/depots/projet',
      '/srv/depots/projet',
      './projet',
      '../projet',
      '\\\\serveur\\partage'
    ])
      expect(reasonOf(hostile), hostile).not.toBe('ok')
  })

  it('should_refuse_disguised_options_when_the_address_starts_with_a_dash', () => {
    for (const hostile of [
      '--upload-pack=touch /tmp/piege',
      '-oProxyCommand=calc',
      '--config=core.sshCommand=calc',
      '-u'
    ])
      expect(reasonOf(hostile), hostile).not.toBe('ok')
    expect(reasonOf('-uhttps://github.com/exemple/projet')).toBe('OPTION')
    expect(reasonOf('git@-oProxyCommand=calc:projet')).toBe('HOST')
    expect(reasonOf('git@github.com:-projet')).toBe('PATH')
    expect(reasonOf('https://github.com/--upload-pack=calc')).toBe('PATH')
  })

  it('should_refuse_control_characters_when_they_hide_inside_the_address', () => {
    for (const hostile of [
      'https://github.com/exemple/projet\n--upload-pack=calc',
      'https://github.com/exemple/projet\r',
      'https://github.com/exemple\u0000/projet',
      'https://github.com/exemple/\u001bprojet',
      'https://github.com/exemple/\u007fprojet',
      'https://github.com/exemple/\u0085projet'
    ])
      expect(reasonOf(hostile), JSON.stringify(hostile)).toBe('CONTROL_CHAR')
  })

  it('should_refuse_whitespace_when_it_appears_anywhere', () => {
    for (const hostile of [
      ' https://github.com/exemple/projet',
      'https://github.com/exemple/projet ',
      'https://github.com/exemple projet',
      'https://github.com/exemple/projet\u00a0',
      'https://github.com/exemple/\u2028projet'
    ])
      expect(reasonOf(hostile), JSON.stringify(hostile)).toBe('WHITESPACE')
  })

  it('should_refuse_non_ascii_characters_when_they_could_spoof_a_host', () => {
    expect(reasonOf('https://g\u0456thub.com/exemple/projet')).toBe('NON_ASCII')
    expect(reasonOf('https://github.com/exemple/proj\u200bet')).toBe('NON_ASCII')
    expect(reasonOf('https://github.com/exemple/proj\u202eet')).toBe('NON_ASCII')
  })

  it('should_refuse_empty_or_invalid_hosts_when_the_authority_is_malformed', () => {
    for (const hostile of [
      'https:///exemple/projet',
      'https://@github.com/exemple/projet',
      'https://jeton@@github.com/exemple/projet',
      'https://-github.com/exemple/projet',
      'https://github-.com/exemple/projet',
      'https://github..com/exemple/projet',
      'https://github.com:0/exemple/projet',
      'https://github.com:70000/exemple/projet',
      'https://github.com:abc/exemple/projet',
      'https://[::1]/exemple/projet',
      'https://hote_soul.example/exemple/projet',
      'git@:exemple/projet',
      'git@a@b:exemple/projet',
      'git@github.com/exemple:projet'
    ])
      expect(reasonOf(hostile), hostile).not.toBe('ok')
  })

  it('should_refuse_climbing_or_empty_paths_when_the_path_is_unsafe', () => {
    for (const hostile of [
      'https://github.com',
      'https://github.com/',
      'https://github.com/exemple/../../projet',
      'https://github.com/exemple/%2e%2e/projet',
      'https://github.com/exemple/%2E%2E',
      'https://github.com/exemple%2f..%2fprojet',
      'https://github.com/exemple%5cprojet',
      'https://github.com/exemple/%00projet',
      'https://github.com/exemple/%zz',
      'https://github.com/exemple//projet',
      'https://github.com/exemple/./projet',
      'https://github.com/exemple/projet?ref=x',
      'https://github.com/exemple/projet#x',
      'https://github.com/exemple/pro"jet',
      'https://github.com/exemple/pro<jet>',
      'https://github.com/exemple/pro`jet`',
      'https://github.com/exemple/pro|jet',
      'git@github.com:',
      'git@github.com:../projet',
      'git@github.com:exemple/pro:jet'
    ])
      expect(reasonOf(hostile), hostile).toBe('PATH')
  })

  it('should_refuse_empty_and_overlong_addresses_when_the_length_is_out_of_bounds', () => {
    expect(reasonOf('')).toBe('EMPTY')
    const long = `https://github.com/exemple/${'a'.repeat(GIT_URL_MAX)}`
    expect(reasonOf(long)).toBe('TOO_LONG')
    const limit = `https://github.com/${'a'.repeat(GIT_URL_MAX - 'https://github.com/'.length)}`
    expect(limit).toHaveLength(GIT_URL_MAX)
    expect(reasonOf(limit)).toBe('ok')
  })
})
