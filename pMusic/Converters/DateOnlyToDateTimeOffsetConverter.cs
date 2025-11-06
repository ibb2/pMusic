using System;
using System.Globalization;
using Avalonia.Data.Converters;

namespace ShadUI.Demo.Converters;

public class DateOnlyToDateTimeOffsetConverter : IValueConverter
{
    public static readonly DateOnlyToDateTimeOffsetConverter Instance = new();

    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        return value is DateOnly dateOnly ? new DateTimeOffset(dateOnly.ToDateTime(TimeOnly.MinValue)) : null;
    }

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        return value is DateTimeOffset dateTimeOffset ? DateOnly.FromDateTime(dateTimeOffset.DateTime) : null;
    }
}