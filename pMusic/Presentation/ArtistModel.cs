using pMusic.Helpers;
using pMusic.Services;
using Artist = pMusic.Services.Artist;

namespace pMusic.Presentation;

public partial record ArtistModel(IArtistService ArtistService, Plex Plex)
{
    public IListFeed<Artist> Artists => ListFeed.Async(async ct => await ArtistService.GetArtistsAsync(ct, Plex));

    public IState<string> Thumbnail => State<string>.Empty(this);
}
