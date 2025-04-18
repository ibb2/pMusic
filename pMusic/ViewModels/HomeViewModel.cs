using System;
using System.Collections.Immutable;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Avalonia.Threading;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Extensions.DependencyInjection;
using pMusic.Models;
using pMusic.Services;

namespace pMusic.ViewModels;

public partial class HomeViewModel : ViewModelBase
{
    private IMusic _music;
    private Plex _plex;
    private ObservableCollection<DisplayPlaylistViewModel> _playlists = new();

    public ObservableCollection<DisplayAlbumViewModel> Albums { get; } = new();
    public ObservableCollection<DisplayAlbumViewModel> TopEight { get; set; } = new();
    public ObservableCollection<DisplayAlbumViewModel> RecentlyAddedAlbums { get; set; } = new();

    public ObservableCollection<DisplayPlaylistViewModel> Playlists
    {
        get => _playlists;
        set
        {
            if (Equals(value, _playlists)) return;
            _playlists = value;
            OnPropertyChanged();
        }
    }


    public HomeViewModel(IMusic music, Plex plex)
    {
        _music = music;
        _plex = plex;
    }

    public HomeViewModel()
        : this(
            App.ServiceProvider?.GetRequiredService<IMusic>()
            ?? throw new InvalidOperationException("DI not initialized: IMusic is null"),
            App.ServiceProvider?.GetRequiredService<Plex>()
            ?? throw new InvalidOperationException("DI not initialized: Plex is null"))
    {
        Debug.Assert(_music != null, "IMusic is null");
        Debug.Assert(_plex != null, "Plex is null");
        Console.WriteLine($"HomeViewModel resolved: Plex: {_plex}, Music: {_music}");
    }

    public async ValueTask LoadContent()
    {
        var allAlbums = await _music.GetAllAlbums(CancellationToken.None, _plex);
        await LoadHomepageAlbumsAsync(allAlbums);
        await LoadHomepageRecentlyAddedAlbumsAsync(allAlbums);
        await LoadPlaylistsAsync();
        Console.WriteLine("Content loaded");
    }

    public async Task LoadHomepageAlbumsAsync(IImmutableList<Album> allAlbums)
    {
        var viewModels = allAlbums.Select(a => new DisplayAlbumViewModel(a, _plex)).ToList();

        await Task.WhenAll(viewModels.Select(vm => vm.LoadThumbAsync()));

        Albums.Clear();
        foreach (var vm in viewModels)
            Albums.Add(vm);

        Console.WriteLine($"Albums loaded: {Albums.Count}");
    }

    public async Task LoadHomepageRecentlyAddedAlbumsAsync(IImmutableList<Album> allAlbums)
    {
        var viewModels = allAlbums.OrderByDescending(a => a.AddedAt).Select(a => new DisplayAlbumViewModel(a, _plex))
            .ToList();

        await Task.WhenAll(viewModels.Select(vm => vm.LoadThumbAsync()));

        RecentlyAddedAlbums.Clear();
        var count = 0;
        foreach (var vm in viewModels)
        {
            if (count < 8)
            {
                TopEight.Add(vm);
            }

            count++;

            RecentlyAddedAlbums.Add(vm);
        }

        Console.WriteLine($"Albums loaded: {Albums.Count}");
    }


    // public async Task LoadAlbumsAsync(CancellationToken ct)
    // {
    //     var albums = await _music.GetAllAlbums(ct, _plex);
    //
    //     var recentlyViewedAlbums = albums.OrderByDescending(a => a.LastViewedAt).ToImmutableList();
    //     var recentlyAddedAlbums = albums.OrderByDescending(a => a.AddedAt).ToImmutableList();
    //
    //     // Update on UI thread
    //     await Dispatcher.UIThread.InvokeAsync(() =>
    //     {
    //         Albums.Clear();
    //         var count = 0;
    //         foreach (var recentlyViewedAlbum in recentlyViewedAlbums)
    //         {
    //             Albums.Add(recentlyViewedAlbum);
    //             if (count < 8)
    //             {
    //                 TopEight.Add(recentlyViewedAlbum);
    //             }
    //
    //             count++;
    //         }
    //
    //         foreach (var recentlyAddedAlbum in recentlyAddedAlbums)
    //         {
    //             RecentlyAddedAlbums.Add(recentlyAddedAlbum);
    //         }
    //     });
    // }

    public async Task LoadPlaylistsAsync()
    {
        Playlists = new();
        var playlists = await _music.GetPlaylists(CancellationToken.None, _plex);
        var viewModels = playlists.Select(a => new DisplayPlaylistViewModel(a, _plex))
            .ToList();

        await Task.WhenAll(viewModels.Select(vm => vm.LoadThumbAsync()));

        // Update on UI thread
        await Dispatcher.UIThread.InvokeAsync(() =>
        {
            foreach (var playlist in viewModels)
            {
                Playlists.Add(playlist);
            }
        });
    }

    [RelayCommand]
    public void GoToAlbumPage(Album album)
    {
        GoToAlbum(album);
    }
}