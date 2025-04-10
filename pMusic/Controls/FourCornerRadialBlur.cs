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
        // Create a lighter center color (average of all corners and lighten)
        var centerColor = AverageColor(new[] { topLeft, topRight, bottomLeft, bottomRight });
        centerColor = LightenColor(centerColor, 0.2); // Lighten the center

        // Darken corner colors
        topLeft = DarkenColor(topLeft, 0.3);
        topRight = DarkenColor(topRight, 0.3);
        bottomLeft = DarkenColor(bottomLeft, 0.3);
        bottomRight = DarkenColor(bottomRight, 0.3);

        // Start with base background color - the lightened center color
        context.FillRectangle(new SolidColorBrush(centerColor), bounds);

        // Use linear gradients instead of radial for a more dramatic effect

        // Top edge gradient (top-left to top-right)
        var topGradient = new LinearGradientBrush
        {
            StartPoint = new RelativePoint(0, 0, RelativeUnit.Relative),
            EndPoint = new RelativePoint(1, 0, RelativeUnit.Relative),
            GradientStops = new GradientStops
            {
                new GradientStop(topLeft, 0),
                new GradientStop(centerColor, 0.5),
                new GradientStop(topRight, 1)
            }
        };

        // Left edge gradient (top-left to bottom-left)
        var leftGradient = new LinearGradientBrush
        {
            StartPoint = new RelativePoint(0, 0, RelativeUnit.Relative),
            EndPoint = new RelativePoint(0, 1, RelativeUnit.Relative),
            GradientStops = new GradientStops
            {
                new GradientStop(topLeft, 0),
                new GradientStop(centerColor, 0.5),
                new GradientStop(bottomLeft, 1)
            }
        };

        // Right edge gradient (top-right to bottom-right)
        var rightGradient = new LinearGradientBrush
        {
            StartPoint = new RelativePoint(1, 0, RelativeUnit.Relative),
            EndPoint = new RelativePoint(1, 1, RelativeUnit.Relative),
            GradientStops = new GradientStops
            {
                new GradientStop(topRight, 0),
                new GradientStop(centerColor, 0.5),
                new GradientStop(bottomRight, 1)
            }
        };

        // Bottom edge gradient (bottom-left to bottom-right)
        var bottomGradient = new LinearGradientBrush
        {
            StartPoint = new RelativePoint(0, 1, RelativeUnit.Relative),
            EndPoint = new RelativePoint(1, 1, RelativeUnit.Relative),
            GradientStops = new GradientStops
            {
                new GradientStop(bottomLeft, 0),
                new GradientStop(centerColor, 0.5),
                new GradientStop(bottomRight, 1)
            }
        };

        // Create a gradient from each corner to center
        var topLeftGradient = new LinearGradientBrush
        {
            StartPoint = new RelativePoint(0, 0, RelativeUnit.Relative),
            EndPoint = new RelativePoint(0.5, 0.5, RelativeUnit.Relative),
            GradientStops = new GradientStops
            {
                new GradientStop(topLeft, 0),
                new GradientStop(Color.FromArgb(0, centerColor.R, centerColor.G, centerColor.B), 1)
            }
        };

        var topRightGradient = new LinearGradientBrush
        {
            StartPoint = new RelativePoint(1, 0, RelativeUnit.Relative),
            EndPoint = new RelativePoint(0.5, 0.5, RelativeUnit.Relative),
            GradientStops = new GradientStops
            {
                new GradientStop(topRight, 0),
                new GradientStop(Color.FromArgb(0, centerColor.R, centerColor.G, centerColor.B), 1)
            }
        };

        var bottomLeftGradient = new LinearGradientBrush
        {
            StartPoint = new RelativePoint(0, 1, RelativeUnit.Relative),
            EndPoint = new RelativePoint(0.5, 0.5, RelativeUnit.Relative),
            GradientStops = new GradientStops
            {
                new GradientStop(bottomLeft, 0),
                new GradientStop(Color.FromArgb(0, centerColor.R, centerColor.G, centerColor.B), 1)
            }
        };

        var bottomRightGradient = new LinearGradientBrush
        {
            StartPoint = new RelativePoint(1, 1, RelativeUnit.Relative),
            EndPoint = new RelativePoint(0.5, 0.5, RelativeUnit.Relative),
            GradientStops = new GradientStops
            {
                new GradientStop(bottomRight, 0),
                new GradientStop(Color.FromArgb(0, centerColor.R, centerColor.G, centerColor.B), 1)
            }
        };

        // Draw all the edge gradients
        using (context.PushOpacity(0.4))
        {
            context.FillRectangle(topGradient, bounds);
            context.FillRectangle(leftGradient, bounds);
            context.FillRectangle(rightGradient, bounds);
            context.FillRectangle(bottomGradient, bounds);
        }

        // Draw the corner gradients
        using (context.PushOpacity(0.6))
        {
            context.FillRectangle(topLeftGradient, bounds);
            context.FillRectangle(topRightGradient, bounds);
            context.FillRectangle(bottomLeftGradient, bounds);
            context.FillRectangle(bottomRightGradient, bounds);
        }
    }

// Helper method to darken a color
    private Color DarkenColor(Color color, double factor)
    {
        return Color.FromArgb(
            color.A,
            (byte)Math.Max(0, color.R * (1 - factor)),
            (byte)Math.Max(0, color.G * (1 - factor)),
            (byte)Math.Max(0, color.B * (1 - factor))
        );
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