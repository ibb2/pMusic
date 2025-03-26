using SoundFlow.Components;
using SoundFlow.Enums;

namespace pMusic.Helpers;

public class Playback
{
    private readonly Plex _plex;
    private readonly string _baseUri;
    private readonly Mixer _mixer;
    private string _key;
    private string _ratingKey;
    private decimal _duration;
    private Timer _timer;
    private SoundPlayer _player;

    public Playback(Plex plex, string uri, Mixer mixer)
    {
        _plex = plex;
        _baseUri = uri;
        _mixer = mixer;
    }

    public void StartPlayback(SoundPlayer player, string key, string ratingKey, decimal duration)
    {
        _player = player;
        _key = key;
        _ratingKey = ratingKey;
        _duration = duration;

        _timer = new Timer(async _ =>
            await UpdateTimeline("playing"), null, 0, 1000
        );
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
        if (_player.State is PlaybackState.Stopped)
        {
            await _timer.DisposeAsync();
            _mixer.RemoveComponent(_player);
            if (decimal.Round((decimal)_player.Time) / (decimal)_player.Duration * 100 > 90)
                await TrackCompleted(_ratingKey);

            return;
        }

        Console.WriteLine($"Track Progress {_player.Time}");
        var formattedTime = decimal.Round((decimal)_player.Time, MidpointRounding.ToZero) * 1000;
        Console.WriteLine($"Rounded Track Progess {formattedTime}");
        await Task.Delay(1000);
        // await Plex.UpdateTrackProgress(ratingKey: ratingKey, progress: Player.Time);
        await _plex.UpdateSession(uri: _baseUri, key: _key, state: state, ratingKey: _ratingKey, formattedTime,
            duration: _duration);
    }
    
    private async ValueTask TrackCompleted(string ratingKey)
    {
        await _plex.MarkTrackAsPlayed(double.Parse(ratingKey));
    }
}
