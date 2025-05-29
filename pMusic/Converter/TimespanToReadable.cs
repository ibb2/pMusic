using System;
using System.Collections.Generic;
using System.Globalization;
using Avalonia.Data.Converters;

namespace pMusic.Converter;

public class TimespanToReadable : IValueConverter
{
    public static readonly TimespanToReadable Instance = new();

    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is TimeSpan ts)
        {
            var parts = new List<string>();
            if (ts.TotalHours >= 1)
                parts.Add($"{(int)ts.TotalHours} hour{(ts.TotalHours >= 2 ? "s" : "")}");
            if (ts.Minutes > 0)
                parts.Add($"{ts.Minutes} min{(ts.Minutes != 1 ? "s" : "")}");
            if (ts.Hours < 1 && ts.Seconds > 0)
                parts.Add($"{ts.Seconds} second{(ts.Seconds != 1 ? "s" : "")}");
            return string.Join(" ", parts);
        }

        return string.Empty;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}