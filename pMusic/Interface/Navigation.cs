using System;
using System.Collections.Generic;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.DependencyInjection;
using pMusic.Services;
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
    private static IMusic _music;
    private static Plex _plex;


    // private readonly HomeViewModel _homeView = new();

    [ObservableProperty] private object? _currentView;

    private readonly Dictionary<Type, ViewModelBase> _viewModels = new();
    
    // Singleton instance
    public static Navigation Instance { get; } = new(music: _music, plex: _plex);
    
    private Navigation(IMusic music, Plex plex)
    {
        _music = music;
        _plex = plex;
        CurrentView = Ioc.Default.GetRequiredService<HomeViewModel>();
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
}