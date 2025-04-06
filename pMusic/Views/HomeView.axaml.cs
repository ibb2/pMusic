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
        DataContext = Ioc.Default.GetRequiredService<HomeViewModel>();
    }

    // // Parameterless constructor needed for XAML instantiation.
    // public HomeView()
    // {
    // }

    public void GoToAlbum(object? sender, PointerPressedEventArgs pointerPressedEvent)
    {
        Console.WriteLine("Pressed event");
        var album = ((StackPanel)sender).DataContext as Album;
        Console.WriteLine($"Go to album: {album.Title}");

        if (pointerPressedEvent.GetCurrentPoint(this).Properties.IsLeftButtonPressed)
        {
            var vm = (HomeViewModel)DataContext;
            vm.GoToAlbum(album);
        }

        pointerPressedEvent.Handled = true;
    }
}