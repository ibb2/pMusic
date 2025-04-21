using System;
using Avalonia.Media.Imaging;
using CommunityToolkit.Mvvm.ComponentModel;
using ManagedBass;
using pMusic.Interface;
using pMusic.Services;
using SoundFlow.Components;

namespace pMusic.Models;

public partial class MusicPlayer : ObservableObject
{
    private readonly Plex _plex;
    [ObservableProperty] public Album album;
    [ObservableProperty] public Artist artist;
    [ObservableProperty] public IAudioBackend audioBackend;
    [ObservableProperty] public IAudioPlayer audioPlayer;
    [ObservableProperty] public long duration;
    [ObservableProperty] public Bitmap image;
    [ObservableProperty] public bool isPlaying;
    [ObservableProperty] public bool isStopped;
    [ObservableProperty] public PlaybackState mPlaybackState;
    [ObservableProperty] public bool muted = false;
    [ObservableProperty] public bool mutedOpposite = true;
    [ObservableProperty] public SoundFlow.Enums.PlaybackState playbackState;
    [ObservableProperty] public double? position = null;
    [ObservableProperty] public long realPosition;
    [ObservableProperty] public SoundPlayer soundPlayer;
    [ObservableProperty] public int stream;
    [ObservableProperty] public Track track;
    [ObservableProperty] public float volume = 1;

    public MusicPlayer(Plex plex)
    {
        _plex = plex;
    }

    async partial void OnTrackChanging(Track newValue)
    {
        Image = await _plex.GetBitmapImage(newValue.Thumb);
    }

    partial void OnPositionChanged(double? oldValue, double? newValue)
    {
        if (!oldValue.HasValue || !newValue.HasValue) return;
        var oldPosition = (double)decimal.Round((decimal)oldValue, 0);
        var newPosition = (double)decimal.Round((decimal)newValue, 0);
        Console.WriteLine($"{oldPosition} -> {newPosition}");

        // Return early if it's natural playback (new position is exactly 1 ahead of old)
        // or if it's the initial position
        if ((isPlaying && oldPosition + 1 == newPosition) || oldPosition == 0 || oldPosition == newPosition)
            return;

        Console.WriteLine($"Position: {newValue}");
        audioBackend.Seek((double)newValue);
        Position = newValue;
    }

    partial void OnMutedChanged(bool oldValue, bool newValue)
    {
        if (oldValue == newValue) return;

        if (newValue)
        {
            var muteVal = 0f;
            AudioBackend.AdjustVolume(muteVal);
            Muted = true;
            MutedOpposite = false;
        }
        else
        {
            AudioBackend.AdjustVolume(volume);
            Muted = false;
            MutedOpposite = true;
        }
    }

    partial void OnVolumeChanged(float oldValue, float newValue)
    {
        AudioBackend.AdjustVolume(newValue);
    }

// MediaPlayer.Handle
//     MediaPlayer.Disposed
// MediaPlayer.MediaEnded
//     MediaPlayer.MediaFailed
// MediaPlayer.Frequency
//     MediaPlayer.Balance
// MediaPlayer.Device
//     MediaPlayer.Volume
// MediaPlayer.Loop
//     MediaPlayer.Title
// MediaPlayer.Artist
//     MediaPlayer.Album
// MediaPlayer.State
//     MediaPlayer.Play()
// MediaPlayer.Pause()
//     MediaPlayer.Stop()
// MediaPlayer.Duration
//     MediaPlayer.Position
// MediaPlayer.LoadAsync(String)
//     MediaPlayer.MediaLoaded
// MediaPlayer.Dispose()
//     MediaPlayer.PropertyChanged
// MediaPlayer.OnPropertyChanged(String)
}