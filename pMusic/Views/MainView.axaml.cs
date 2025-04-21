using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Web;
using System.Xml.Linq;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Controls.Templates;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.VisualTree;
using KeySharp;
using pMusic.Models;
using pMusic.ViewModels;
using SukiUI.Controls;
using Track = Avalonia.Controls.Primitives.Track;

namespace pMusic.Views;

public partial class MainView : UserControl
{
    public MainView()
    {
        InitializeComponent();
    }

    private void GoToAlbum(object? sender, PointerPressedEventArgs e)
    {
        if (sender is not SukiSideMenuItem sukiSideMenuItem)
            return;

        if (sukiSideMenuItem.DataContext is not DisplayAlbumViewModel displayAlbumViewModel)
            return;

        if (displayAlbumViewModel.Album is null)
            return;

        if (DataContext is not MainViewModel viewModel)
            return;

        viewModel.GoToAlbumDetialsPage(displayAlbumViewModel.Album);
    }

    private void Thumb_OnDragCompleted(object? sender, VectorEventArgs e)
    {
        if (sender is not Slider slider) return;

        if (slider.DataContext is not MainViewModel mainViewModel)
            return;


        var newValue = slider.Value;
        mainViewModel.Seek(newValue);
    }


    private void Slider_AttachedToVisualTree(object? sender, VisualTreeAttachmentEventArgs e)
    {
        if (MySlider.GetTemplateChildren()
                .OfType<Track>()
                .FirstOrDefault() is Track track)
            track.PointerPressed += Track_PointerPressed;
    }

    private void Track_PointerPressed(object? sender, PointerPressedEventArgs e)
    {
        if (sender is not Track track)
            return;

        var position = e.GetPosition(track);
        var slider = MySlider;

        // Horizontal only; adapt for vertical if needed
        var percent = position.X / track.Bounds.Width;
        var newValue = slider.Minimum + (slider.Maximum - slider.Minimum) * percent;

        slider.Value = newValue;

        // Your callback here
        OnTrackClicked(newValue);
    }

    private void OnTrackClicked(double value)
    {
        Console.WriteLine($"Track clicked. New slider value: {value}");
    }
}