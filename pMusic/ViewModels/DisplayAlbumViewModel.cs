using System;
using System.Threading.Tasks;
using KeySharp;
using pMusic.Models;
using pMusic.Services;

namespace pMusic.ViewModels;

public partial class DisplayAlbumViewModel : PinnedItemViewModelBase
{
    private readonly Plex _plex;

    public DisplayAlbumViewModel(Album album, Plex plex)
    {
        _plex = plex;
        Album = album;
        Title = album.Title;
        // Artist = album.Artist.Title;
        ImageUrl = album.Thumb;
    }

    public string Artist { get; }
    public Album Album { get; }

    public async Task LoadThumbAsync()
    {
        if (string.IsNullOrWhiteSpace(ImageUrl))
            return;

        try
        {
            var ThumbnailUrl = ImageUrl + "?X-Plex-Token=" +
                               Keyring.GetPassword("com.ib.pmusic", "pMusic", "authToken");
            Image = await _plex.GetBitmapImage(ThumbnailUrl);
        }
        catch
        {
            // Log or handle failure (e.g., set fallback image)
            Console.WriteLine("Failed to load thumbnail");
        }
    }
}