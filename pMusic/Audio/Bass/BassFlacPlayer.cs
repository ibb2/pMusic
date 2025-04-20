using System;
using System.Threading;
using ManagedBass;
using ManagedBass.Flac;
using pMusic.Models;
using pMusic.Services;

namespace pMusic.Interface.Bass;

public class BassFlacPlayer : IAudioPlayer
{
    private int _stream;
    private MusicPlayer _musicPlayer;
    private Plex _plex;
    private Playback _playback;

    public bool Initialize(Plex plex, MusicPlayer musicPlayer)
    {
        _plex = plex;
        _musicPlayer = musicPlayer;
        _playback = new Playback(plex, musicPlayer);
        return ManagedBass.Bass.Init();
    }

    public bool Play(Track track, string url)
    {
        // Create stream.
        var filePath = url + track.Media.Part.Key;

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
        _musicPlayer.IsPlaying = true;
        _musicPlayer.CurrentlyPlayingTrack = track;

        _playback.StartPlayback(track, url, _stream);
        return true;
    }

    public bool Pause()
    {
        ManagedBass.Bass.ChannelPause(_stream);
        return false;
    }

    public void Stop()
    {
        ManagedBass.Bass.ChannelPause(_stream);
    }

    public void Dispose()
    {
        ManagedBass.Bass.StreamFree(_stream);
        ManagedBass.Bass.Free();
    }
}