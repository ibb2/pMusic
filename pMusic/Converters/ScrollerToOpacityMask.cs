using System;
using System.Collections.Generic;
using System.Globalization;
using Avalonia;
using Avalonia.Data.Converters;
using Avalonia.Media;

// ReSharper disable once CheckNamespace
namespace ShadUI;

/// <summary>
///     Converts the value of the sidebar menu scroller to an opacity mask.
/// </summary>
/// <remarks>
///     This converter is used to create gradient opacity masks for scrollable content areas.
///     It compares two double values and returns an appropriate gradient brush based on the comparison.
/// </remarks>
public class ScrollerToOpacityMask : IMultiValueConverter
{
    /// <summary>
    ///     The bottom gradient brush that fades from opaque to transparent.
    /// </summary>
    private static readonly LinearGradientBrush BottomBrush = new()
    {
        StartPoint = new RelativePoint(0.5, 0, RelativeUnit.Relative),
        EndPoint = new RelativePoint(0.5, 0.95, RelativeUnit.Relative),
        GradientStops =
        [
            new GradientStop(Colors.Black, 0.9),
            new GradientStop(Colors.Transparent, 1)
        ]
    };

    /// <summary>
    ///     The top gradient brush that fades from transparent to opaque.
    /// </summary>
    private static readonly LinearGradientBrush TopBrush = new()
    {
        StartPoint = new RelativePoint(0.5, 1, RelativeUnit.Relative),
        EndPoint = new RelativePoint(0.5, 0.05, RelativeUnit.Relative),
        GradientStops =
        [
            new GradientStop(Colors.Black, 0.9),
            new GradientStop(Colors.Transparent, 1)
        ]
    };

    private readonly Func<double, double, IBrush?> _func;

    /// <summary>
    ///     Initializes a new instance of the <see cref="ScrollerToOpacityMask" /> class.
    /// </summary>
    /// <param name="func">The function that determines which brush to return based on scroll values.</param>
    public ScrollerToOpacityMask(Func<double, double, IBrush?> func)
    {
        _func = func;
    }

    /// <summary>
    ///     Gets the top mask instance for creating fade-out effects at the top of scrollable content.
    /// </summary>
    /// <remarks>
    ///     This instance creates a gradient that fades from transparent at the top to opaque at the bottom.
    ///     It's typically used when content can be scrolled up.
    /// </remarks>
    public static ScrollerToOpacityMask Top { get; } = new((x, y) => x > y ? TopBrush : Brushes.White);

    /// <summary>
    ///     Gets the bottom mask instance for creating fade-out effects at the bottom of scrollable content.
    /// </summary>
    /// <remarks>
    ///     This instance creates a gradient that fades from opaque at the top to transparent at the bottom.
    ///     It's typically used when content can be scrolled down.
    /// </remarks>
    public static ScrollerToOpacityMask Bottom { get; } = new((x, y) => x < y ? BottomBrush : Brushes.White);

    /// <summary>
    ///     Converts the value of the scroller to an opacity mask.
    /// </summary>
    /// <param name="values">The array of values to convert. Expects two double values representing scroll positions.</param>
    /// <param name="targetType">The type of the binding target property.</param>
    /// <param name="parameter">The converter parameter to use.</param>
    /// <param name="culture">The culture to use in the converter.</param>
    /// <returns>A gradient brush for the opacity mask, or null if conversion fails.</returns>
    /// <remarks>
    ///     The converter expects exactly two double values in the values array.
    ///     The first value is typically the current scroll position, and the second is the maximum scroll position.
    ///     Based on the comparison of these values, it returns an appropriate gradient brush for the opacity mask.
    /// </remarks>
    public object? Convert(IList<object?> values, Type targetType, object? parameter, CultureInfo culture)
    {
        if (values.Count != 2) return null;
        if (values[0] is not double valOne) return null;
        if (values[1] is not double valTwo) return null;
        return _func(valOne, valTwo);
    }
}