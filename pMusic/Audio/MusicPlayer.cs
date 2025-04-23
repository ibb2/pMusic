using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using Avalonia.Media.Imaging;
using CommunityToolkit.Mvvm.ComponentModel;
using ManagedBass;
using pMusic.Classes;
using pMusic.Interface;
using pMusic.Services;
using SoundFlow.Components;

namespace pMusic.Models;

public partial class MusicPlayer : ObservableObject
{
    private readonly Plex _plex;
    private AudioPlayerFactory _audioPlayerFactory;
    [ObservableProperty] public Album album;
    [ObservableProperty] public Artist artist;
    [ObservableProperty] public IAudioBackend audioBackend;
    [ObservableProperty] public IAudioPlayer audioPlayer;
    [ObservableProperty] public long duration;
    [ObservableProperty] ObservableQueue<Track> highPriorityTracks = new();
    [ObservableProperty] ObservableCollection<Track> highPriorityTracksBacking = new();
    [ObservableProperty] public Bitmap image;
    [ObservableProperty] public bool isPlaying;
    [ObservableProperty] public bool isStopped;
    [ObservableProperty] public PlaybackState mPlaybackState;
    [ObservableProperty] public bool muted = false;
    [ObservableProperty] public bool mutedOpposite = true;
    [ObservableProperty] public SoundFlow.Enums.PlaybackState playbackState;
    [ObservableProperty] ObservableStack<Track> playedTracks = new();
    [ObservableProperty] ObservableCollection<Track> playedTracksBacking = new();
    [ObservableProperty] public double? position = null;
    [ObservableProperty] public long realPosition;
    [ObservableProperty] public string serverUrl;
    [ObservableProperty] public SoundPlayer soundPlayer;
    [ObservableProperty] public int stream;
    [ObservableProperty] public Track track;
    [ObservableProperty] ObservableQueue<Track> upcomingTracks = new();
    [ObservableProperty] ObservableCollection<Track> upcomingTracksAndHighPriorityBacking = new();
    [ObservableProperty] ObservableCollection<Track> upcomingTracksBacking = new();
    [ObservableProperty] public float volume = 1;

    public MusicPlayer(Plex plex, AudioPlayerFactory audioPlayerFactory)
    {
        _plex = plex;
        _audioPlayerFactory = audioPlayerFactory;
    }

    public void Play(Track trackToPlay)
    {
        UpcomingTracks.Clear();
        PlayedTracks.Clear();
        UpcomingTracksAndHighPriorityBacking.Clear();
        UpcomingTracksBacking.Clear();
        PlayedTracksBacking.Clear();
        _audioPlayerFactory.PlayAudio(this, trackToPlay, ServerUrl);
    }

    public void Queue(List<Track> tracks)
    {
        if (tracks.Count == 0) return;

        foreach (var t in tracks)
        {
            UpcomingTracksBacking.Add(t);
            UpcomingTracksAndHighPriorityBacking.Add(t);
            UpcomingTracks.Enqueue(t);
        }
    }

    public void NextTrack(bool force = false)
    {
        if (UpcomingTracks.Count == 0) return;

        Track? upcomingTrack;
        try
        {
            if (HighPriorityTracks.Count > 0)
            {
                upcomingTrack = HighPriorityTracks.Dequeue();
                HighPriorityTracksBacking.RemoveAt(0);
                UpcomingTracksAndHighPriorityBacking.RemoveAt(0);
            }
            else
            {
                upcomingTrack = UpcomingTracks.Dequeue();
                UpcomingTracksBacking.RemoveAt(0);
                UpcomingTracksAndHighPriorityBacking.RemoveAt(0);
            }
        }
        catch (InvalidOperationException ex)
        {
            return;
        }

        PlayedTracks.Push(Track);
        PlayedTracksBacking.Add(Track);
        _audioPlayerFactory.PlayAudio(this, upcomingTrack, ServerUrl);
    }

    //
    public void PreviousTrack()
    {
        if (PlayedTracks.Count == 0) return;

        // Rewind to the beginning of the track first before playing the previous track.
        // UX design wise, this may be the intended behavior users expect.
        if (Position > 5) AudioBackend.Seek(0);

        Track? prevTrack;

        try
        {
            prevTrack = PlayedTracks.Pop();
            PlayedTracksBacking.RemoveAt(PlayedTracks.Count);
        }
        catch (InvalidOperationException ex)
        {
            return;
        }

        HighPriorityTracks.Enqueue(Track);
        UpcomingTracksAndHighPriorityBacking.Insert(0, Track);
        HighPriorityTracksBacking.Add(Track);
        _audioPlayerFactory.PlayAudio(this, prevTrack, ServerUrl);
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