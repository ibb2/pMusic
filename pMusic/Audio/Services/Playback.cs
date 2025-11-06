using System.Threading;
using System.Threading.Tasks;
using pMusic.Interface;
using pMusic.Models;
using SoundFlow.Enums;

namespace pMusic.Services;

public class Playback
{
    private readonly IAudioBackend _audioBackend;
    private readonly MusicPlayer _musicPlayer;
    private readonly Plex _plex;
    private string _serverUrl;
    private int _stream;
    private Timer _timer;
    private Track _track;

    public Playback(Plex plex, MusicPlayer musicPlayer, IAudioBackend audioBackend)
    {
        _plex = plex;
        _musicPlayer = musicPlayer;
        _audioBackend = audioBackend;
    }

    public void StartPlayback(Track track, string serverUrl, int stream)
    {
        _track = track;
        _serverUrl = serverUrl;

        _musicPlayer.PlaybackState = PlaybackState.Playing;
        _musicPlayer.Stream = stream;
        _stream = stream;

        _timer = new Timer(async _ =>
            {
                await UpdateTimeline("playing");
                _musicPlayer.Position = _audioBackend.GetRawPosition();
            }, null, 0, 1000
        );
    }

    public async ValueTask UnPausePlayback()
    {
        _timer.Change(0, 1000);
        await UpdateTimeline("playing");
    }

    //
    public async ValueTask PausePlayback()
    {
        _timer.Change(Timeout.Infinite, Timeout.Infinite);
        await UpdateTimeline("paused");
    }
    //
    // public async ValueTask StopPlayback()
    // {
    //     await _timer.DisposeAsync();
    //     await UpdateTimeline("paused");
    // }

    private async Task UpdateTimeline(string state)
    {
        var playerPosition = _audioBackend.GetPosition();
        var trackDuration = _audioBackend.GetLength();

        var bassState = _audioBackend.GetState();

        if (bassState is ManagedBass.PlaybackState.Stopped)
        {
            await _timer.DisposeAsync();
            if (playerPosition / (decimal)_musicPlayer.Duration * 100 > 90)
                await TrackCompleted(_track.RatingKey);

            return;
        }

        await Task.Delay(1000);
        await _plex.UpdateSession(_serverUrl, _track.Key, state, _track.RatingKey, playerPosition,
            trackDuration);
    }

    private async ValueTask TrackCompleted(string ratingKey)
    {
        await _plex.MarkTrackAsPlayed(double.Parse(ratingKey));
    }
}