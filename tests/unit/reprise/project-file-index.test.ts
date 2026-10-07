import { describe, expect, it } from 'vitest'
import { PROJECT_FILES_TTL_MS, ProjectFileIndex } from '../../../src/main/infrastructure/reprise/ProjectFileIndex'

describe('inventaire des fichiers d’un dossier de projet', () => {
  it('should_rescan_a_folder_only_after_thirty_seconds_when_asked_again', () => {
    let now = 0
    let scans = 0
    const index = new ProjectFileIndex({
      scan: () => {
        scans += 1
        return ['a.md']
      },
      now: () => now
    })
    index.files('D:/p')
    now = PROJECT_FILES_TTL_MS - 1
    index.files('D:/p')
    expect(scans).toBe(1)
    now = PROJECT_FILES_TTL_MS
    index.files('D:/p')
    index.files('D:/autre')
    expect(scans).toBe(3)
  })

  it('should_return_an_empty_list_when_the_folder_cannot_be_read', () => {
    const index = new ProjectFileIndex({
      scan: () => {
        throw new Error('dossier introuvable')
      }
    })
    expect(index.files('D:/disparu')).toEqual([])
  })
})
