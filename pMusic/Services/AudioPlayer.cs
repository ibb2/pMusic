using System;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using KeySharp;
using SoundFlow.Abstracts;
using SoundFlow.Backends.MiniAudio;
using SoundFlow.Components;
using SoundFlow.Enums;
using SoundFlow.Providers;

namespace pMusic.Services;

public interface IAudioPlayerService
{
    // public bool IsAudioCurrentlyPlaying { get; }
    // public SoundPlayer SoundPlayer { get; }
    // public double PlaybackPosition { get; }

    ValueTask PlayAudio(string uri, string baseUri, string ratingKey, string key);
    // ValueTask PauseAudio();
    // ValueTask ResumeAudio();
    // ValueTask Stop();
}

public partial class AudioPlayer : IAudioPlayerService
{
    private readonly string _plexToken = Keyring.GetPassword("com.ib.pmusic", "pMusic", "authToken");

    public bool IsPlaying = false;
    public SoundPlayer? SoundPlayer = null;
    public double PlaybackPosition;
    public Plex Plex;

    private static AudioEngine? _audioEngine;

    private Playback _playback;

    public AudioPlayer(Plex plex)
    {
        Plex = plex;
    }

    public SoundPlayer Player { get; set; }


    public async ValueTask PlayAudio(string uri, string baseUri, string ratingKey, string key)
    {
        try
        {
            _playback = new Playback(plex: Plex, uri: baseUri, mixer: Mixer.Master, SoundPlayer, PlaybackPosition);

            // Initialize the audio engine with the MiniAudio backend.
            if (_audioEngine is null) _audioEngine = new MiniAudioEngine(44100, Capability.Playback);

            var musicMemoryStream = await Plex.GetPlaybackStream(uri);

            var dataProvider = new ChunkedDataProvider(musicMemoryStream, chunkSize: 4096);
            // var dataProvider = new NetworkDataProvider($"{uri}?X-Plex-Token={_plexToken}");
            // var dataProvider =
            //     new NetworkDataProvider(
            //         "http://commondatastorage.googleapis.com/codeskulptor-demos/DDR_assets/Sevish_-__nbsp_.mp3");
            // var dataProvider =
            //     new NetworkDataProvider(
            //         "https://freesound.org/people/kevp888/sounds/797756/download/797756__kevp888__r4_00491_exp01_jurassic_world_alien_planet.wav");

            // Create a SoundPlayer and load the stream.
            Player = new SoundPlayer(dataProvider);
            // await _player.UpdateAsync(_ => Player);
            // Create a SoundPlayer and load an audio file.
            // Replace "path/to/your/audiofile.wav" with the actual path to your audio file.
            // var player = new SoundPlayer(new StreamDataProvider(File.OpenRead("/Users/ibrahim/Library/Application Support/Plex/Plex Media Server/Sync/2/5/¥$/VULTURES 1/01 - STARS.flac")));

            // Add the player to the master mixer.
            Mixer.Master.AddComponent(Player);
            // Start playback.
            Player.Play();
            _playback.StartPlayback(player: Player, key: key, ratingKey: ratingKey,
                Decimal.Round((Decimal)Player.Duration * 1000, MidpointRounding.ToZero),
                SoundPlayer, PlaybackPosition);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"An error occurred: {ex.Message}");
        }
    }

    // public async ValueTask ResumeAudio()
    // {
    //     Player?.Play();
    //     await _soundPlayer.UpdateAsync(_ => Player);
    //     await _isPlaying.UpdateAsync(_ => true);
    //     await _playback.UnPausePlayback();
    // }
    //
    // public async ValueTask PauseAudio()
    // {
    //     Player?.Pause();
    //     await _soundPlayer.UpdateAsync(_ => Player);
    //     await _isPlaying.UpdateAsync(_ => false);
    //     await _playback.PausePlayback();
    // }
    //
    // public async ValueTask Stop()
    // {
    //     Player?.Stop();
    //     await _soundPlayer.UpdateAsync(_ => Player);
    //     await _isPlaying.UpdateAsync(_ => false);
    //     await _playback.StopPlayback();
    // }
}