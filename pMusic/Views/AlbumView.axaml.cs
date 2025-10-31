using System;
using System.Globalization;
using Avalonia.Controls;
using Avalonia.Data.Converters;
using Avalonia.Input;
using Avalonia.Interactivity;
using pMusic.ViewModels;

namespace pMusic.Views;

public partial class AlbumView : UserControl
{
    public AlbumView()
    {
        InitializeComponent();
    }

    protected override void OnLoaded(RoutedEventArgs e)
    {
        var vm = DataContext as AlbumViewModel;
        if (vm == null) return;
        _ = vm.GetTracks();
    }


    private void InputElement_OnPointerEntered(object? sender, PointerEventArgs e)
    {
        Console.WriteLine("Entered");
        Console.WriteLine($"{e.GetCurrentPoint(this).Position}");
    }

    private void InputElement_OnPointerPressed(object? sender, PointerPressedEventArgs e)
    {
        if (sender is not TextBlock textBlock) return;

        Console.WriteLine($"Textblock,{textBlock.Text}");
        var vm = DataContext as AlbumViewModel;
        vm?.GoToArtist(vm.Album!.Artist);
    }
}

public class TimeSpanToMinSecConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is TimeSpan timeSpan)
        {
            // Calculate total minutes including hours
            int totalMinutes = (int)timeSpan.TotalMinutes;
            int seconds = timeSpan.Seconds;

            // Format as mm:ss
            return string.Format("{0:D1}:{1:D2}", totalMinutes, seconds);
        }

        return string.Empty;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
        // Implementation for two-way binding if needed
        // throw new NotImplementedException();
    }
}