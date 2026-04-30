import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { Disc3, Heart, MoreVertical, Music, Play } from 'lucide-react'

export const Route = createFileRoute('/app/artist/$ratingKey')({
  component: ArtistPage
})

export function ArtistPage() {
  const { ratingKey } = Route.useParams()

  // queries
  const queryArtist = useQuery({
    queryKey: ['artist', ratingKey],
    queryFn: () => window.api.media.getArtist(ratingKey)
  })
  const queryArtistAlbums = useQuery({
    queryKey: ['artistAlbum', ratingKey],
    queryFn: () => window.api.media.getArtistAlbums(ratingKey)
  })
  const queryArtistPopularTracks = useQuery({
    queryKey: ['artistPopularTrack', ratingKey],
    queryFn: () => window.api.media.getArtistPopularTracks(ratingKey)
  })

  if (queryArtist.isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (queryArtist.isError) {
    const message = queryArtist.error?.message || 'Unknown artist error'
    return `Error loading artist: ${message}`
  }

  const artist = queryArtist.data
  const albums = queryArtistAlbums.data ?? []
  const popularTracks = queryArtistPopularTracks.data?.tracks ?? []

  return (
    <div className="flex min-h-full flex-col p-6 pb-10">
      {/* Artist Header */}
      <div className="flex gap-6 mb-6">
        <img
          src={artist.thumb}
          alt={artist.title}
          className="w-48 h-48 rounded-full object-cover shadow-xl"
        />
        <div className="flex flex-col justify-between py-2">
          <div>
            {queryArtist.data.verified && (
              <div className="text-blue-400 text-sm mb-2">✓ VERIFIED ARTIST</div>
            )}
            <h1 className="text-5xl font-bold mb-2">{artist.title}</h1>
            {/*<div className="text-zinc-400">{queryArtist.data.followers} monthly listeners</div>*/}
            <div className="text-muted-foreground">{artist.viewCount ?? 0} plays</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          className="px-8"
          onClick={() => {
            window.api.player.playArtist(ratingKey)
          }}
        >
          <Play size={18} className="mr-2" fill="black" />
          Play
        </Button>
        <Button variant="outline">
          <Heart size={18} className="mr-2" />
          Follow
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <MoreVertical size={20} />
        </Button>
      </div>

      {/* Popular Tracks */}
      <div className="mb-8">
        <h2 className="text-2xl mb-4">Popular Tracks</h2>
        <div className="bg-slate-300/10 rounded-lg">
          {queryArtistPopularTracks.isLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Spinner className="size-5" />
            </div>
          ) : popularTracks.length > 0 ? (
            popularTracks.map((track: any, index: number) => (
              <div
                key={track.id}
                className="flex items-center gap-4 px-4 py-3 rounded group hover:bg-slate-200/50 transition-colors cursor-pointer"
              >
                <div className="text-center w-8 group-hover:hidden">{index + 1}</div>
                <button
                  className="hidden group-hover:block"
                  onClick={() => {
                    window.api.player.playTrack(String(track.ratingKey))
                  }}
                >
                  <Play size={16} className="text-shadow-black w-8" fill="black" />
                </button>
                <div className="flex-1">
                  <div className="">{track.title}</div>
                  <div className="text-zinc-400 text-sm">
                    {Intl.NumberFormat('en-US', {
                      notation: 'compact',
                      compactDisplay: 'short'
                    }).format(track.ratingCount ?? 0)}
                  </div>
                </div>
                <div className="text-zinc-400 text-sm">
                  {dayjs.duration(track.duration).format('m:ss')}
                </div>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Heart size={16} className="text-zinc-400 hover:text-white" />
                </button>
              </div>
            ))
          ) : (
            <div className="flex h-24 items-center gap-3 px-4 text-sm text-muted-foreground">
              <Music className="size-5" />
              <div>
                {queryArtistPopularTracks.isError
                  ? 'Popular tracks are unavailable'
                  : 'No popular tracks found'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Albums */}
      <div>
        <h2 className="text-2xl mb-4">Albums</h2>
        {queryArtistAlbums.isLoading ? (
          <div className="flex h-48 items-center justify-center rounded-md border border-dashed">
            <Spinner className="size-5" />
          </div>
        ) : albums.length > 0 ? (
          <div className="flex flex-row gap-4 overflow-x-auto pb-2 scrollbar-hidden">
            {albums.map((album: any) => (
              <Link
                key={album.id}
                to={`/app/album/$ratingKey`}
                params={{ ratingKey: album.ratingKey }}
              >
                <Card key={album.id} className="flex p-4 justify-center min-w-36 h-48 shrink-0">
                  <CardHeader className="p-0">
                    <img
                      src={album.thumb}
                      alt={album.title}
                      className="w-full object-cover rounded-lg"
                    />
                    <CardTitle className="overflow-hidden text-ellipsis text-nowrap">
                      {album.title}
                    </CardTitle>
                    <CardDescription>{album.year}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex h-24 items-center gap-3 rounded-md border border-dashed px-4 text-sm text-muted-foreground">
            <Disc3 className="size-5" />
            <div>{queryArtistAlbums.isError ? 'Albums are unavailable' : 'No albums found'}</div>
          </div>
        )}
      </div>
    </div>
  )
}
