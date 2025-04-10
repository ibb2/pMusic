using Avalonia;
using Avalonia.Controls;
using Avalonia.Media;
using Avalonia.Styling;
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
            if (e.Property == BackgroundProperty)
            {
                InvalidateVisual();
            }
        };
    }

    protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
    {
        base.OnPropertyChanged(change);

        if (change.Property == TopLeftColorProperty ||
            change.Property == TopRightColorProperty ||
            change.Property == BottomLeftColorProperty ||
            change.Property == BottomRightColorProperty ||
            change.Property == BackgroundProperty)
        {
            InvalidateVisual();
        }
    }

    public override void Render(DrawingContext context)
    {
        base.Render(context);
        var bounds = new Rect(0, 0, Bounds.Width, Bounds.Height);

        try
        {
            var topLeft = Color.Parse($"#{TopLeftColor}");
            var topRight = Color.Parse($"#{TopRightColor}");
            var bottomLeft = Color.Parse($"#{BottomLeftColor}");
            var bottomRight = Color.Parse($"#{BottomRightColor}");

            bool isLightMode = IsLightTheme();

            // For a softer look with proper alpha handling
            if (isLightMode)
            {
                // Light mode - very subtle effect (25% opacity)
                DrawSoftGradient(context, bounds,
                    SetColorAlpha(topLeft, 0x40),
                    SetColorAlpha(topRight, 0x40),
                    SetColorAlpha(bottomLeft, 0x40),
                    SetColorAlpha(bottomRight, 0x40),
                    centerAlpha: 0x26); // ~15% opacity
                // For an ultra-light look:
                // DrawSoftGradient(context, bounds, 
                //     SetColorAlpha(topLeft, 0x20),  // ~12% opacity
                //     SetColorAlpha(topRight, 0x20),
                //     SetColorAlpha(bottomLeft, 0x20),
                //     SetColorAlpha(bottomRight, 0x20),
                //     centerAlpha: 0x10);  // ~6% opacity
            }
            else
            {
                // Dark mode - slightly more visible but still subtle (40% opacity)
                DrawSoftGradient(context, bounds,
                    SetColorAlpha(topLeft, 0x60),
                    SetColorAlpha(topRight, 0x60),
                    SetColorAlpha(bottomLeft, 0x60),
                    SetColorAlpha(bottomRight, 0x60),
                    centerAlpha: 0x40); // ~25% opacity
            }
        }
        catch (Exception)
        {
            context.FillRectangle(Brushes.Transparent, bounds);
        }
    }

    private Color SetColorAlpha(Color color, byte alpha)
    {
        return Color.FromArgb(alpha, color.R, color.G, color.B);
    }

    private void DrawSoftGradient(DrawingContext context, Rect bounds,
        Color topLeft, Color topRight,
        Color bottomLeft, Color bottomRight,
        byte centerAlpha)
    {
        // Create center color with adjusted alpha
        var centerColor = AverageColor(new[] { topLeft, topRight, bottomLeft, bottomRight });
        centerColor = SetColorAlpha(centerColor, centerAlpha);

        // Fill with the center color first
        context.FillRectangle(new SolidColorBrush(centerColor), bounds);

        // Create very subtle corner gradients
        var gradients = new[]
        {
            CreateCornerGradient(topLeft, centerColor, new RelativePoint(0, 0, RelativeUnit.Relative)),
            CreateCornerGradient(topRight, centerColor, new RelativePoint(1, 0, RelativeUnit.Relative)),
            CreateCornerGradient(bottomLeft, centerColor, new RelativePoint(0, 1, RelativeUnit.Relative)),
            CreateCornerGradient(bottomRight, centerColor, new RelativePoint(1, 1, RelativeUnit.Relative))
        };

        // Apply with very low opacity
        foreach (var gradient in gradients)
        {
            using (context.PushOpacity(0.3)) // Even more transparent
            {
                context.FillRectangle(gradient, bounds);
            }
        }
    }

    private LinearGradientBrush CreateCornerGradient(Color cornerColor, Color centerColor, RelativePoint startPoint)
    {
        return new LinearGradientBrush
        {
            StartPoint = startPoint,
            EndPoint = new RelativePoint(0.5, 0.5, RelativeUnit.Relative),
            GradientStops = new GradientStops
            {
                new GradientStop(cornerColor, 0),
                new GradientStop(Color.FromArgb(0, centerColor.R, centerColor.G, centerColor.B), 1)
            }
        };
    }


    private bool IsLightTheme()
    {
        // Check if background is light
        if (Background is ISolidColorBrush brush)
        {
            // Calculate relative luminance (perceived brightness)
            double luminance = (0.299 * brush.Color.R + 0.587 * brush.Color.G + 0.114 * brush.Color.B) / 255;
            return luminance > 0.5;
        }

        return false; // default to dark mode if we can't determine
    }

    private void DrawCornerGradient(DrawingContext context, Rect bounds,
        Color topLeft, Color topRight,
        Color bottomLeft, Color bottomRight, bool isLightMode)
    {
        // Create a center color (average of all corners)
        var centerColor = AverageColor(new[] { topLeft, topRight, bottomLeft, bottomRight });

        // Adjust colors based on theme
        if (isLightMode)
        {
            // For light mode, make the effect more subtle
            centerColor = LightenColor(centerColor, 0.4); // Lighten the center more
            topLeft = LightenColor(topLeft, 0.3);
            topRight = LightenColor(topRight, 0.3);
            bottomLeft = LightenColor(bottomLeft, 0.3);
            bottomRight = LightenColor(bottomRight, 0.3);
        }
        else
        {
            // For dark mode, keep the original darker effect
            centerColor = LightenColor(centerColor, 0.2);
            topLeft = DarkenColor(topLeft, 0.3);
            topRight = DarkenColor(topRight, 0.3);
            bottomLeft = DarkenColor(bottomLeft, 0.3);
            bottomRight = DarkenColor(bottomRight, 0.3);
        }

        // Start with base background color - the center color
        context.FillRectangle(new SolidColorBrush(centerColor), bounds);

        // Create gradients from each corner to center
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

        // Adjust opacity based on theme
        double cornerOpacity = isLightMode ? 0.3 : 0.6;
        double edgeOpacity = isLightMode ? 0.2 : 0.4;

        // Draw the corner gradients
        using (context.PushOpacity(cornerOpacity))
        {
            context.FillRectangle(topLeftGradient, bounds);
            context.FillRectangle(topRightGradient, bounds);
            context.FillRectangle(bottomLeftGradient, bounds);
            context.FillRectangle(bottomRightGradient, bounds);
        }

        // For light mode, we might want to simplify the effect
        if (!isLightMode)
        {
            // Original edge gradients for dark mode
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

            // Draw all the edge gradients
            using (context.PushOpacity(edgeOpacity))
            {
                context.FillRectangle(topGradient, bounds);
                context.FillRectangle(leftGradient, bounds);
                context.FillRectangle(rightGradient, bounds);
                context.FillRectangle(bottomGradient, bounds);
            }
        }
    }

    // Helper methods (DarkenColor, LightenColor, AverageColor remain the same)
    private Color DarkenColor(Color color, double factor)
    {
        return Color.FromArgb(
            color.A,
            (byte)Math.Max(0, color.R * (1 - factor)),
            (byte)Math.Max(0, color.G * (1 - factor)),
            (byte)Math.Max(0, color.B * (1 - factor))
        );
    }

    private Color LightenColor(Color color, double factor)
    {
        return Color.FromArgb(
            color.A,
            (byte)Math.Min(255, color.R + (255 - color.R) * factor),
            (byte)Math.Min(255, color.G + (255 - color.G) * factor),
            (byte)Math.Min(255, color.B + (255 - color.B) * factor)
        );
    }

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