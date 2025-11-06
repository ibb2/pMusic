using System;
using System.Collections.Generic;
using System.Globalization;
using Avalonia.Data.Converters;

// ReSharper disable once CheckNamespace
namespace ShadUI;

/// <summary>
///     Converts the width and breakpoint to a visibility value.
/// </summary>
public class WidthToVisibilityConverter : IMultiValueConverter
{
    /// <summary>
    ///     Gets the singleton instance of the <see cref="WidthToVisibilityConverter" />.
    /// </summary>
    public static WidthToVisibilityConverter Instance => new();

    /// <summary>
    ///     Converts the width and breakpoint to a visibility value.
    /// </summary>
    /// <param name="values">The values to convert. Expects width, breakpoint, and invert flag.</param>
    /// <param name="targetType">The type of the binding target property.</param>
    /// <param name="parameter">The converter parameter to use.</param>
    /// <param name="culture">The culture to use in the converter.</param>
    /// <returns>A boolean value indicating visibility.</returns>
    public object? Convert(IList<object?> values, Type targetType, object? parameter, CultureInfo culture)
    {
        if (values[0] is not double width) return true;
        if (values[1] is not Breakpoint breakpoint) return true;
        if (values[2] is not bool invert) return true;
        var isVisible = BreakpointRange.Ranges.TryGetValue(breakpoint, out var condition) &&
                        condition(width);
        return invert ? !isVisible : isVisible;
    }
}