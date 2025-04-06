using System;
using System.Collections.Immutable;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Avalonia.Threading;
using Microsoft.Extensions.DependencyInjection;
using pMusic.Models;
using pMusic.Services;

namespace pMusic.ViewModels;

public class HomeViewModel : ViewModelBase
{
    private IMusic _music;
    private Plex _plex;

    public ObservableCollection<Album> Albums { get; set; } = new();
    public ObservableCollection<Album> TopEight { get; set; } = new();
    public ObservableCollection<Album> RecentlyAddedAlbums { get; set; } = new();
    public ObservableCollection<Playlist> Playlists { get; set; } = new();

    public HomeViewModel(IMusic music, Plex plex)
    {
        _music = music;
        _plex = plex;

        Console.WriteLine($"Plex {plex} and {music}");

        _ = LoadAlbumsAsync(CancellationToken.None);
        _ = LoadPlaylistsAsync(CancellationToken.None);
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

    public async Task LoadAlbumsAsync(CancellationToken ct)
    {
        var albums = await _music.GetAllAlbums(ct, _plex);

        var recentlyViewedAlbums = albums.OrderByDescending(a => a.LastViewedAt).ToImmutableList();
        var recentlyAddedAlbums = albums.OrderByDescending(a => a.AddedAt).ToImmutableList();

        // Update on UI thread
        await Dispatcher.UIThread.InvokeAsync(() =>
        {
            Albums.Clear();
            var count = 0;
            foreach (var recentlyViewedAlbum in recentlyViewedAlbums)
            {
                Albums.Add(recentlyViewedAlbum);
                if (count < 8)
                {
                    TopEight.Add(recentlyViewedAlbum);
                }

                count++;
            }

            foreach (var recentlyAddedAlbum in recentlyAddedAlbums)
            {
                RecentlyAddedAlbums.Add(recentlyAddedAlbum);
            }
        });
    }

    public async Task LoadPlaylistsAsync(CancellationToken ct)
    {
        var playlists = await _music.GetPlaylists(ct, _plex);

        // Update on UI thread
        await Dispatcher.UIThread.InvokeAsync(() =>
        {
            Playlists.Clear();
            foreach (var playlist in playlists)
            {
                Playlists.Add(playlist);
            }
        });
    }
}