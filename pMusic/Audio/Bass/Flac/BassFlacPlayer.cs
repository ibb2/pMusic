using System;
using System.Threading.Tasks;
using Avalonia.Threading;
using KeySharp;
using ManagedBass;
using ManagedBass.Flac;
using pMusic.Models;
using pMusic.Services;

namespace pMusic.Interface.Bass;

public class BassFlacPlayer : IAudioPlayer
{
    private IAudioBackend _audioBackend;
    private SyncProcedure _endSync;
    private bool _isEndHandled = false;
    private MusicPlayer _musicPlayer;
    private Playback _playback;
    private Plex _plex;
    private int _stream;

    // Other methods remain the same...

    public bool Initialize(Plex plex, MusicPlayer musicPlayer, IAudioBackend audioBackend)
    {
        _plex = plex;
        _musicPlayer = musicPlayer;
        _audioBackend = audioBackend;
        _playback = new Playback(plex, musicPlayer, audioBackend);
        return ManagedBass.Bass.Init();
    }

    public bool Play(Track track, string url, string serverUrl)
    {
        // Reset the end handled flag
        _isEndHandled = false;

        // Create a stream.
        var filePath = url + "?X-Plex-Token=" + Keyring.GetPassword("com.ib", "pmusic", "authToken");

        _stream =
            BassFlac.CreateStream(
                filePath, 0, BassFlags.Default, null);

        if (_stream == 0)
        {
            Console.WriteLine("Failed to create FLAC stream.");
            return false;
        }

        _audioBackend.Init(_stream);
        ManagedBass.Bass.ChannelIsActive(_stream);

        // Set MusicPlayer information (Accessible in UI)
        _musicPlayer.Position = 0;
        _musicPlayer.Duration =
            ManagedBass.Bass.ChannelBytes2Seconds(_stream, ManagedBass.Bass.ChannelGetLength(_stream));
        _musicPlayer.MPlaybackState = PlaybackState.Playing;
        _musicPlayer.IsPlaying = true;
        _musicPlayer.Track = track;
        _musicPlayer.AudioBackend = _audioBackend;

        var play = ManagedBass.Bass.ChannelPlay(_stream);

        // Register sync callback with additional flags for reliability
        _endSync = EndSync;
        var syncResult = ManagedBass.Bass.ChannelSetSync(
            _stream,
            SyncFlags.End | SyncFlags.Mixtime, // Use Mixtime for more reliable callbacks
            0,
            _endSync,
            IntPtr.Zero);

        if (syncResult == 0)
        {
            Console.WriteLine($"Failed to set sync: {ManagedBass.Bass.LastError}");
        }

        _playback.StartPlayback(track, serverUrl, _stream);
        return play;
    }

    public async ValueTask<bool> Pause()
    {
        var playState = ManagedBass.Bass.ChannelPause(_stream);
        _musicPlayer.MPlaybackState = PlaybackState.Paused;
        _musicPlayer.IsPlaying = false;
        await _playback.PausePlayback();
        return playState;
    }

    public async ValueTask<bool> Resume()
    {
        var playState = ManagedBass.Bass.ChannelPlay(_stream);
        _musicPlayer.MPlaybackState = PlaybackState.Playing;
        _musicPlayer.IsPlaying = true;
        await _playback.UnPausePlayback();
        return playState;
    }

    public void Stop()
    {
        // Make sure we don't trigger the end sync during manual stop
        _isEndHandled = true;
        var stopped = ManagedBass.Bass.ChannelStop(_stream);
        _musicPlayer.MPlaybackState = PlaybackState.Stopped;
    }

    public void Dispose()
    {
        // Prevent further callbacks
        _isEndHandled = true;

        // Free the stream if it exists
        if (_stream != 0)
        {
            ManagedBass.Bass.StreamFree(_stream);
            _stream = 0;
        }

        ManagedBass.Bass.Free();
    }

    private void CleanupSyncAndTimer()
    {
    }

    private void EndSync(int handle, int channel, int data, IntPtr user)
    {
        // Avoid multiple handlers for the same end event
        if (_isEndHandled) return;
        _isEndHandled = true;

        Console.WriteLine("EndSync called - Stream has ended naturally");

        // Execute on main thread to avoid threading issues
        Dispatcher.UIThread.Post(() =>
        {
            try
            {
                // Clean up current stream before moving to next track
                if (_stream != 0)
                {
                    ManagedBass.Bass.StreamFree(_stream);
                    _stream = 0;
                }

                // Then proceed to next track
                _musicPlayer.NextTrack();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in EndSync handler: {ex.Message}");
            }
        });
    }
}