using System;
using System.Collections;
using System.Collections.Specialized;
using System.Linq;
using Avalonia.Controls;
using Avalonia.Interactivity;

namespace pMusic.Views;

public partial class PlaylistView : UserControl
{
    public PlaylistView()
    {
        InitializeComponent();
        this.Loaded += OnLoaded;
        this.DataContextChanged += OnDataContextChanged;
        Tracklist.LoadingRow += Tracklist_LoadingRow;
    }

    private void OnDataContextChanged(object sender, EventArgs e)
    {
        if (Tracklist.ItemsSource is INotifyCollectionChanged newCollection)
        {
            newCollection.CollectionChanged += (s, args) => UpdateDataGridHeight();
            UpdateDataGridHeight(); // Initial call
        }
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (Tracklist.ItemsSource is INotifyCollectionChanged collection)
        {
            collection.CollectionChanged += (s, args) => UpdateDataGridHeight();
            UpdateDataGridHeight(); // Initial call
        }
    }

    void UpdateDataGridHeight()
    {
        if (Tracklist.ItemsSource is IEnumerable items)
        {
            int itemCount = items.Cast<object>().Count();
            double rowHeight = Tracklist.RowHeight;
            double headerHeight = Tracklist.ColumnHeaderHeight;

            var half = (itemCount * 0.23) * 30;
            // Add some padding to account for borders and internal spacing
            double padding = 4; // Adjust this value as needed
            double totalHeight = (rowHeight * itemCount) + headerHeight + padding + half;

            Tracklist.Height = totalHeight;
            Tracklist.MaxHeight = totalHeight;
            Tracklist.MinHeight = totalHeight;
        }
    }

    private void Tracklist_LoadingRow(object? sender, DataGridRowEventArgs e)
    {
        e.Row.Header = (e.Row.GetIndex() + 1).ToString();
    }

    // private void Tracklist_OnPointerWheelChanged(object? sender, PointerWheelEventArgs e)
    // {
    //     e.Handled = true;
    // }
}