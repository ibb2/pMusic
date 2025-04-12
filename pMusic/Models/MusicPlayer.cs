using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using SoundFlow.Components;
using SoundFlow.Enums;

namespace pMusic.Models;

public partial class MusicPlayer : ObservableObject
{
    [ObservableProperty] public SoundPlayer soundPlayer;
    [ObservableProperty] public PlaybackState playbackState;
    [ObservableProperty] public Track? currentlyPlayingTrack = null;
    [ObservableProperty] public float? position = null;
    [ObservableProperty] public float volume;

    public MusicPlayer()
    {
    }

    partial void OnPositionChanged(float? value)
    {
        if (value.HasValue)
            SoundPlayer.Seek((float)value);
    }
}