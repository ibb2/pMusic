using pMusic.Services;

namespace pMusic.Models;

public record ArtistAlbum(string Title, Artist? Artist);

public interface IArtistAlbumService
{
    ValueTask<ArtistAlbum> GetCurrentArtist(CancellationToken ct);
}

public record ArtistAlbumService : IArtistAlbumService
{
    public async ValueTask<ArtistAlbum> GetCurrentArtist(CancellationToken ct)
    {
        // fake delay to simulate requesting data from a remote server

        return new ArtistAlbum("", null);
    }
}
