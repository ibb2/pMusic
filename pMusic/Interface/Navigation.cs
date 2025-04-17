using System;
using System.Collections.Generic;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.DependencyInjection;
using KeySharp;
using pMusic.Services;
using pMusic.ViewModels;
using pMusic.Views;

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
    [ObservableProperty] private object? _currentPage;

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


        if (Keyring.GetPassword("com.ib.pmusic", "pMusic", "authToken").Length > 0)
        {
            CurrentPage = Ioc.Default.GetRequiredService<MainViewModel>();
        }
        else
        {
            CurrentPage = Ioc.Default.GetRequiredService<LoginViewModel>();
        }
    }

    public void GoToView<T>(Action<T>? intializer) where T : ViewModelBase, new()
    {
        var viewModel = GetViewModel<T>();
        if (intializer != null)
            intializer(viewModel);
        CurrentView = viewModel;
        PushToNavStack(viewModel);
    }

    public void GoToPage<T>(Action<T>? intializer) where T : ViewModelBase, new()
    {
        var viewModel = GetViewModel<T>();
        if (intializer != null)
            intializer(viewModel);
        CurrentPage = viewModel;
        NavStack.Clear();
        PopStack.Clear();
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

    private void PopFromNavStack(bool direction, bool home)
    {
        if (home)
        {
            CurrentView = GetViewModel<HomeViewModel>();
            NavStack = new Stack<ViewModelBase>();
            PopStack = new Stack<ViewModelBase>();
            return;
        }

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

    public void GoBack() => PopFromNavStack(true, false);
    public void GoForward() => PopFromNavStack(false, false);
    public void GoHome() => PopFromNavStack(true, true);
}