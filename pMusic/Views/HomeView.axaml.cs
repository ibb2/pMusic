using System;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using pMusic.ViewModels;

namespace pMusic.Views;

public partial class HomeView : UserControl
{
    public HomeView()
    {
        InitializeComponent();
    }

    protected override void OnLoaded(RoutedEventArgs e)
    {
        var vm = (HomeViewModel)DataContext!;
        var isLoaded = vm.IsLoaded;
        Console.WriteLine($"Is loaded: {isLoaded}");
        if (!isLoaded) _ = vm.LoadContent(isLoaded);
    }

    public void GoToAlbum(object? sender, PointerPressedEventArgs pointerPressedEvent)
    {
        Console.WriteLine("Pressed event");
        var album = ((StackPanel)sender).DataContext as DisplayAlbumViewModel;
        Console.WriteLine($"Go to album: {album.Title}");

        if (pointerPressedEvent.GetCurrentPoint(this).Properties.IsLeftButtonPressed)
        {
            var vm = (HomeViewModel)DataContext;
            vm.GoToAlbum(album.Album);
        }

        pointerPressedEvent.Handled = true;
    }
}