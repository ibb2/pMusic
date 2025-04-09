using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using SoundFlow.Enums;

namespace pMusic.Models;

public partial class MusicPlayer : ObservableObject
{
    [ObservableProperty] public PlaybackState playbackState;
    [ObservableProperty] public Track currentlyPlayingTrack;
    [ObservableProperty] public float position;
    [ObservableProperty] public float volume;
}