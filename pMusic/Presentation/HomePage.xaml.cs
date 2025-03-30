namespace pMusic.Presentation;

public sealed partial class HomePage : Page
{

    public HomePage()
    {
        this.InitializeComponent();
        this.DataContext = (Application.Current as App)?.Host?.Services.GetRequiredService<HomeViewModel>();
    }
}
