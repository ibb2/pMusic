namespace pMusic.Controls;

using Avalonia;
using Avalonia.Controls;
using Avalonia.Media;
using System;

public class FourCornerGradientBlur : Control
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
        // Set up the properties changed handler to redraw when colors change
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
            // Convert hex strings to Color objects
            var topLeft = Color.Parse(TopLeftColor);
            var topRight = Color.Parse(TopRightColor);
            var bottomLeft = Color.Parse(BottomLeftColor);
            var bottomRight = Color.Parse(BottomRightColor);

            // First gradient (top-left to bottom-right)
            var diagonal1 = new LinearGradientBrush
            {
                StartPoint = new RelativePoint(0, 0, RelativeUnit.Relative),
                EndPoint = new RelativePoint(1, 1, RelativeUnit.Relative),
                GradientStops = new GradientStops
                {
                    new GradientStop(topLeft, 0),
                    new GradientStop(bottomRight, 1)
                }
            };

            // Second gradient (top-right to bottom-left)
            var diagonal2 = new LinearGradientBrush
            {
                StartPoint = new RelativePoint(1, 0, RelativeUnit.Relative),
                EndPoint = new RelativePoint(0, 1, RelativeUnit.Relative),
                GradientStops = new GradientStops
                {
                    new GradientStop(topRight, 0),
                    new GradientStop(bottomLeft, 1)
                }
            };

            // Draw the first gradient
            context.FillRectangle(diagonal1, bounds);

            // Draw the second gradient with opacity for blending
            using (context.PushOpacity(0.5))
            {
                context.FillRectangle(diagonal2, bounds);
            }
        }
        catch (Exception ex)
        {
            // Fallback to a solid color if there's a problem with the colors
            context.FillRectangle(Brushes.Gray, bounds);
        }
    }
}