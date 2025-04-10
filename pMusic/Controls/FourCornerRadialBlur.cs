using Avalonia;
using Avalonia.Controls;
using Avalonia.Media;
using System;

namespace pMusic.Controls;

public class FourCornerGradientBlur : ContentControl
{
    public static readonly StyledProperty<string> TopLeftColorProperty =
        AvaloniaProperty.Register<FourCornerGradientBlur, string>(nameof(TopLeftColor));

    public static readonly StyledProperty<string> TopRightColorProperty =
        AvaloniaProperty.Register<FourCornerGradientBlur, string>(nameof(TopRightColor));

    public static readonly StyledProperty<string> BottomLeftColorProperty =
        AvaloniaProperty.Register<FourCornerGradientBlur, string>(nameof(BottomLeftColor));

    public static readonly StyledProperty<string> BottomRightColorProperty =
        AvaloniaProperty.Register<FourCornerGradientBlur, string>(nameof(BottomRightColor));

    public string TopLeftColor
    {
        get => GetValue(TopLeftColorProperty);
        set => SetValue(TopLeftColorProperty, value);
    }

    public string TopRightColor
    {
        get => GetValue(TopRightColorProperty);
        set => SetValue(TopRightColorProperty, value);
    }

    public string BottomLeftColor
    {
        get => GetValue(BottomLeftColorProperty);
        set => SetValue(BottomLeftColorProperty, value);
    }

    public string BottomRightColor
    {
        get => GetValue(BottomRightColorProperty);
        set => SetValue(BottomRightColorProperty, value);
    }

    public FourCornerGradientBlur()
    {
        PropertyChanged += (sender, e) =>
        {
            if (e.Property == TopLeftColorProperty ||
                e.Property == TopRightColorProperty ||
                e.Property == BottomLeftColorProperty ||
                e.Property == BottomRightColorProperty)
            {
                InvalidateVisual();
            }
        };
    }

    public override void Render(DrawingContext context)
    {
        base.Render(context);
        var bounds = new Rect(0, 0, Bounds.Width, Bounds.Height);

        try
        {
            // Parse the color values
            var topLeft = Color.Parse($"#{TopLeftColor}");
            var topRight = Color.Parse($"#{TopRightColor}");
            var bottomLeft = Color.Parse($"#{BottomLeftColor}");
            var bottomRight = Color.Parse($"#{BottomRightColor}");

            // Create a ConicGradientBrush for each corner
            DrawCornerGradient(context, bounds, topLeft, topRight, bottomLeft, bottomRight);
        }
        catch (Exception)
        {
            // Fallback to a solid color if there's a problem
            context.FillRectangle(Brushes.Gray, bounds);
        }
    }

    private void DrawCornerGradient(DrawingContext context, Rect bounds,
        Color topLeft, Color topRight,
        Color bottomLeft, Color bottomRight)
    {
        // Lighten the colors for more contrast
        topLeft = LightenColor(topLeft, 0.3);
        topRight = LightenColor(topRight, 0.3);
        bottomLeft = LightenColor(bottomLeft, 0.3);
        bottomRight = LightenColor(bottomRight, 0.3);

        // Reduce the radius to make the gradient more aggressive
        double radius = 0.4; // Smaller radius creates a more pronounced effect

        // Top-left corner gradient
        var topLeftBrush = new RadialGradientBrush
        {
            Center = new RelativePoint(0, 0, RelativeUnit.Relative),
            GradientOrigin = new RelativePoint(0, 0, RelativeUnit.Relative),
            Radius = radius,
            GradientStops = new GradientStops
            {
                new GradientStop(topLeft, 0),
                new GradientStop(Color.FromArgb(0, topLeft.R, topLeft.G, topLeft.B), 0.5)
            }
        };

        // Top-right corner gradient
        var topRightBrush = new RadialGradientBrush
        {
            Center = new RelativePoint(1, 0, RelativeUnit.Relative),
            GradientOrigin = new RelativePoint(1, 0, RelativeUnit.Relative),
            Radius = radius,
            GradientStops = new GradientStops
            {
                new GradientStop(topRight, 0),
                new GradientStop(Color.FromArgb(0, topRight.R, topRight.G, topRight.B), 0.5)
            }
        };

        // Bottom-left corner gradient
        var bottomLeftBrush = new RadialGradientBrush
        {
            Center = new RelativePoint(0, 1, RelativeUnit.Relative),
            GradientOrigin = new RelativePoint(0, 1, RelativeUnit.Relative),
            Radius = radius,
            GradientStops = new GradientStops
            {
                new GradientStop(bottomLeft, 0),
                new GradientStop(Color.FromArgb(0, bottomLeft.R, bottomLeft.G, bottomLeft.B), 0.5)
            }
        };

        // Bottom-right corner gradient
        var bottomRightBrush = new RadialGradientBrush
        {
            Center = new RelativePoint(1, 1, RelativeUnit.Relative),
            GradientOrigin = new RelativePoint(1, 1, RelativeUnit.Relative),
            Radius = radius,
            GradientStops = new GradientStops
            {
                new GradientStop(bottomRight, 0),
                new GradientStop(Color.FromArgb(0, bottomRight.R, bottomRight.G, bottomRight.B), 0.5)
            }
        };

        // Draw a base color first (average of all colors)
        var baseColor = AverageColor(new[] { topLeft, topRight, bottomLeft, bottomRight });
        context.FillRectangle(new SolidColorBrush(baseColor), bounds);

        // Draw all four gradients with increased opacity
        using (context.PushOpacity(0.85))
        {
            context.FillRectangle(topLeftBrush, bounds);
            context.FillRectangle(topRightBrush, bounds);
            context.FillRectangle(bottomLeftBrush, bounds);
            context.FillRectangle(bottomRightBrush, bounds);
        }
    }

// Helper method to lighten a color
    private Color LightenColor(Color color, double factor)
    {
        return Color.FromArgb(
            color.A,
            (byte)Math.Min(255, color.R + (255 - color.R) * factor),
            (byte)Math.Min(255, color.G + (255 - color.G) * factor),
            (byte)Math.Min(255, color.B + (255 - color.B) * factor)
        );
    }

// Helper method to get the average of multiple colors
    private Color AverageColor(Color[] colors)
    {
        int r = 0, g = 0, b = 0, a = 0;
        foreach (var color in colors)
        {
            r += color.R;
            g += color.G;
            b += color.B;
            a += color.A;
        }

        return Color.FromArgb(
            (byte)(a / colors.Length),
            (byte)(r / colors.Length),
            (byte)(g / colors.Length),
            (byte)(b / colors.Length)
        );
    }
}