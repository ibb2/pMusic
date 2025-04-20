using CommunityToolkit.Mvvm.ComponentModel;
using ManagedBass;
using SoundFlow.Components;

namespace pMusic.Models;

public partial class MusicPlayer : ObservableObject
{
    [ObservableProperty] public Track? currentlyPlayingTrack = null;
    [ObservableProperty] public long duration;
    [ObservableProperty] public bool isPlaying;
    [ObservableProperty] public bool isStopped;
    [ObservableProperty] public PlaybackState mPlaybackState;
    [ObservableProperty] public SoundFlow.Enums.PlaybackState playbackState;
    [ObservableProperty] public float? position = null;
    [ObservableProperty] public SoundPlayer soundPlayer;
    [ObservableProperty] public float volume;

    public MusicPlayer()
    {
    }

    // partial void OnPositionChanged(float? value)
    // {
    //     if (value.HasValue)
    //         SoundPlayer.Seek((float)value);
    // }
}