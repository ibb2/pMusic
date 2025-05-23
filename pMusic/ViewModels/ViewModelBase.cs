using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using pMusic.Database;
using pMusic.Interface;
using pMusic.Models;

namespace pMusic.ViewModels;

public abstract partial class ViewModelBase : ObservableObject
{
    private MusicDbContext _musicDbContext;

    protected ViewModelBase(MusicDbContext musicDbContext)
    {
        _musicDbContext = musicDbContext;
    }

    protected ViewModelBase()
    {
    }

    // Access to navigation
    protected Navigation Navigation => Navigation.Instance;

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
    public void GoToPlaylist(Playlist playlist)
    {
        Navigation.GoToView<PlaylistViewModel>(vm => vm.Playlist = playlist);
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