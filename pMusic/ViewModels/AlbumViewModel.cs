using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Avalonia.Media.Imaging;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.DependencyInjection;
using CommunityToolkit.Mvvm.Input;
using KeySharp;
using pMusic.Database;
using pMusic.Models;
using pMusic.Services;

namespace pMusic.ViewModels;

public partial class AlbumViewModel : ViewModelBase
{
    [ObservableProperty] public Album? _Album = null;
    [ObservableProperty] public string _albumArtist = "Playboi Carti";
    [ObservableProperty] public string _albumDuration = "1h 16m";
    [ObservableProperty] public string _albumReleaseDate = "2025";
    [ObservableProperty] public string _albumTitle = "MUSIC";
    [ObservableProperty] public string _albumTrackLength = "30";
    private IAudioPlayerService _audioPlayerService;
    [ObservableProperty] public Bitmap? _Image = null;
    private IMusic _music;
    private MusicDbContext _musicDbContext;
    private Plex _plex;
    private Sidebar _sidebar;
    [ObservableProperty] public string _title = "Album";

    public AlbumViewModel(IMusic music, Plex plex, IAudioPlayerService audioPlayerService,
        MusicDbContext musicDbContext, Sidebar sidebar)
    {
        _music = music;
        _plex = plex;
        _audioPlayerService = audioPlayerService;
        _musicDbContext = musicDbContext;
        _sidebar = sidebar;
    }

    public AlbumViewModel() : this(Ioc.Default.GetRequiredService<IMusic>(), Ioc.Default.GetRequiredService<Plex>(),
        Ioc.Default.GetRequiredService<IAudioPlayerService>(), Ioc.Default.GetRequiredService<MusicDbContext>(),
        Ioc.Default.GetRequiredService<Sidebar>())
    {
    }

    public ObservableCollection<Track?> TrackList { get; set; } = new();

    public async ValueTask GetTracks()
    {
        if (Album?.Guid == null) return;

        var tracks =
            await _music.GetTrackList(CancellationToken.None, _plex, Album.Guid);

        foreach (var track in tracks)
        {
            TrackList.Add(track);
        }
    }

    [RelayCommand]
    public async Task Play(Track track)
    {
        var serverUri = await _music.GetServerUri(CancellationToken.None, _plex);
        var url = serverUri + track.Media.Part.Key;
        _ = _audioPlayerService.PlayAudio(uri: url, baseUri: serverUri, track: track);
    }

    [RelayCommand]
    public async Task AddToLibrary(Album currentAlbum)
    {
        _sidebar.PinnedAlbum = new();

        // No need to re-fetch or attach
        currentAlbum.IsPinned = !currentAlbum.IsPinned;

        var count = await _musicDbContext.SaveChangesAsync();
        Console.WriteLine($"count: {count}");
        Console.WriteLine($"currentAlbum ref: {currentAlbum.GetHashCode()}");

        var albums = _musicDbContext.Albums.Where(x => x.IsPinned).ToList();
        var viewModels = albums.Select(a => new DisplayAlbumViewModel(a, _plex)).ToList();
        await Task.WhenAll(viewModels.Select(vm => vm.LoadThumbAsync()));
        foreach (var a in viewModels)
        {
            _sidebar.PinnedAlbum.Add(a);
        }
    }


    [RelayCommand]
    public async Task LoadAlbumThumbnail()
    {
        var url = Album.Thumb + "?X-Plex-Token=" +
                  Keyring.GetPassword("com.ib.pmusic", "pMusic", "authToken");
        Image = await _plex.GetBitmapImage(url);
    }
}