using System;
using System.Linq;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Templates;
using Avalonia.Input;
using Avalonia.Interactivity;
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

    protected override void OnLoaded(RoutedEventArgs e)
    {
        base.OnLoaded(e);

        _ = (DataContext as MainViewModel)!.LoadSidebar();
    }


    private void GoTo(object? sender, PointerPressedEventArgs e)
    {
        if (sender is not SukiSideMenuItem sukiSideMenuItem)
            return;

        if (DataContext is not MainViewModel viewModel) return;


        switch (sukiSideMenuItem.DataContext)
        {
            case DisplayAlbumViewModel displayAlbumViewModel:
                if (displayAlbumViewModel.Album is null) return;

                viewModel.GoToAlbumPageCommand.Execute(displayAlbumViewModel.Album);
                return;
            case DisplayPlaylistViewModel displayPlaylistViewModel:
                if (displayPlaylistViewModel.Playlist is null) return;

                viewModel.GoToPlaylistPageCommand.Execute(displayPlaylistViewModel.playlist);
                return;
        }
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