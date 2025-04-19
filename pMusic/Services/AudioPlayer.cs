using System;
using System.Threading;
using System.Threading.Tasks;
using ManagedBass;
using ManagedBass.Flac;
using pMusic.Models;
using SoundFlow.Abstracts;
using SoundFlow.Backends.MiniAudio;
using SoundFlow.Components;
using SoundFlow.Enums;
using PlaybackState = ManagedBass.PlaybackState;
using SFPlaybackState = SoundFlow.Enums.PlaybackState;

namespace pMusic.Services;

public interface IAudioPlayerService
{
    // public bool IsAudioCurrentlyPlaying { get; }
    // public SoundPlayer SoundPlayer { get; }
    // public double PlaybackPosition { get; }

    ValueTask PlayAudio(string uri, string baseUri, Track track);
    ValueTask PauseAudio();

    ValueTask ResumeAudio();
    // ValueTask Stop();
}

public partial class AudioPlayer : IAudioPlayerService
{
    private static AudioEngine? _audioEngine;
    private Track _currentTrack;
    private MusicPlayer _musicPlayer;

    private Playback _playback;
    public bool IsPlaying = false;
    public double PlaybackPosition;
    public Plex Plex;
    public SoundPlayer? SoundPlayer = null;

    public AudioPlayer(Plex plex, MusicPlayer musicPlayer)
    {
        Plex = plex;
        _musicPlayer = musicPlayer;
    }

    public SoundPlayer Player { get; set; }

    public async ValueTask PlayAudio(string uri, string baseUri, Track track)
    {
        try
        {
            _currentTrack = track;

            _playback = new Playback(plex: Plex, uri: baseUri, mixer: Mixer.Master, SoundPlayer, PlaybackPosition,
                musicPlayer: _musicPlayer, track: track);

            // Initialize the audio engine with the MiniAudio backend.
            if (_audioEngine is null) _audioEngine = new MiniAudioEngine(44100, Capability.Playback);

            // var musicMemoryStream = await Plex.GetPlaybackStream(uri);

            string filePath = "/Users/ibrahim/Downloads/File from Plex.flac";
            int stream = BassFlac.CreateStream(filePath);

            if (stream == 0)
            {
                Console.WriteLine("Failed to create FLAC stream.");
            }
            else
            {
                Bass.ChannelPlay(stream);
            }

            while (Bass.ChannelIsActive(stream) == PlaybackState.Playing)
            {
                Thread.Sleep(100); // Sleep for 100 milliseconds
            }


            Bass.ChannelStop(stream);
            Bass.StreamFree(stream);

            // var dataProvider = new AssetDataProvider(File.OpenRead("/Users/ibrahim/Downloads/File from Plex.flac"));
            // var dataProvider = new ChunkedDataProvider(musicMemoryStream, chunkSize: 4096);
            // var dataProvider = new NetworkDataProvider($"{uri}?X-Plex-Token={_plexToken}");
            // var dataProvider =
            //     new NetworkDataProvider(
            //         "http://commondatastorage.googleapis.com/codeskulptor-demos/DDR_assets/Sevish_-__nbsp_.mp3");
            // var dataProvider =
            //     new NetworkDataProvider(
            //         "https://freesound.org/people/kevp888/sounds/797756/download/797756__kevp888__r4_00491_exp01_jurassic_world_alien_planet.wav");

            // Create a SoundPlayer and load the stream.
            // Player = new SoundPlayer(dataProvider);
            // await _player.UpdateAsync(_ => Player);
            // Create a SoundPlayer and load an audio file.
            // Replace "path/to/your/audiofile.wav" with the actual path to your audio file.
            // var player = new SoundPlayer(new StreamDataProvider(File.OpenRead("/Users/ibrahim/Library/Application Support/Plex/Plex Media Server/Sync/2/5/¥$/VULTURES 1/01 - STARS.flac")));

            // Add the player to the master mixer.
            // Mixer.Master.AddComponent(Player);
            // Start playback.
            // _musicPlayer.SoundPlayer = Player;
            // Player.Play();

            // _playback.StartPlayback(player: Player, key: track.Key, ratingKey: track.RatingKey,
            //     Decimal.Round((Decimal)Player.Duration * 1000, MidpointRounding.ToZero),
            //     SoundPlayer, PlaybackPosition);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"An error occurred: {ex.Message}");
        }
    }

    public async ValueTask ResumeAudio()
    {
        Player?.Play();
        _musicPlayer.PlaybackState = SFPlaybackState.Playing;
        await _playback.UnPausePlayback();
    }

    public async ValueTask PauseAudio()
    {
        Player?.Pause();
        _musicPlayer.PlaybackState = SFPlaybackState.Paused;
        await _playback.PausePlayback();
    }

    public async ValueTask Stop()
    {
        Player?.Stop();
        _musicPlayer.PlaybackState = SFPlaybackState.Stopped;
        _musicPlayer.CurrentlyPlayingTrack = null;
        await _playback.StopPlayback();
    }
}