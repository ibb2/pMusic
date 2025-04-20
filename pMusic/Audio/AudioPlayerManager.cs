using System;
using pMusic.Interface.Bass;
using pMusic.Models;
using pMusic.Services;

namespace pMusic.Interface;

public class AudioPlayerManager
{
    private readonly Plex _plex;
    private readonly MusicPlayer _musicPlayer;
    private IAudioPlayer _player;

    public AudioPlayerManager(Plex plex, MusicPlayer musicPlayer)
    {
        _plex = plex;
        _musicPlayer = musicPlayer;
    }

    public void PlayAudio(Track track, string url)
    {
        _player?.Dispose();

        if (url.EndsWith(".flac"))
            _player = new BassFlacPlayer();
        // else if (path.EndsWith(".mp3") || path.EndsWith(".wav"))
        //     _player = new BassAudioPlayer();
        // else
        //     _player = new LibVlcAudioPlayer(); // fallback or platform specific

        _player.Initialize(_plex, _musicPlayer);

        if (!_player.Play(track, url)) Console.WriteLine("Failed to play audio.");
    }

    public void StopAudio()
    {
        _player?.Stop();
    }

    public void Dispose()
    {
        _player?.Dispose();
    }
}