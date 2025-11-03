using Avalonia;
using Avalonia.Controls;
using Avalonia.Data.Converters;
using Avalonia.Layout;

// ReSharper disable once CheckNamespace
namespace ShadUI;

/// <summary>
///     Provides value converters for boolean operations and transformations.
/// </summary>
/// <remarks>
///     This class contains static converters that can be used to transform boolean values
///     into other types such as opacity values, loading controls, or numeric values.
/// </remarks>
public static class BooleanConverters
{
    /// <summary>
    ///     Converts a boolean value to an inverse opacity value (0 for true, 1 for false).
    /// </summary>
    /// <remarks>
    ///     This converter is useful for hiding elements when a condition is true.
    ///     Returns 0 (fully transparent) when the boolean is true, and 1 (fully opaque) when false.
    /// </remarks>
    public static readonly IValueConverter ToInverseOpacity =
        new FuncValueConverter<bool, int>(value => value ? 0 : 1);

    /// <summary>
    ///     Converts a boolean value to either a Loading control or a Panel.
    /// </summary>
    /// <remarks>
    ///     This converter returns a Loading control when the boolean is true, and a Panel when false.
    ///     Useful for showing loading states in UI elements.
    /// </remarks>
    public static readonly IValueConverter ToLoading =
        new FuncValueConverter<bool, object>(value => value ? new Loading() : new Panel());

    /// <summary>
    ///     Converts a boolean value to either a specified double value or zero.
    /// </summary>
    /// <remarks>
    ///     This converter returns the parsed parameter value when the boolean is true, and 0 when false.
    ///     The parameter should be a string representation of a double value.
    ///     
    ///     Parameters:
    ///     - value: The boolean value to convert
    ///     - param: A string representation of the double value to return when true
    /// </remarks>
    public static readonly IValueConverter ToZeroOrDouble =
        new FuncValueConverter<bool, string, double>((value, param) =>
        {
            var paramValue = double.TryParse(param, out var parsedValue) ? parsedValue : 0;
            return value ? paramValue : 0;
        });

    /// <summary>
    ///     Converts a boolean value to either zero or a specified double value (inverse of ToZeroOrDouble).
    /// </summary>
    /// <remarks>
    ///     This converter returns 0 when the boolean is true, and the parsed parameter value when false.
    ///     The parameter should be a string representation of a double value.
    ///     
    ///     Parameters:
    ///     - value: The boolean value to convert
    ///     - param: A string representation of the double value to return when false
    /// </remarks>
    public static readonly IValueConverter ToDoubleOrZero =
        new FuncValueConverter<bool, string, double>((value, param) =>
        {
            var paramValue = double.TryParse(param, out var parsedValue) ? parsedValue : 0;
            return value ? 0 : paramValue;
        });

    public static readonly IValueConverter NullOrString =
        new FuncValueConverter<bool, string?, string?>((value, param) => value ? null : param);

    public static readonly IValueConverter Opaque =
        new FuncValueConverter<bool, int>(value => value ? 1 : 0);

    public static readonly IValueConverter SidebarPadding =
        new FuncValueConverter<bool, Thickness>(value => value ? new Thickness(16, 8) : new Thickness(8));

    public static readonly IValueConverter SidebarTogglerHorizontalAlignment =
        new FuncValueConverter<bool, HorizontalAlignment>(value =>
            value ? HorizontalAlignment.Right : HorizontalAlignment.Center);
}