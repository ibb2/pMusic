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

    // private static readonly AudioEngine Engine = new MiniAudioEngine(44100, Capability.Playback);
    public readonly HttpClient httpClient;
    private readonly string _plexToken = Keyring.GetPassword("com.ib.pmusic", "pMusic", "authToken");

    public AudioPlayer(HttpClient httpClient, Plex plex)
    {
        Plex = plex;
        this.httpClient = httpClient;
        this.httpClient.DefaultRequestHeaders.Add("X-Plex-Token", _plexToken);
    }

    public SoundPlayer? Player { get; set; }

    public async Task PlayAudio(string uri, string baseUri, string ratingKey, string key)
    {
        try
        {
            // Replace "your-audio-stream-url" with the actual URL of an audio stream (e.g., an internet radio station).
            // var stream = await httpClient.GetStreamAsync("");

            // Initialize the audio engine with the MiniAudio backend.
            using var audioEngine = new MiniAudioEngine(44100, Capability.Playback);

            using var response = await httpClient.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead);
            response.EnsureSuccessStatusCode();
            using var httpStream = await response.Content.ReadAsStreamAsync();

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

            await Plex.CreateSession(uri: baseUri, key: key, ratingKey: ratingKey, duration: (Decimal)Player.Duration * 1000);

            while (Player.State is PlaybackState.Playing) 
            {
                await UpdateProgress(baseUri, ratingKey, key);
            }

            // Stop playback.
            Player.Stop();
            await Plex.UpdateSession(baseUri, key, "paused", ratingKey, (Decimal)Player.Time * 1000, (Decimal)Player.Duration * 1000);
            if (Decimal.Round((Decimal)Player.Time) / (Decimal)Player.Duration * 100 > 90)
                await TrackCompleted(ratingKey);

            // Remove the player from the mixer.
            Mixer.Master.RemoveComponent(Player);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"An error occurred: {ex.Message}");
        }
    }

    public async ValueTask UpdateProgress(string uri, string key, string ratingKey)
    {
        var duration = (decimal)Player.Duration;
        Console.WriteLine($"Duration {duration}");

        for (int i = 0; i < Decimal.Round(duration); i++)
        {
            Console.WriteLine($"Track Progress {Player.Time}");
            var formattedTime = Decimal.Round((Decimal)Player.Time, MidpointRounding.ToZero) * 1000;
            Console.WriteLine($"Rounded Track Progess {formattedTime}");
            await Task.Delay(1000);
            // await Plex.UpdateTrackProgress(ratingKey: ratingKey, progress: Player.Time);
            await Plex.UpdateSession(uri: uri, key: key, state: "playing", ratingKey: ratingKey,  formattedTime, duration:duration);
        }
    }

    public void PauseAudio()
    {
        Player?.Pause();
    }

    public async ValueTask TrackCompleted(string ratingKey)
    {
        await Plex.MarkTrackAsPlayed(double.Parse(ratingKey));
    }
}
