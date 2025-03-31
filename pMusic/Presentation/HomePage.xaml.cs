using System.Diagnostics;
using Windows.Foundation.Metadata;
using Microsoft.UI.Xaml.Input;
using pMusic.Services.Navigation;
using Uno.UI.HotDesign.Xaml.Interactivity;

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
    
    // Adjust this factor to control scroll speed/sensitivity
    private const double SCROLL_SENSITIVITY_FACTOR = 0.5; // Example: Half the default speed
    
    private void MyScrollViewer_PointerWheelChanged(object sender, PointerRoutedEventArgs e)
    {
        // Cast the sender to ScrollViewer
        if (sender is ScrollViewer scrollViewer)
        {
            // Get the properties of the pointer event, specifically the mouse wheel delta
            var pointerPoint = e.GetCurrentPoint(scrollViewer);
            double delta = pointerPoint.Properties.MouseWheelDelta;

            if (!pointerPoint.Properties.IsHorizontalMouseWheel) return;

            // Calculate the new vertical offset
            // We *subtract* the delta (multiplied by a sensitivity factor)
            // from the current offset to invert the direction.
            double horizontalOffset = scrollViewer.HorizontalOffset - (delta * SCROLL_SENSITIVITY_FACTOR);

            // Use ChangeView to scroll to the new offset smoothly
            // Pass null for horizontalOffset and zoomFactor if you don't want to change them.
            // Pass false for disableAnimation if you want the default smooth scroll.
            scrollViewer.ChangeView(horizontalOffset, 0, null, disableAnimation: false);

            // Mark the event as handled to prevent the default ScrollViewer behavior
            // which would scroll in the original direction.
            e.Handled = true;
        }
    }
}
