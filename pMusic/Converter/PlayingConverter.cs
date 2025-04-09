using System;
using System.Globalization;
using Avalonia.Data;
using Avalonia.Data.Converters;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using SoundFlow.Enums;

namespace pMusic.Converter;

public class PlayingConverter : IValueConverter
{
    public static readonly PlayingConverter Instance = new();

    public object? Convert(object? value, Type targetType,
        object? parameter, CultureInfo culture)
    {
        if (value is PlaybackState state)
        {
            Console.WriteLine($"Playback State: {state == PlaybackState.Playing}");
            return state == PlaybackState.Playing;

            // see https://docs.avaloniaui.net/docs/guides/data-binding/how-to-create-a-custom-data-binding-converter
        }

        return false;
    }

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}