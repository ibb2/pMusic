using System;
using System.Threading.Tasks;
using KeySharp;
using pMusic.Models;
using pMusic.Services;

namespace pMusic.ViewModels;

using CommunityToolkit.Mvvm.ComponentModel;
using System.Net.Http;
using Avalonia.Media.Imaging;

public partial class DisplayAlbumViewModel : ObservableObject
{
    private readonly Plex _plex;
    public string Title { get; }
    public string Artist { get; }
    public string ThumbUrl { get; }
    public Album Album { get; }

    [ObservableProperty] private Bitmap? thumb;

    public DisplayAlbumViewModel(Album album, Plex plex)
    {
        _plex = plex;
        Album = album;
        Title = album.Title;
        Artist = album.Artist;
        ThumbUrl = album.Thumb;
    }

    public async Task LoadThumbAsync()
    {
        if (string.IsNullOrWhiteSpace(ThumbUrl))
            return;

        try
        {
            var ThumbnailUrl = ThumbUrl + "?X-Plex-Token=" +
                               Keyring.GetPassword("com.ib.pmusic", "pMusic", "authToken");
            Thumb = await _plex.GetBitmapImage(ThumbnailUrl);
        }
        catch
        {
            // Log or handle failure (e.g., set fallback image)
            Console.WriteLine("Failed to load thumbnail");
        }
    }
}