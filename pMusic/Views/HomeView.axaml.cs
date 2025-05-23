using System;
using Avalonia.Controls;
using Avalonia.Input;
using CommunityToolkit.Mvvm.DependencyInjection;
using pMusic.Models;
using pMusic.ViewModels;

namespace pMusic.Views;

public partial class HomeView : UserControl
{
    public HomeView()
    {
        InitializeComponent();
        var dc = Ioc.Default.GetRequiredService<HomeViewModel>();
        DataContext = dc;

        this.Loaded += async (_, _) =>
        {
            var vm = (HomeViewModel)DataContext;
            var isLoaded = vm.IsLoaded;
            Console.WriteLine($"Is loaded: {isLoaded}");
            await dc.LoadContent(isLoaded);
        };
        // this.DataContextChanged += async (_, _) =>
        // {
        //     if (DataContext is HomeViewModel vm)
        //         await vm.LoadHomepageAlbumsAsync();
        // };
    }

    // // Parameterless constructor needed for XAML instantiation.
    // public HomeView()
    // {
    // }

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