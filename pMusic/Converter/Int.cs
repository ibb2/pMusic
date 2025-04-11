using System;
using System.Globalization;
using Avalonia.Data.Converters;
using SoundFlow.Enums;

namespace pMusic.Converter;

public class Int : IValueConverter
{
    public static readonly PlayingConverter Instance = new();

    public object? Convert(object? value, Type targetType,
        object? parameter, CultureInfo culture)
    {
        if (value is int position)
            return position == 1;

        return false;
    }

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}