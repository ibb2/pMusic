using System;
using System.Linq;
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
    [ObservableProperty] public Artist artist;
    [ObservableProperty] public Album album;
    [ObservableProperty] public Track track;
    [ObservableProperty] public Bitmap image;
    [ObservableProperty] public long duration;
    [ObservableProperty] public bool isPlaying;
    [ObservableProperty] public bool isStopped;
    [ObservableProperty] public PlaybackState mPlaybackState;
    [ObservableProperty] public SoundFlow.Enums.PlaybackState playbackState;
    [ObservableProperty] public double position;
    [ObservableProperty] public long realPosition;
    [ObservableProperty] public SoundPlayer soundPlayer;
    [ObservableProperty] public float volume;
    [ObservableProperty] public IAudioBackend audioBackend;
    [ObservableProperty] public IAudioPlayer audioPlayer;
    [ObservableProperty] public int stream;

    public MusicPlayer(Plex plex)
    {
        _plex = plex;
    }

    async partial void OnTrackChanging(Track newValue)
    {
        Image = await _plex.GetBitmapImage(newValue.Thumb);
    }

    partial void OnPositionChanged(double oldValue, double newValue)
    {
        var oldPosition = (double)decimal.Round((decimal)oldValue, 0);
        var newPosition = (double)decimal.Round((decimal)newValue, 0);
        Console.WriteLine($"{oldPosition} -> {newPosition}");

        // Return early if it's natural playback (new position is exactly 1 ahead of old)
        // or if it's the initial position
        if ((isPlaying && oldPosition + 1 == newPosition) || oldPosition == 0 || oldPosition -== newPosition)
            return;

        Console.WriteLine($"Position: {newValue}");
        audioBackend.Seek(newValue);
        Position = newValue;
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