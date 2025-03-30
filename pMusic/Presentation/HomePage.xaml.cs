using pMusic.Services.Navigation;

namespace pMusic.Presentation;

public sealed partial class HomePage : Page
{

    public HomePage()
    {
        this.InitializeComponent();
        this.DataContext = (Application.Current as App)?.Host?.Services.GetRequiredService<HomeViewModel>();
    }

    public void GoToTrackPage(object sender, ItemClickEventArgs e)
    {
        var album = e.ClickedItem as Album;
        FrameNavigation.NavigateTo(typeof(TrackPage), album);
    }
}
