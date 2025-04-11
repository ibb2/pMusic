using System;
using System.Globalization;
using Avalonia.Data.Converters;

namespace pMusic.Converter;

public class Seconds : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        TimeSpan timeSpan;

        switch (value)
        {
            case float f:
                timeSpan = TimeSpan.FromSeconds(f);
                break;
            case double d:
                timeSpan = TimeSpan.FromSeconds(d);
                break;
            case TimeSpan ts:
                timeSpan = ts;
                break;
            case string s:
                if (!TimeSpan.TryParse(s, out timeSpan))
                    return "0:00";
                break;
            default:
                return "";
        }

        return $"{(int)timeSpan.TotalMinutes}:{timeSpan.Seconds:D2}";
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => throw new NotImplementedException();
}