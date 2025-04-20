using System;
using System.Threading.Tasks;
using KeySharp;
using ManagedBass;
using ManagedBass.Flac;
using pMusic.Models;
using pMusic.Services;

namespace pMusic.Interface.Bass;

public class BassFlacPlayer : IAudioPlayer
{
    private MusicPlayer _musicPlayer;
    private Playback _playback;
    private Plex _plex;
    private int _stream;

    public bool Initialize(Plex plex, MusicPlayer musicPlayer, IAudioBackend audioBackend)
    {
        _plex = plex;
        _musicPlayer = musicPlayer;
        _playback = new Playback(plex, musicPlayer, audioBackend);
        return ManagedBass.Bass.Init();
    }

    public bool Play(Track track, string url, string serverUrl)
    {
        // Create a stream.
        var filePath = url + "?X-Plex-Token=" + Keyring.GetPassword("com.ib.pmusic", "pMusic", "authToken");

        _stream =
            BassFlac.CreateStream(
                filePath, 0, BassFlags.Default, null);

        if (_stream == 0)
        {
            Console.WriteLine("Failed to create FLAC stream.");
            return false;
        }

        ManagedBass.Bass.ChannelIsActive(_stream);

        // Set MusicPlayer information (Accessible in UI)
        _musicPlayer.Position = 0;
        _musicPlayer.Duration = ManagedBass.Bass.ChannelGetLength(_stream);
        _musicPlayer.MPlaybackState = PlaybackState.Playing;
        _musicPlayer.IsPlaying = true;
        _musicPlayer.CurrentlyPlayingTrack = track;

        var play = ManagedBass.Bass.ChannelPlay(_stream);

        _playback.StartPlayback(track, serverUrl, _stream);
        return play;
    }

    public async ValueTask<bool> Pause()
    {
        var playState = ManagedBass.Bass.ChannelPause(_stream);
        _musicPlayer.MPlaybackState = PlaybackState.Paused;
        await _playback.PausePlayback();
        return playState;
    }

    public async ValueTask<bool> Resume()
    {
        var playState = ManagedBass.Bass.ChannelPlay(_stream);
        _musicPlayer.MPlaybackState = PlaybackState.Playing;
        await _playback.UnPausePlayback();
        return playState;
    }

    public void Stop()
    {
        var stopped = ManagedBass.Bass.ChannelStop(_stream);
        _musicPlayer.MPlaybackState = PlaybackState.Stopped;
    }

    public void Dispose()
    {
        ManagedBass.Bass.StreamFree(_stream);
        ManagedBass.Bass.Free();
    }
}