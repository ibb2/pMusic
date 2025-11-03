using Avalonia.Data.Converters;

// ReSharper disable once CheckNamespace
namespace ShadUI;

/// <summary>
///     Provides value converters for converting DialogButtonStyle enum values to CSS class names.
/// </summary>
/// <remarks>
///     This class contains static converters that can be used to convert DialogButtonStyle enum values
///     to their corresponding CSS class names for styling purposes.
/// </remarks>
public static class DialogButtonStyleConverters
{
    /// <summary>
    ///     Converts a DialogButtonStyle enum value to its corresponding CSS class name.
    /// </summary>
    /// <remarks>
    ///     This converter maps DialogButtonStyle enum values to their corresponding CSS class names:
    ///     - Primary → "Primary"
    ///     - Secondary → "Secondary"
    ///     - Outline → "Outline"
    ///     - Ghost → "Ghost"
    ///     - Destructive → "Destructive"
    /// </remarks>
    public static readonly IValueConverter ToClass =
        new FuncValueConverter<DialogButtonStyle, string>(value => value switch
        {
            DialogButtonStyle.Primary => "Primary",
            DialogButtonStyle.Secondary => "Secondary",
            DialogButtonStyle.Outline => "Outline",
            DialogButtonStyle.Ghost => "Ghost",
            DialogButtonStyle.Destructive => "Destructive",
            _ => ""
        });
}