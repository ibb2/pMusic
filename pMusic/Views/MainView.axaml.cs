using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Web;
using System.Xml.Linq;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.VisualTree;
using KeySharp;
using pMusic.Models;
using pMusic.ViewModels;
using SukiUI.Controls;

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
}