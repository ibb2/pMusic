using System;
using System.Threading;
using System.Threading.Tasks;
using pMusic.Models;
using SoundFlow.Components;
using SoundFlow.Enums;

namespace pMusic.Services;

public class Playback
{
    private readonly MusicPlayer _musicPlayer;
    private readonly Plex _plex;
    private string _url;
    private int _stream;
    private Timer _timer;
    private Track _track;

    public Playback(Plex plex, MusicPlayer musicPlayer)
    {
        _plex = plex;
        _musicPlayer = musicPlayer;
    }

    public void StartPlayback(Track track, string url, int stream)
    {
        _track = track;
        _url = url;

        _musicPlayer.Position = 0;
        _musicPlayer.PlaybackState = PlaybackState.Playing;

        _stream = stream;

        var player = ManagedBass.Bass.ChannelGetPosition(stream);

        _timer = new Timer(async _ =>
            {
                await UpdateTimeline("Playing");
                var formattedTime = decimal.Round(player);
                _musicPlayer.Position = (float)formattedTime;
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
        var playerPosition = ManagedBass.Bass.ChannelGetPosition(_stream);
        var playerTimeRounded = decimal.Round(playerPosition);
        var trackDuration = ManagedBass.Bass.ChannelGetLength(_stream);

        if (_musicPlayer.MPlaybackState is ManagedBass.PlaybackState.Stopped)
        {
            await _timer.DisposeAsync();
            if (playerTimeRounded / _musicPlayer.Duration * 100 > 90)
                await TrackCompleted(_track.RatingKey);

            return;
        }

        var playerTimeRoundedMillseconds = playerTimeRounded * 1000;
        await Task.Delay(1000);
        await _plex.UpdateSession(_url, _track.Key, state, _track.RatingKey, playerTimeRoundedMillseconds,
            trackDuration);
    }

    private async ValueTask TrackCompleted(string ratingKey)
    {
        await _plex.MarkTrackAsPlayed(double.Parse(ratingKey));
    }
}