using pMusic.Services;
using pMusic.Services.Navigation;

namespace pMusic.Presentation;

public sealed partial class AlbumPage: Page
{
    public AlbumPage()
    {
        this.InitializeComponent();
        this.DataContext = (Application.Current as App)?.Host?.Services.GetRequiredService<AlbumViewModel>();
    }

    protected override async void OnNavigatedTo(NavigationEventArgs e)
    {
        
        var artist = e.Parameter as Artist;
        
        // Assuming DataContext is set to an instance of AlbumModel
        await ((AlbumViewModel)DataContext).Model.SetArtistAsync(artist);
    }
    
    public void GoToTrackListClick(object sender, RoutedEventArgs e)
    {
        var album = ((Button)sender).DataContext as Album;
        FrameNavigation.NavigateTo(typeof(TrackPage), parameter: album);
        var i = 1;
    }
}
