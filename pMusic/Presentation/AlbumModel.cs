using CommunityToolkit.Mvvm.ComponentModel;
using pMusic.Helpers;
using pMusic.Services;

namespace pMusic.Presentation;

public record AlbumState(string Title, Artist? CurrentArtist);

public partial record AlbumModel(IArtistService ArtistService, Plex Plex)
{
    public string? Title { get; }
    public string? Name { get; }
    
    public IState<Artist> CurrentArtist  => State<Artist>.Empty(this);
    public static Artist? Artist;
    
    public async ValueTask SetArtistAsync(Artist artist)
    {
        await CurrentArtist.UpdateAsync(_ => artist);
    }
    
    // public IListFeed<Album> Albums => ListFeed.Async<Album>(async ct => await ArtistService.GetArtistAlbums(ct, Plex, Artist.LibraryKey, Artist.RatingKey));
    public IListFeed<Album> Albums => CurrentArtist.SelectAsync(async (artist, ct) =>
    {
        var artistsAlbums =  await ArtistService.GetArtistAlbums(ct, Plex, artist.LibraryKey, artist.RatingKey, artist.Title);
        return artistsAlbums;
    }).AsListFeed();
}
