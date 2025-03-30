using Microsoft.UI.Xaml.Media.Imaging;
using pMusic.Helpers;

namespace pMusic.Services;

public partial record Artist(
    string RatingKey = "",
    string Key = "",
    string Guid = "",
    string Type = "",
    string Title = "",
    string Index = "",
    string UserRating = "",
    string ViewCount = "",
    string SkipCount = "",
    string LastViewedAt = "",
    string LastRatedAt = "",
    BitmapImage? Thumb = null,
    string AddedAt = "",
    string UpdatedAt = "",
    int LibraryKey = 0,
    Image? Image = null,
    UltraBlurColors? Ubc = null,
    Genre[]? Genres = null,
    Country? Country = null
);

public record Image
{
    public string Alt { get; set; }
    public string Type { get; set; }
    public string Url { get; set; }
}

public record UltraBlurColors
{
    public string TopLeft { get; set; }
    public string TopRight { get; set; }
    public string BottomLeft { get; set; }
    public string BottomRight { get; set; }
}

public record Genre
{
    public string Tag { get; set; }
}

public record Country
{
    public string Tag { get; set; }
}


public interface IArtistService
{
    ValueTask<IImmutableList<Artist>> GetArtistsAsync(CancellationToken ct, Plex plex);
    ValueTask<IImmutableList<Album>> GetArtistAlbums(CancellationToken ct, Plex plex, int libraryId, string artistKey);
    ValueTask<IImmutableList<Track>> GetTrackList(CancellationToken ct, Plex plex, string artistKey);
    string GetServerUri();

}

public class ArtistService : IArtistService
{
    
    public static string? ServerUri { get; set; }

    public async ValueTask<IImmutableList<Artist>> GetArtistsAsync(CancellationToken ct, Plex plex)
    {
        await Task.Delay(TimeSpan.FromSeconds(1), ct);

        ServerUri =  await plex.GetServerCapabilitiesAsync();
        var artists = await plex.GetArtists(ServerUri);

        return artists;
    }

    public async ValueTask<IImmutableList<Album>> GetArtistAlbums(CancellationToken ct, Plex plex, int libraryId, string artistKey)
    {
        await Task.Delay(TimeSpan.FromSeconds(1), ct);

        var albums = await plex.GetArtistAlbums(ServerUri!, libraryId, artistKey);

        var temp = ImmutableArray<Album>.Empty;
        return albums;
    }    
    
    public async ValueTask<IImmutableList<Track>> GetTrackList(CancellationToken ct, Plex plex, string artistKey)
    {
        await Task.Delay(TimeSpan.FromSeconds(1), ct);

        var albums = await plex.GetTrackList(ServerUri!, artistKey);

        var temp = ImmutableArray<Album>.Empty;
        return albums;
    }

    public string GetServerUri()
    {
        return ServerUri;
    }
    
}
