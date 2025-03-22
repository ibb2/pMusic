namespace pMusic.Services.Navigation;


public interface IFrameNavigation
{
    Frame Frame { get; set; }
    void NavigateTo(Type pageType, object paramater);
    void GoBack();
    bool CanGoBack { get; }
}

public class FrameNavigation
{
    
    
    public static Frame Frame { get; set; }

    public static void NavigateTo(Type pageType, object parameter = null)
    {
        Frame.Navigate(pageType, parameter: parameter);
    }
}
