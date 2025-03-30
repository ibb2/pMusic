using pMusic.Services.Navigation;

namespace pMusic.Presentation;

public sealed partial class MainPage : Page
{
    public MainPage()
    {
        this.InitializeComponent();
        this.DataContext = (Application.Current as App)?.Host?.Services.GetRequiredService<MainViewModel>();
        FrameNavigation.Frame = ContentFrame;
    }

    private void NavigationView_OnSelectionChanged(NavigationView sender, NavigationViewSelectionChangedEventArgs args)
    {

        if (args.SelectedItemContainer is NavigationViewItem selectedItem)
        {
            var selectedTag = selectedItem.Tag.ToString();
            var pageType = selectedTag switch
            {
                "home" => typeof(HomePage),
                "second" => typeof(SecondPage),
                // Map other tags to their respective pages
                _ => null
            };

            if (pageType != null && ContentFrame.CurrentSourcePageType != pageType)
            {
                ContentFrame.Navigate(pageType);
            }
        }
        
    }
    
    private void GoToSecond(object sender, RoutedEventArgs e)
    {
        // var name = await Name;
        // await _navigator.NavigateViewModelAsync<SecondModel>(this, data: new Entity(name!));
        Console.WriteLine("Navigating");
        FrameNavigation.NavigateTo(typeof(SecondPage), Name);
        Console.WriteLine("Navigated");
    }
    
    public Frame RootContentFrame => ContentFrame;
}
