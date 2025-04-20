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
    private int _stream;
    private Timer _timer;
    private Track _track;
    private string _url;

    public Playback(Plex plex, MusicPlayer musicPlayer, IAudioBackend audioBackend)
    {
        _plex = plex;
        _musicPlayer = musicPlayer;
        _audioBackend = audioBackend;
    }

    public void StartPlayback(Track track, string url, int stream)
    {
        _track = track;
        _url = url;

        _musicPlayer.PlaybackState = PlaybackState.Playing;

        _stream = stream;

        var position = _audioBackend.GetPosition(stream);

        _timer = new Timer(async _ =>
            {
                await UpdateTimeline("Playing");
                _musicPlayer.Position = (float)decimal.Round(position);
            }, null, 0, 1000
        );
    }

    public async ValueTask UnPausePlayback()
    {
        _timer.Change(0, 1000);
        await UpdateTimeline("playing");
    }

    public async ValueTask PausePlayback()
    {
        _timer.Change(Timeout.Infinite, Timeout.Infinite);
        await UpdateTimeline("paused");
    }

    public async ValueTask StopPlayback()
    {
        await _timer.DisposeAsync();
        await UpdateTimeline("paused");
    }

    private async Task UpdateTimeline(string state)
    {
        var playerPosition = _audioBackend.GetPosition(_stream);
        var playerTimeRounded = decimal.Round(playerPosition);
        var trackDuration = _audioBackend.GetLength(_stream);

        var bassState = _audioBackend.GetState(_stream);

        if (bassState is ManagedBass.PlaybackState.Stopped)
        {
            await _timer.DisposeAsync();
            if (playerTimeRounded / _musicPlayer.Duration * 100 > 90)
                await TrackCompleted(_track.RatingKey);

            return;
        }

        await Task.Delay(1000);
        await _plex.UpdateSession(_url, _track.Key, state, _track.RatingKey, playerTimeRounded,
            trackDuration);
    }

    private async ValueTask TrackCompleted(string ratingKey)
    {
        await _plex.MarkTrackAsPlayed(double.Parse(ratingKey));
    }
}