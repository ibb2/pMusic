using System;
using ManagedBass;

namespace pMusic.Interface.Bass;

public class BassFlacBackend : IAudioBackend
{
    private int _stream;

    public void Init(int stream)
    {
        _stream = stream;
    }

    public double GetRawPosition()
    {
        var pos = ManagedBass.Bass.ChannelGetPosition(_stream);
        return ManagedBass.Bass.ChannelBytes2Seconds(_stream, pos);
    }

    public decimal GetPosition()
    {
        var pos = ManagedBass.Bass.ChannelGetPosition(_stream);
        return decimal.Round((decimal)ManagedBass.Bass.ChannelBytes2Seconds(_stream, pos)) * 1000;
    }

    public long GetRawLength()
    {
        var len = ManagedBass.Bass.ChannelGetLength(_stream);
        return len;
    }

    public decimal GetLength()
    {
        var len = ManagedBass.Bass.ChannelGetLength(_stream);
        Console.WriteLine($"Length: {ManagedBass.Bass.ChannelBytes2Seconds(_stream, len) * 1000}");
        return decimal.Round((decimal)ManagedBass.Bass.ChannelBytes2Seconds(_stream, len)) * 1000;
    }

    public void Seek(double seconds)
    {
        var bytes = ManagedBass.Bass.ChannelSeconds2Bytes(_stream, seconds);
        var r = ManagedBass.Bass.ChannelSetPosition(_stream, bytes);
    }

    public bool AdjustVolume(float volume)
    {
        var result = ManagedBass.Bass.ChannelSetAttribute(_stream, ChannelAttribute.Volume, volume);
        return result;
    }

    public PlaybackState GetState()
    {
        return ManagedBass.Bass.ChannelIsActive(_stream);
    }
}