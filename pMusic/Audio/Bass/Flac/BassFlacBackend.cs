using System;
using ManagedBass;

namespace pMusic.Interface.Bass;

public class BassFlacBackend : IAudioBackend
{
    private int _stream;

    public double GetRawPosition(int stream)
    {
        var pos = ManagedBass.Bass.ChannelGetPosition(stream);
        return ManagedBass.Bass.ChannelBytes2Seconds(stream, pos);
    }

    public decimal GetPosition(int stream)
    {
        _stream = stream;
        var pos = ManagedBass.Bass.ChannelGetPosition(stream);
        return decimal.Round((decimal)ManagedBass.Bass.ChannelBytes2Seconds(stream, pos)) * 1000;
    }

    public long GetRawLength(int stream)
    {
        var len = ManagedBass.Bass.ChannelGetLength(stream);
        return len;
    }

    public decimal GetLength(int stream)
    {
        var len = ManagedBass.Bass.ChannelGetLength(stream);
        Console.WriteLine($"Length: {ManagedBass.Bass.ChannelBytes2Seconds(stream, len) * 1000}");
        return decimal.Round((decimal)ManagedBass.Bass.ChannelBytes2Seconds(stream, len)) * 1000;
    }

    public void Seek(double seconds)
    {
        var bytes = ManagedBass.Bass.ChannelSeconds2Bytes(_stream, seconds);
        var r = ManagedBass.Bass.ChannelSetPosition(_stream, bytes);
    }

    public PlaybackState GetState(int stream)
    {
        return ManagedBass.Bass.ChannelIsActive(stream);
    }
}