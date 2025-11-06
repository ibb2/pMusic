using Avalonia;
using Avalonia.Data.Converters;

// ReSharper disable once CheckNamespace
namespace ShadUI;

/// <summary>
///     Provides value converters for manipulating CornerRadius values in XAML.
/// </summary>
/// <remarks>
///     This class contains static converters that can be used to extract specific corner values
///     from a CornerRadius or create new CornerRadius instances with only specific corners.
/// </remarks>
public static class CornerRadiusConverters
{
    /// <summary>
    ///     Converts a CornerRadius to a new CornerRadius with only the top corners (TopLeft and TopRight).
    /// </summary>
    /// <remarks>
    ///     This converter takes a CornerRadius input and returns a new CornerRadius where only
    ///     the top-left and top-right corners retain their original values, while bottom corners are set to 0.
    /// </remarks>
    public static readonly IValueConverter TopOnly =
        new FuncValueConverter<CornerRadius, CornerRadius>(x => new CornerRadius(x.TopLeft, x.TopRight, 0, 0));

    /// <summary>
    ///     Converts a CornerRadius to a new CornerRadius with only the bottom corners (BottomLeft and BottomRight).
    /// </summary>
    /// <remarks>
    ///     This converter takes a CornerRadius input and returns a new CornerRadius where only
    ///     the bottom-left and bottom-right corners retain their original values, while top corners are set to 0.
    /// </remarks>
    public static readonly IValueConverter BottomOnly =
        new FuncValueConverter<CornerRadius, CornerRadius>(x => new CornerRadius(0, 0, x.BottomRight, x.BottomLeft));

    /// <summary>
    ///     Converts a CornerRadius to a new CornerRadius with only the left corners (TopLeft and BottomLeft).
    /// </summary>
    /// <remarks>
    ///     This converter takes a CornerRadius input and returns a new CornerRadius where only
    ///     the top-left and bottom-left corners retain their original values, while right corners are set to 0.
    /// </remarks>
    public static readonly IValueConverter LeftOnly =
        new FuncValueConverter<CornerRadius, CornerRadius>(x => new CornerRadius(x.TopLeft, 0, 0, x.BottomLeft));

    /// <summary>
    ///     Converts a CornerRadius to a new CornerRadius with only the right corners (TopRight and BottomRight).
    /// </summary>
    /// <remarks>
    ///     This converter takes a CornerRadius input and returns a new CornerRadius where only
    ///     the top-right and bottom-right corners retain their original values, while left corners are set to 0.
    /// </remarks>
    public static readonly IValueConverter RightOnly =
        new FuncValueConverter<CornerRadius, CornerRadius>(x => new CornerRadius(0, x.TopRight, x.BottomRight, 0));

    /// <summary>
    ///     Extracts the TopLeft corner value from a CornerRadius.
    /// </summary>
    /// <remarks>
    ///     This converter takes a CornerRadius input and returns the double value of the top-left corner.
    /// </remarks>
    public static readonly IValueConverter TopLeft =
        new FuncValueConverter<CornerRadius, double>(x => x.TopLeft);

    /// <summary>
    ///     Extracts the BottomRight corner value from a CornerRadius.
    /// </summary>
    /// <remarks>
    ///     This converter takes a CornerRadius input and returns the double value of the bottom-right corner.
    /// </remarks>
    public static readonly IValueConverter BottomRight =
        new FuncValueConverter<CornerRadius, double>(x => x.BottomRight);
}