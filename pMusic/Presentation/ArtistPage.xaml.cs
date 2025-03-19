using pMusic.Services;

namespace pMusic.Presentation;

public sealed partial class ArtistPage : Page
{

    public ArtistPage()
    {
        this.InitializeComponent();
        this.DataContext = (Application.Current as App)?.Host?.Services.GetRequiredService<ArtistViewModel>();
    }
    
}
