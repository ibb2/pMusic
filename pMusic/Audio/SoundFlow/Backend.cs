using ManagedBass;
using pMusic.Interface;
using SoundFlow.Abstracts.Devices;
using SoundFlow.Backends.MiniAudio;
using SoundFlow.Backends.MiniAudio.Devices;
using SoundFlow.Enums;
using SoundFlow.Structs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using DeviceInfo = SoundFlow.Structs.DeviceInfo;
using PlaybackState = ManagedBass.PlaybackState;

namespace pMusic.Audio.SoundFlow;

public class Backend : IAudioBackend
{

    private MiniAudioEngine? _audioEngine;
    private DeviceInfo _defaultPlaybackDevice;
    private AudioPlaybackDevice _device;

    void IAudioBackend.Init(int stream)
    {
        _audioEngine = new MiniAudioEngine();
        _defaultPlaybackDevice = _audioEngine.PlaybackDevices.FirstOrDefault(d => d.IsDefault);
        var audioFormat = AudioFormat.StudioHq;

        _device = _audioEngine.InitializePlaybackDevice(_defaultPlaybackDevice, audioFormat);
    }

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

    void IAudioBackend.Seek(double pos)
    {
        throw new NotImplementedException();
    }

}
