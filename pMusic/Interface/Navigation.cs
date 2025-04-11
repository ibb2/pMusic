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

    [ObservableProperty] private Stack<ViewModelBase> _navStack = new();
    [ObservableProperty] private Stack<ViewModelBase> _popStack = new();
    [ObservableProperty] private object? _currentView;

    private readonly Dictionary<Type, ViewModelBase> _viewModels = new();

    // Singleton instance
    public static Navigation Instance { get; } = new(
        music: Ioc.Default.GetRequiredService<IMusic>(),
        plex: Ioc.Default.GetRequiredService<Plex>()
    );

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
        PushToNavStack(viewModel);
    }

    // Factory method to get view model instances
    public T GetViewModel<T>() where T : ViewModelBase, new()
    {
        Type type = typeof(T);

        if (!_viewModels.ContainsKey(type))
        {
            _viewModels[type] = Ioc.Default.GetRequiredService<T>();
        }

        return (T)_viewModels[type];
    }

    private void PushToNavStack(ViewModelBase viewModel)
    {
        NavStack.Push(viewModel);
    }

    private void PopFromNavStack(bool direction)
    {
        if (NavStack.Count <= 0 && PopStack.Count <= 0) return;

        if (direction)
        {
            if (NavStack.Count == 1)
            {
                CurrentView = GetViewModel<HomeViewModel>();
                PopStack.Push(NavStack.Pop());
                return;
            }

            PopStack.Push(NavStack.Pop());
            CurrentView = NavStack.Pop();
        }
        else
        {
            var topOfStack = PopStack.Pop();
            NavStack.Push(topOfStack);
            CurrentView = topOfStack;
        }
    }

    public void GoBack() => PopFromNavStack(true);
    public void GoForward() => PopFromNavStack(false);
}