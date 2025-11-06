using Avalonia.Data.Converters;
using Avalonia.Media;
using Avalonia.Media.Immutable;

namespace ShadUI.Demo.Converters;

public static class BrushConverters
{
    public static readonly IValueConverter ToHex =
        new FuncValueConverter<IBrush, string?>(b =>
        {
            if (b is ImmutableSolidColorBrush solidColorBrush)
            {
                var color = solidColorBrush.Color;
                return $"#{color.A:X2}{color.R:X2}{color.G:X2}{color.B:X2}";
            }

            return null;
        });
}