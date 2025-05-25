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
using pMusic.Interface;
using pMusic.Models;
using pMusic.Services;

namespace pMusic.ViewModels;

public partial class PlaylistViewModel : ViewModelBase
{
    private AudioPlayerFactory _audioPlayerFactory;

    [ObservableProperty] public Bitmap? _Image = null;
    private IMusic _music;
    private MusicDbContext _musicDbContext;
    private MusicPlayer _musicPlayer;
    private Plex _plex;
    private Sidebar _sidebar;
    [ObservableProperty] public Playlist playlist;

    public PlaylistViewModel(IMusic music, Plex plex,
        MusicDbContext musicDbContext, Sidebar sidebar, AudioPlayerFactory audioPlayerFactory, MusicPlayer musicPlayer)
    {
        _music = music;
        _plex = plex;
        _audioPlayerFactory = audioPlayerFactory;
        _musicPlayer = musicPlayer;
        _musicDbContext = musicDbContext;
        _sidebar = sidebar;
    }

    public PlaylistViewModel() : this(Ioc.Default.GetRequiredService<IMusic>(), Ioc.Default.GetRequiredService<Plex>(),
        Ioc.Default.GetRequiredService<MusicDbContext>(),
        Ioc.Default.GetRequiredService<Sidebar>(), Ioc.Default.GetRequiredService<AudioPlayerFactory>(),
        Ioc.Default.GetRequiredService<MusicPlayer>())
    {
    }

    public ObservableCollection<Track?> TrackList { get; set; } = new();

    public async ValueTask GetTracks()
    {
        if (Playlist?.Guid == null) return;

        var tracks =
            await _music.GetPlaylistTrackList(CancellationToken.None, _plex, Playlist.Guid);

        foreach (var track in tracks) TrackList.Add(track);
    }

    [RelayCommand]
    public async Task QueueAlbum()
    {
        if (TrackList.Count == 0) return;
        _musicPlayer.PlayedTracks.Clear();
        _musicPlayer.UpcomingTracks.Clear();
        var serverUri = await _music.GetServerUri(CancellationToken.None, _plex);
        // _musicPlayer.Album = Album;
        // _musicPlayer.Artist = Playlist.a;
        _musicPlayer.ServerUrl = serverUri;
        _musicPlayer.Queue(TrackList.ToList()!);
        _musicPlayer.NextTrack();
    }

    [RelayCommand]
    public async Task Play(Track track)
    {
        // var serverUri = await _music.GetServerUri(CancellationToken.None, _plex);
        // _musicPlayer.Album = Album;
        // _musicPlayer.Artist = Album.Artist;
        _musicPlayer.Play(track);
        // _ = _audioPlayerService.PlayAudio(uri: url, baseUri: serverUri, track: track);
    }

    [RelayCommand]
    public async Task AddToLibrary(Album currentAlbum)
    {
        _sidebar.PinnedAlbum = new ObservableCollection<DisplayAlbumViewModel>();

        // No need to re-fetch or attach
        currentAlbum.IsPinned = !currentAlbum.IsPinned;

        var count = await _musicDbContext.SaveChangesAsync();
        Console.WriteLine($"count: {count}");
        Console.WriteLine($"currentAlbum ref: {currentAlbum.GetHashCode()}");

        var albums = _musicDbContext.Albums.Where(x => x.IsPinned).ToList();
        var viewModels = albums.Select(a => new DisplayAlbumViewModel(a, _plex)).ToList();
        await Task.WhenAll(viewModels.Select(vm => vm.LoadThumbAsync()));
        foreach (var a in viewModels) _sidebar.PinnedAlbum.Add(a);
    }

    [RelayCommand]
    public async Task LoadPlaylistComposite()
    {
        var url = Playlist.Composite + "?X-Plex-Token=" +
                  Keyring.GetPassword("com.ib.pmusic", "pMusic", "authToken");
        Image = await _plex.GetBitmapImage(url);
    }
}