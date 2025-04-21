using System;
using System.Threading.Tasks;
using pMusic.Interface.Bass;
using pMusic.Models;
using pMusic.Services;

namespace pMusic.Interface;

public class AudioPlayerFactory
{
    private readonly Plex _plex;
    private IAudioBackend _audioBackend;
    private AudioBackendFactory _audioBackendFactory;

    private MusicPlayer _musicPlayer;
    private IAudioPlayer _player;

    private string _url;

    public AudioPlayerFactory(Plex plex, AudioBackendFactory audioBackendFactory)
    {
        _plex = plex;
        _audioBackendFactory = audioBackendFactory;
    }

    public void PlayAudio(MusicPlayer musicPlayer, Track track, string serverUrl)
    {
        _musicPlayer = musicPlayer;
        _player?.Dispose();

        _url = serverUrl + track.Media.Part.Key;

        if (_url.EndsWith(".flac"))
        {
            _player = new BassFlacPlayer();
            _audioBackend = _audioBackendFactory.Create("flac");
        }
        // else if (path.EndsWith(".mp3") || path.EndsWith(".wav"))
        //     _player = new BassAudioPlayer();
        // else
        //     _player = new LibVlcAudioPlayer(); // fallback or platform specific

        _player.Initialize(_plex, _musicPlayer, _audioBackend);

        if (!_player.Play(track, _url, serverUrl)) Console.WriteLine("Failed to play audio.");
    }

    public async ValueTask PauseAudio() => await _player.Pause();

    public async ValueTask ResumeAudio() => await _player.Resume();

    public void StopAudio()
    {
        _player?.Stop();
    }

    public void Dispose()
    {
        _player?.Dispose();
    }
}