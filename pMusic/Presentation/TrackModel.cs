using pMusic.Helpers;
using pMusic.Services;

namespace pMusic.Presentation;

public partial record TrackModel(IArtistService ArtistService, Plex Plex)
{

    public string Title { get; set; }

    public IState<Album> CurrentAlbum => State<Album>.Empty(this);

    public async ValueTask SetCurrentAlbum(Album album)
    {
        await CurrentAlbum.UpdateAsync(_ => album);
    }
    
    public IListFeed<Track> Tracks => CurrentAlbum.SelectAsync(async (album, ct) =>
    {
        var trackList = await ArtistService.GetTrackList(ct, Plex, album.RatingKey);
        return trackList;
    }).AsListFeed();
}
