using System;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Markup.Xaml;

namespace pMusic.Views;

public partial class HomeView : UserControl
{
    public HomeView()
    {
        InitializeComponent();
    }

    private void ScrollViewer_PointerWheelChanged(object? sender, PointerWheelEventArgs e)
    {
        if (e.Delta.Y != 0)
        {
            // Ignore vertical scrolling
            e.Handled = true;
            return;
        }

        Console.WriteLine($"Delta: x->{e.Delta.X} y->{e.Delta.Y}");
        // Check if the scroll event is vertical
        if (e.Delta.X == 0 && e.Delta.Y != 0)
        {
            Console.WriteLine($"Delta y: {e.Delta.Y}");
            // Ignore vertical scrolling by marking the event as handled
            e.Handled = true;
            return;
        }

        Console.WriteLine($"Delta y happening: {e.Delta.Y}");

        // For horizontal scrolling, do not mark the event as handled
        // This allows the default horizontal scrolling behavior to occur
    }
}