import type { PlexLibrary, PlexLibrarySelection } from '../../shared/types'

export function selectMusicLibraries(
  libraries: PlexLibrary[],
  selectedLibraries: PlexLibrarySelection[]
): PlexLibrary[] {
  const musicLibraries = libraries.filter(
    (library) => library.type === 'artist'
  )
  const selectedUuids = selectedLibraries
    .map((library) => (typeof library === 'string' ? library : library.uuid))
    .filter(Boolean)

  if (selectedUuids.length === 0) return musicLibraries
  return musicLibraries.filter((library) =>
    selectedUuids.includes(library.uuid)
  )
}
