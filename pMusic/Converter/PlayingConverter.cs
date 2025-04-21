using System;
using System.Globalization;
using Avalonia.Data.Converters;
using ManagedBass;

namespace pMusic.Converter;

public class PlayingConverter : IValueConverter
{
    public static readonly PlayingConverter Instance = new();

    public object? Convert(object? value, Type targetType,
        object? parameter, CultureInfo culture)
    {
        if (value is not PlaybackState state)
            return false;

        var param = parameter as string;

        if (param == "NotPlaying")
            return state != PlaybackState.Playing;

        return state == PlaybackState.Playing;

        // see https://docs.avaloniaui.net/docs/guides/data-binding/how-to-create-a-custom-data-binding-converter
    }

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}