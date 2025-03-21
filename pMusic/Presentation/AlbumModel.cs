using CommunityToolkit.Mvvm.ComponentModel;
using pMusic.Services;

namespace pMusic.Presentation;

public record AlbumState(string Title, Artist? CurrentArtist);

public partial record AlbumModel
{

    
    public string? Title { get; }
    public string? Name { get; }
    
    public IState<Artist> CurrentArtist  => State<Artist>.Empty(this);    
    
    public AlbumModel()
    {
        Title = "Artist Page";
    }
    
    public async ValueTask SetArtistAsync(Artist artist)
    {
        await CurrentArtist.UpdateAsync(_ => artist);
    }

}
