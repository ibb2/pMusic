namespace pMusic.Presentation;

public partial record TrackModel
{

    public string Title { get; set; }
    
    public TrackModel()
    {
        Title = "Track Page";
    }

    public IState<Album> CurrentAlbum => State<Album>.Empty(this);

    public async ValueTask SetCurrentAlbum(Album album)
    {
        await CurrentAlbum.UpdateAsync(_ => album);
    }
}
