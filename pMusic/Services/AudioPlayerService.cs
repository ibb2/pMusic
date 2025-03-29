using KeySharp;
using SoundFlow.Abstracts;
using SoundFlow.Backends.MiniAudio;
using SoundFlow.Components;
using SoundFlow.Enums;
using SoundFlow.Providers;

namespace pMusic.Helpers;

public interface IAudioPlayerService
{
    public IState<bool> IsPlaying { get; }
    public IState<SoundPlayer?> AudioPlayer { get; }
    ValueTask PlayAudio(string uri, string baseUri, string ratingKey, string key);
    ValueTask PauseAudio();
    ValueTask ResumeAudio();
    ValueTask Stop();
}

public class AudioPlayerService: IAudioPlayerService
{
    private readonly IState<bool> _isPlaying;
    private readonly IState<SoundPlayer?> _player;
    private readonly Plex _plex;
    private readonly string _plexToken = Keyring.GetPassword("com.ib.pmusic", "pMusic", "authToken");
    
    private static AudioEngine? _audioEngine;

    private Playback _playback;
    
    public AudioPlayerService(Plex plex)
    {
        _plex = plex;

        // Initialize the state with default value (false = not playing)
        _isPlaying = State<bool>.Value(this, () => false);
    }

    public IState<bool> IsPlaying => _isPlaying;
    public IState<SoundPlayer?> AudioPlayer => _player;
    
    public SoundPlayer? Player { get; set; }
    


    public async ValueTask PlayAudio(string uri, string baseUri, string ratingKey, string key)
    {
        try
        {
            _playback = new Playback(plex: _plex, uri: baseUri, mixer: Mixer.Master);

            // Initialize the audio engine with the MiniAudio backend.
            if (_audioEngine is null) _audioEngine = new MiniAudioEngine(44100, Capability.Playback);

            var url = await _plex.GetPlaybackStreamUrl(uri);

            // Create a SoundPlayer and load the stream.
            Player = new SoundPlayer(new StreamDataProvider(url));
            // await _player.UpdateAsync(_ => Player);
            // Create a SoundPlayer and load an audio file.
            // Replace "path/to/your/audiofile.wav" with the actual path to your audio file.
            // var player = new SoundPlayer(new StreamDataProvider(File.OpenRead("/Users/ibrahim/Library/Application Support/Plex/Plex Media Server/Sync/2/5/¥$/VULTURES 1/01 - STARS.flac")));

            // Add the player to the master mixer.
            Mixer.Master.AddComponent(Player);

            // Start playback.
            Player.Play();
            await _isPlaying.UpdateAsync(_ => true);
            var decimalRoundedAndMills = Decimal.Round((Decimal)Player.Duration * 1000, MidpointRounding.ToZero);
            _playback.StartPlayback(player: Player, key: key, ratingKey: ratingKey, decimalRoundedAndMills);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"An error occurred: {ex.Message}");
        }
    }

    public async ValueTask ResumeAudio()
    {
        Player?.Play();
        await _player.UpdateAsync(_ => Player);
        await _isPlaying.UpdateAsync(_ => true);
        await _playback.UnPausePlayback();
    }

    public async ValueTask PauseAudio()
    {
        Player?.Pause();
        await _isPlaying.UpdateAsync(_ => false);
        await _playback.PausePlayback();
    }

    public async ValueTask Stop()
    {
        Player?.Stop();
        await _isPlaying.UpdateAsync(_ => false);
        await _playback.StopPlayback();
    }
}
