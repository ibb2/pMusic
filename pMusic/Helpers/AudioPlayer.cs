using KeySharp;
using SoundFlow.Abstracts;
using SoundFlow.Backends.MiniAudio;
using SoundFlow.Components;
using SoundFlow.Enums;
using SoundFlow.Providers;

namespace pMusic.Helpers;

public class AudioPlayer
{
    
    // private static readonly AudioEngine Engine = new MiniAudioEngine(44100, Capability.Playback);
    public readonly HttpClient httpClient;
    private readonly string _plexToken = Keyring.GetPassword("com.ib.pmusic", "pMusic", "authToken");
    
    public AudioPlayer(HttpClient httpClient)
    {
        this.httpClient = httpClient;
        this.httpClient.DefaultRequestHeaders.Add("X-Plex-Token", _plexToken);
    }
    
    public SoundPlayer? Player { get; set; }

    public async Task PlayAudio(string uri)
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

            // Keep the console application running until playback finishes or the user presses a key.
            Console.WriteLine("Playing audio... Press any key to stop.");
            Console.ReadKey();

            // Stop playback.
            Player.Stop();

            // Remove the player from the mixer.
            Mixer.Master.RemoveComponent(Player);
            
        }
        catch (Exception ex)
        {
            Console.WriteLine($"An error occurred: {ex.Message}");
        }
    }

    public void PauseAudio()
    {
        Player?.Pause();
    }
}
