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
            _ = vm.LoadAlbumThumbnail();
            _ = vm.GetTracks();
        });
    }

    [RelayCommand]
    public void GoToPlaylist(Playlist playlist)
    {
        Navigation.GoToView<PlaylistViewModel>(vm =>
        {
            vm.Playlist = playlist;
            _ = vm.GetTracks();
            _ = vm.LoadPlaylistComposite();
            // _ = vm.LoadPlaylistThumbnail();
        });
    }

    [RelayCommand]
    public void GoToArtist(Artist artist)
    {
        Navigation.GoToView<ArtistViewModel>(vm =>
        {
            vm.Artist = artist;
            _ = vm.LoadArtistCover();
            _ = vm.LoadArtistAlbums();
            vm.Title = "Updated Artist Title";
        });
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