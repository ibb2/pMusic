using pMusic.Services;
using pMusic.Services.Navigation;

namespace pMusic.Presentation;

public sealed partial class ArtistPage : Page
{

    public ArtistPage()
    {
        this.InitializeComponent();
        this.DataContext = (Application.Current as App)?.Host?.Services.GetRequiredService<ArtistViewModel>();
    }
    
    public void GoToAlbumPage_ItemClick(object sender, RoutedEventArgs e)
    {
        var artist = ((Button)sender).DataContext as Artist;
        FrameNavigation.NavigateTo(typeof(AlbumPage), parameter: artist);
        var i = 1;
    }
}
