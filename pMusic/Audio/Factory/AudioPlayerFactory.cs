using System;
using pMusic.Interface.Bass;
using pMusic.Models;
using pMusic.Services;

namespace pMusic.Interface;

public class AudioPlayerFactory
{
    private readonly MusicPlayer _musicPlayer;
    private readonly Plex _plex;
    private IAudioBackend _audioBackend;
    private AudioBackendFactory _audioBackendFactory;
    private IAudioPlayer _player;

    public AudioPlayerFactory(Plex plex, MusicPlayer musicPlayer, AudioBackendFactory audioBackendFactory)
    {
        _plex = plex;
        _musicPlayer = musicPlayer;
        _audioBackendFactory = audioBackendFactory;
    }

    public void PlayAudio(Track track, string url, string serverUrl)
    {
        _player?.Dispose();

        if (url.EndsWith(".flac"))
        {
            _player = new BassFlacPlayer();
            _audioBackend = _audioBackendFactory.Create("flac");
        }
        // else if (path.EndsWith(".mp3") || path.EndsWith(".wav"))
        //     _player = new BassAudioPlayer();
        // else
        //     _player = new LibVlcAudioPlayer(); // fallback or platform specific

        _player.Initialize(_plex, _musicPlayer, _audioBackend);

        if (!_player.Play(track, url, serverUrl)) Console.WriteLine("Failed to play audio.");
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