using System;
using System.Globalization;
using Avalonia.Data.Converters;
using KeySharp;

namespace pMusic.Converter;

public class AuthenticateThumbnail : IValueConverter
{
    public static readonly PlayingConverter Instance = new();

    public object? Convert(object? value, Type targetType,
        object? parameter, CultureInfo culture)
    {
        if (value is String url)
        {
            return url + "?X-Plex-Token=" + Keyring.GetPassword("com.ib", "pmusic", "authToken");
        }

        return value;
    }

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}