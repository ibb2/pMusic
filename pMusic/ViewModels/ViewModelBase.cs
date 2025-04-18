using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.DependencyInjection;
using CommunityToolkit.Mvvm.Input;
using pMusic.Database;
using pMusic.Interface;
using pMusic.Models;
using pMusic.Views;

namespace pMusic.ViewModels;

public abstract partial class ViewModelBase : ObservableObject
{
    private MusicDbContext _musicDbContext;

    // Access to navigation
    protected Navigation Navigation => Navigation.Instance;

    protected ViewModelBase(MusicDbContext musicDbContext)
    {
        _musicDbContext = musicDbContext;
    }

    protected ViewModelBase()
    {
    }

    [RelayCommand]
    public void GoToAlbum(Album album)
    {
        Navigation.GoToView<AlbumViewModel>(vm =>
        {
            vm.Album = album;
            _ = vm.GetTracks();
            _ = vm.LoadAlbumThumbnail();
        });
    }

    [RelayCommand]
    public void GoToArtist()
    {
        Navigation.GoToView<ArtistViewModel>(vm => vm.Title = "Updated Artist Title");
    }

    [RelayCommand]
    public void GoToTrack()
    {
        Navigation.GoToView<TrackViewModel>(vm => vm.Title = "Updated Track Title");
    }

    public void GoBack()
    {
        Navigation.GoBack();
    }

    public void GoForward()
    {
        Navigation.GoForward();
    }

    public void GoHome()
    {
        Navigation.GoHome();
    }

    public void GoToMainWindow()
    {
        Navigation.GoToPage<MainViewModel>(null);
    }

    public void GoToLoginWindow()
    {
        Navigation.GoToPage<LoginViewModel>(null);
    }
}