using System;
using System.Collections.Generic;
using System.Globalization;
using Avalonia.Data.Converters;

// ReSharper disable once CheckNamespace
namespace ShadUI;

/// <summary>
///     Converts the value of the sidebar menu scroller to a visibility boolean.
/// </summary>
/// <remarks>
///     This converter is used to determine the visibility of scroll buttons in sidebar menus.
///     It compares two double values and returns a boolean based on the comparison function provided.
/// </remarks>
public class SidebarScrollerToVisibilityBool : IMultiValueConverter
{
    private readonly Func<double, double, bool> _converter;

    /// <summary>
    ///     Initializes a new instance of the <see cref="SidebarScrollerToVisibilityBool" /> class.
    /// </summary>
    /// <param name="converter">The comparison function to use for determining visibility.</param>
    public SidebarScrollerToVisibilityBool(Func<double, double, bool> converter)
    {
        _converter = converter;
    }

    /// <summary>
    ///     Returns the up instance of the <see cref="SidebarScrollerToVisibilityBool" />.
    ///     This instance shows the scroll button when scrolling up is possible.
    /// </summary>
    /// <remarks>
    ///     Returns true when the first value is greater than the second value,
    ///     indicating that scrolling up is possible.
    /// </remarks>
    public static SidebarScrollerToVisibilityBool Up { get; } = new((x, y) => x > y);

    /// <summary>
    ///     Returns the down instance of the <see cref="SidebarScrollerToVisibilityBool" />.
    ///     This instance shows the scroll button when scrolling down is possible.
    /// </summary>
    /// <remarks>
    ///     Returns true when the first value is less than the second value,
    ///     indicating that scrolling down is possible.
    /// </remarks>
    public static SidebarScrollerToVisibilityBool Down { get; } = new((x, y) => x < y);

    /// <summary>
    ///     Converts the value of the sidebar menu scroller to a visibility boolean.
    /// </summary>
    /// <param name="values">The array of values to convert. Expects two double values.</param>
    /// <param name="targetType">The type of the binding target property.</param>
    /// <param name="parameter">The converter parameter to use.</param>
    /// <param name="culture">The culture to use in the converter.</param>
    /// <returns>A boolean value indicating visibility, or null if conversion fails.</returns>
    /// <remarks>
    ///     The converter expects exactly two double values in the values array.
    ///     The first value is typically the current scroll position, and the second is the maximum scroll position.
    /// </remarks>
    public object? Convert(IList<object?> values, Type targetType, object? parameter, CultureInfo culture)
    {
        if (values[0] is not double firstVal) return null;
        if (values[1] is not double secondVal) return null;
        return _converter(firstVal, secondVal);
    }
}