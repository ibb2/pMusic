using pMusic.Interface;
using pMusic.Models;
using pMusic.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace pMusic.Audio.SoundFlow;

public class Player : IAudioPlayer
{
    void IAudioPlayer.Dispose()
    {
        throw new NotImplementedException();
    }

    bool IAudioPlayer.Initialize(Plex plex, MusicPlayer musicPlayer, IAudioBackend audioBackend)
    {
        throw new NotImplementedException();
    }

    ValueTask<bool> IAudioPlayer.Pause()
    {
        throw new NotImplementedException();
    }

    bool IAudioPlayer.Play(Track track, string url, string serverUrl)
    {
        throw new NotImplementedException();
    }

    ValueTask<bool> IAudioPlayer.Resume()
    {
        throw new NotImplementedException();
    }

    void IAudioPlayer.Stop()
    {
        throw new NotImplementedException();
    }
}

