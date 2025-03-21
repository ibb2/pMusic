using pMusic.Services;

namespace pMusic.Presentation;

public sealed partial class AlbumPage: Page
{
    public AlbumPage()
    {
        this.InitializeComponent();
        DataContext = new AlbumViewModel();
    }

    protected override async void OnNavigatedTo(NavigationEventArgs e)
    {
        
        var artist = e.Parameter as Artist;
        
        // Assuming DataContext is set to an instance of AlbumModel
        // await new AlbumModel().SetArtistAsync(artist);
        ((AlbumViewModel)DataContext).Model.SetArtistAsync(artist);
    }
}
