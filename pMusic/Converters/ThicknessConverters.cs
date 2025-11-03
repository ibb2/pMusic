using System;
using Avalonia;
using Avalonia.Data.Converters;

// ReSharper disable once CheckNamespace
namespace ShadUI;

/// <summary>
///     Provides value converters for manipulating Thickness values in XAML.
/// </summary>
/// <remarks>
///     This class contains static converters that can be used to extract specific thickness values
///     from a Thickness or create new Thickness instances with modified corner values.
/// </remarks>
public static class ThicknessConverters
{
    /// <summary>
    ///     Converts a Thickness to the largest of its four values (Left, Top, Right, Bottom).
    /// </summary>
    /// <remarks>
    ///     This converter finds the maximum value among all four sides of a Thickness and returns it as a double.
    ///     Useful for determining the maximum padding or margin value.
    /// </remarks>
    public static readonly IValueConverter ToLargest =
        new FuncValueConverter<Thickness, double>(x => Math.Max(x.Left, Math.Max(x.Top, Math.Max(x.Right, x.Bottom))));

    /// <summary>
    ///     Converts a Thickness to a new Thickness with the bottom value set to 0.
    /// </summary>
    /// <remarks>
    ///     This converter creates a new Thickness where the bottom value is set to 0 while preserving
    ///     the left, top, and right values from the original Thickness.
    /// </remarks>
    public static readonly IValueConverter NoBottom =
        new FuncValueConverter<Thickness, Thickness>(x => new Thickness(x.Left, x.Top, x.Right, 0));

    /// <summary>
    ///     Converts a Thickness to a new Thickness with the top value set to 0.
    /// </summary>
    /// <remarks>
    ///     This converter creates a new Thickness where the top value is set to 0 while preserving
    ///     the left, right, and bottom values from the original Thickness.
    /// </remarks>
    public static readonly IValueConverter NoTop =
        new FuncValueConverter<Thickness, Thickness>(x => new Thickness(x.Left, 0, x.Right, x.Bottom));

    /// <summary>
    ///     Converts a Thickness to a new Thickness with only left and right values (top and bottom set to 0).
    /// </summary>
    /// <remarks>
    ///     This converter creates a new Thickness where only the left and right values are preserved,
    ///     with top and bottom values set to 0. Useful for horizontal-only spacing.
    /// </remarks>
    public static readonly IValueConverter LeftRight =
        new FuncValueConverter<Thickness, Thickness>(x => new Thickness(x.Left, 0, x.Right, 0));
}