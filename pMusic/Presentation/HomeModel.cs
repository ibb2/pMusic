using pMusic.Helpers;
using pMusic.Services;

namespace pMusic.Presentation;

public partial record HomeModel
{

    public IArtistService ArtistService;
    public Plex Plex;

    public HomeModel(IArtistService artistService, Plex plex)
    {
        ArtistService = artistService;
        Plex = plex;
    }

    public IListFeed<Album> RecentlyPlayedAlbums => ListFeed.Async(async ct => (await ArtistService.GetAllAlbums(ct, Plex)).OrderByDescending(a => a.LastViewedAt).ToImmutableList());

    public IListFeed<Playlist> Playlists => ListFeed.Async(async ct => await ArtistService.GetPlaylists(ct, Plex));
}
