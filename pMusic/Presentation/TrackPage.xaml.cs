namespace pMusic.Presentation;

public sealed partial class TrackPage: Page
{

    public TrackPage()
    {
        this.InitializeComponent();
        this.DataContext = (Application.Current as App).Host.Services.GetRequiredService<TrackViewModel>();
    }

    protected override async void OnNavigatedTo(NavigationEventArgs e)
    {
        var album = e.Parameter as Album;

        await ((TrackViewModel)DataContext).Model.SetCurrentAlbum(album);
    }
}
