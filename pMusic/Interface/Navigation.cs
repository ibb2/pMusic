using CommunityToolkit.Mvvm.ComponentModel;
using pMusic.ViewModels;

namespace pMusic.Interface;

public interface INavigation
{
    public void GoToAlbum();
    public void GoToArtist();
    public void GoToTrack();
}

public partial class Navigation : ObservableObject
{
    // Singleton instance
    public static Navigation Instance { get; } = new();

    private readonly HomeViewModel _homeView = new();
    private readonly ArtistViewModel _artistView = new();
    private readonly AlbumViewModel _albumView = new();
    private readonly TrackViewModel _trackView = new();
    
    [ObservableProperty]
    private object? _currentView;
    
    // Private constructor for singleton
    private Navigation()
    {
        CurrentView = _homeView;
    }
    
    public void GoToAlbum() => CurrentView = _albumView;
    public void GoToArtist() => CurrentView = _artistView;
    public void GoToTrack() => CurrentView = _trackView;
}