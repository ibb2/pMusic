using KeySharp;
using SoundFlow.Abstracts;
using SoundFlow.Backends.MiniAudio;
using SoundFlow.Components;
using SoundFlow.Enums;
using SoundFlow.Providers;

namespace pMusic.Helpers;

public class AudioPlayer
{
    public readonly Plex? Plex;

    private static AudioEngine _audioEngine;
    public readonly HttpClient httpClient;
    private readonly string _plexToken = Keyring.GetPassword("com.ib.pmusic", "pMusic", "authToken");

    public AudioPlayer(HttpClient httpClient, Plex plex)
    {
        Plex = plex;
        this.httpClient = httpClient;
        this.httpClient.DefaultRequestHeaders.Add("X-Plex-Token", _plexToken);
    }

    public SoundPlayer? Player { get; set; }
    private Playback _playback;

    public async Task PlayAudio(string uri, string baseUri, string ratingKey, string key)
    {
        try
        {
            _playback = new Playback(plex: Plex, uri: baseUri, mixer: Mixer.Master );

            // Initialize the audio engine with the MiniAudio backend.
            _audioEngine = new MiniAudioEngine(44100, Capability.Playback);

            using var response = await httpClient.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead);
            response.EnsureSuccessStatusCode();
            await using var httpStream = await response.Content.ReadAsStreamAsync();

            // Copy to MemoryStream
            var memoryStream = new MemoryStream();
            await httpStream.CopyToAsync(memoryStream);

            // Create a SoundPlayer and load the stream.
            Player = new SoundPlayer(new StreamDataProvider(memoryStream));

            // Create a SoundPlayer and load an audio file.
            // Replace "path/to/your/audiofile.wav" with the actual path to your audio file.
            // var player = new SoundPlayer(new StreamDataProvider(File.OpenRead("/Users/ibrahim/Library/Application Support/Plex/Plex Media Server/Sync/2/5/¥$/VULTURES 1/01 - STARS.flac")));

            // Add the player to the master mixer.
            Mixer.Master.AddComponent(Player);

            // Start playback.
            Player.Play();
            var decimalRoundedAndMills = Decimal.Round((Decimal)Player.Duration * 1000, MidpointRounding.ToZero);
            _playback.StartPlayback(player: Player, key: key, ratingKey: ratingKey, decimalRoundedAndMills);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"An error occurred: {ex.Message}");
        }
    }

    public async ValueTask PauseAudio()
    {
        Player?.Pause();
        await _playback.PausePlayback();
    }

    public async ValueTask Stop()
    {
        Player?.Stop();
        await _playback.StopPlayback();
    }
}
