using System;
using System.Threading.Tasks;
using Avalonia.Media.Imaging;
using CommunityToolkit.Mvvm.ComponentModel;
using KeySharp;
using pMusic.Models;
using pMusic.Services;

namespace pMusic.ViewModels;

public partial class DisplayPlaylistViewModel : PinnedItemViewModelBase
{
    private readonly Plex _plex;

    [ObservableProperty] private Bitmap? composite;

    public DisplayPlaylistViewModel(Playlist playlist, Plex plex)
    {
        _plex = plex;
        Playlist = playlist;
        Title = playlist.Title;
        Duration = playlist.Duration;
        ImageUrl = playlist.Composite;
    }

    public Playlist Playlist { get; }


    public async Task LoadThumbAsync()
    {
        if (string.IsNullOrWhiteSpace(ImageUrl))
            return;

        try
        {
            var ThumbnailUrl = ImageUrl + "?X-Plex-Token=" +
                               Keyring.GetPassword("com.ib.pmusic", "pMusic", "authToken");
            Composite = await _plex.GetBitmapImage(ThumbnailUrl);
        }
        catch
        {
            // Log or handle failure (e.g., set fallback image)
            Console.WriteLine("Failed to load thumbnail");
        }
    }
}