using System;
using System.Threading.Tasks;
using Avalonia.Controls;
using Avalonia.Input;
using CommunityToolkit.Mvvm.ComponentModel;
using KeySharp;
using pMusic.ViewModels;
using SukiUI.Controls;

namespace pMusic.Views;

public partial class MainWindow : SukiWindow
{
    public MainWindow()
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
}