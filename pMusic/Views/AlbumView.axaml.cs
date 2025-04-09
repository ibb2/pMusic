using System;
using System.Globalization;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Data.Converters;
using Avalonia.Input;
using Avalonia.Markup.Xaml;

namespace pMusic.Views;

public partial class AlbumView : UserControl
{
    public AlbumView()
    {
        InitializeComponent();
    }

    private void InputElement_OnPointerEntered(object? sender, PointerEventArgs e)
    {
        Console.WriteLine("Entered");
        Console.WriteLine($"{e.GetCurrentPoint(this).Position}");
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