using System;
using System.Collections.ObjectModel;
using System.Threading;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.DependencyInjection;
using CommunityToolkit.Mvvm.Input;
using pMusic.Models;
using pMusic.Services;

namespace pMusic.ViewModels;

public partial class AlbumViewModel : ViewModelBase
{
    private IMusic _music;
    private Plex _plex;
    private IAudioPlayerService _audioPlayerService;

    [ObservableProperty] public Album? _Album = null;
    public ObservableCollection<Track?> TrackList { get; set; } = new();
    [ObservableProperty] public string _albumArtist = "Playboi Carti";
    [ObservableProperty] public string _albumDuration = "1h 16m";
    [ObservableProperty] public string _albumReleaseDate = "2025";
    [ObservableProperty] public string _albumTitle = "MUSIC";
    [ObservableProperty] public string _albumTrackLength = "30";
    [ObservableProperty] public string _title = "Album";

    public AlbumViewModel(IMusic music, Plex plex, IAudioPlayerService audioPlayerService)
    {
        _music = music;
        _plex = plex;
        _audioPlayerService = audioPlayerService;
        // _ = GetTracks();
    }

    public AlbumViewModel() : this(Ioc.Default.GetRequiredService<IMusic>(), Ioc.Default.GetRequiredService<Plex>(),
        Ioc.Default.GetRequiredService<IAudioPlayerService>())
    {
    }

    public async ValueTask GetTracks()
    {
        var tracks = await _music.GetTrackList(CancellationToken.None, _plex, Album.RatingKey);

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
        _ = _audioPlayerService.PlayAudio(uri: url, baseUri: serverUri, ratingKey: track.RatingKey,
            key: track.Key);
    }
}