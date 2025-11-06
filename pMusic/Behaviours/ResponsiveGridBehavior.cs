using System;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Threading;

namespace pMusic.Behaviours;

public class ResponsiveGridBehavior
{
    public static readonly AttachedProperty<bool> IsEnabledProperty =
        AvaloniaProperty.RegisterAttached<ResponsiveGridBehavior, Grid, bool>("IsEnabled");

    private static DispatcherTimer? _debounceTimer;
    private static Grid? _pendingGrid;
    private static int _lastColumnCount = -1;

    static ResponsiveGridBehavior()
    {
        IsEnabledProperty.Changed.AddClassHandler<Grid>(OnIsEnabledChanged);
    }

    public static bool GetIsEnabled(Grid element) => element.GetValue(IsEnabledProperty);
    public static void SetIsEnabled(Grid element, bool value) => element.SetValue(IsEnabledProperty, value);

    private static void OnIsEnabledChanged(Grid grid, AvaloniaPropertyChangedEventArgs e)
    {
        if (e.NewValue is true)
        {
            grid.SizeChanged += (_, args) =>
            {
                if (args.WidthChanged)
                    DebouncedUpdate(grid);
            };

            grid.Loaded += (_, __) =>
            {
                Dispatcher.UIThread.Post(() => UpdateColumns(grid), DispatcherPriority.Loaded);
            };

            grid.Children.CollectionChanged += (_, __) =>
            {
                Dispatcher.UIThread.Post(() => UpdateColumns(grid), DispatcherPriority.Loaded);
            };
        }
    }

    private static void DebouncedUpdate(Grid grid)
    {
        _pendingGrid = grid;

        if (_debounceTimer == null)
        {
            _debounceTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromMilliseconds(16) // ~1 frame at 60fps
            };
            _debounceTimer.Tick += (s, e) =>
            {
                _debounceTimer?.Stop();
                if (_pendingGrid != null)
                {
                    UpdateColumns(_pendingGrid);
                    _pendingGrid = null;
                }
            };
        }

        _debounceTimer.Stop();
        _debounceTimer.Start();
    }

    private static void UpdateColumns(Grid grid)
    {
        var width = grid.Bounds.Width;
        if (width <= 0) return;

        int columnCount = width switch
        {
            >= 900 => 4,
            >= 650 => 3,
            >= 400 => 2,
            _ => 1
        };

        var itemCount = grid.Children.Count;
        if (itemCount == 0) return;

        // Only update if column count actually changed
        if (_lastColumnCount == columnCount && grid.ColumnDefinitions.Count == columnCount)
            return;

        _lastColumnCount = columnCount;

        // Clear and rebuild columns
        grid.ColumnDefinitions.Clear();
        for (int i = 0; i < columnCount; i++)
            grid.ColumnDefinitions.Add(new ColumnDefinition(new GridLength(1, GridUnitType.Star)));

        // Clear and rebuild rows
        var rowCount = (int)Math.Ceiling((double)itemCount / columnCount);
        grid.RowDefinitions.Clear();
        for (int i = 0; i < rowCount; i++)
            grid.RowDefinitions.Add(new RowDefinition(GridLength.Auto));

        // Reposition all children
        for (int i = 0; i < itemCount; i++)
        {
            var child = grid.Children[i];
            Grid.SetColumn(child, i % columnCount);
            Grid.SetRow(child, i / columnCount);
        }
    }
}