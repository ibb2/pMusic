using System.Linq;
using Avalonia.Media.Imaging;
using CommunityToolkit.Mvvm.ComponentModel;
using ManagedBass;
using pMusic.Services;
using SoundFlow.Components;

namespace pMusic.Models;

public partial class MusicPlayer : ObservableObject
{
    private readonly Plex _plex;
    [ObservableProperty] public Artist artist;
    [ObservableProperty] public Album album;
    [ObservableProperty] public Track track;
    [ObservableProperty] public Bitmap image;
    [ObservableProperty] public long duration;
    [ObservableProperty] public bool isPlaying;
    [ObservableProperty] public bool isStopped;
    [ObservableProperty] public PlaybackState mPlaybackState;
    [ObservableProperty] public SoundFlow.Enums.PlaybackState playbackState;
    [ObservableProperty] public float? position = null;
    [ObservableProperty] public SoundPlayer soundPlayer;
    [ObservableProperty] public float volume;

    public MusicPlayer(Plex plex)
    {
        _plex = plex;
    }

    async partial void OnTrackChanging(Track newValue)
    {
        Image = await _plex.GetBitmapImage(newValue.Thumb);
    }
}