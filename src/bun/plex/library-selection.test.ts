import { describe, expect, test } from 'bun:test'
import { selectMusicLibraries } from './library-selection'
import type { PlexLibrary } from '../../shared/types'

const music = library('music', 'artist')
const video = library('video', 'movie')

describe('Plex library selection', () => {
  test('uses every music library when the saved selection is empty', () => {
    expect(selectMusicLibraries([music, video], [])).toEqual([music])
  })

  test('supports legacy UUID selections and library objects', () => {
    const second = library('second', 'artist')
    expect(selectMusicLibraries([music, second], [second.uuid])).toEqual([
      second
    ])
    expect(selectMusicLibraries([music, second], [music])).toEqual([music])
  })
})

function library(uuid: string, type: string): PlexLibrary {
  return {
    key: uuid,
    title: uuid,
    type,
    uuid
  }
}
