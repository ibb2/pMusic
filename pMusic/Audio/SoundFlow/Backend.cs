using ManagedBass;
using pMusic.Interface;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace pMusic.Audio.SoundFlow;

public class Backend : IAudioBackend
{
    bool IAudioBackend.AdjustVolume(float volume)
    {
        throw new NotImplementedException();
    }

    decimal IAudioBackend.GetLength()
    {
        throw new NotImplementedException();
    }

    decimal IAudioBackend.GetPosition()
    {
        throw new NotImplementedException();
    }

    long IAudioBackend.GetRawLength()
    {
        throw new NotImplementedException();
    }

    double IAudioBackend.GetRawPosition()
    {
        throw new NotImplementedException();
    }

    PlaybackState IAudioBackend.GetState()
    {
        throw new NotImplementedException();
    }

    void IAudioBackend.Init(int stream)
    {
        throw new NotImplementedException();
    }

    void IAudioBackend.Seek(double pos)
    {
        throw new NotImplementedException();
    }
}
