using System;
using System.Collections.Generic;
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
    
    private readonly Dictionary<Type, ViewModelBase> _viewModels = new();
    
    // Private constructor for singleton
    private Navigation()
    {
        CurrentView = _homeView;
    }
    
    public void GoToView<T>(Action<T> intializer) where T : ViewModelBase, new()
    {

        var viewModel = GetViewModel<T>();
        intializer(viewModel);
        CurrentView = viewModel;
    }
    
    // Factory method to get view model instances
    public T GetViewModel<T>() where T : ViewModelBase, new()
    {
        Type type = typeof(T);
        
        // Create the view model if it doesn't exist yet
        if (!_viewModels.ContainsKey(type))
        {
            _viewModels[type] = new T();
        }
        
        return (T)_viewModels[type];
    }

    public void GoToAlbum() => CurrentView = _albumView;
    public void GoToArtist() => CurrentView = _artistView;
    public void GoToTrack() => CurrentView = _trackView;
}