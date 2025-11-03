using System;
using Avalonia.Data.Converters;

// ReSharper disable once CheckNamespace
namespace ShadUI;

/// <summary>
///     Provides value converters for string operations and comparisons.
/// </summary>
/// <remarks>
///     This class contains static converters that can be used for string comparison and validation
///     operations in XAML bindings.
/// </remarks>
public static class StringConverters
{
    /// <summary>
    ///     Converts a string value to a boolean indicating whether it matches a parameter string.
    /// </summary>
    /// <remarks>
    ///     This converter performs a case-insensitive comparison between the bound string value
    ///     and the converter parameter. Returns true if the strings match, false otherwise.
    ///     
    ///     The comparison is case-insensitive and uses ordinal comparison.
    ///     
    ///     Parameters:
    ///     - value: The string value to compare (from binding)
    ///     - param: The string parameter to compare against (from ConverterParameter)
    /// </remarks>
    public static readonly IValueConverter IsMatch =
        new FuncValueConverter<string, string, bool>((value, param) =>
        {
            if (string.IsNullOrEmpty(value) || string.IsNullOrEmpty(param))
            {
                return false;
            }

            return value.Equals(param, StringComparison.OrdinalIgnoreCase);
        });
}