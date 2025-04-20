using System;
using ManagedBass;

namespace pMusic.Interface.Bass;

public class BassFlacBackend : IAudioBackend
{
    public decimal GetPosition(int stream)
    {
        var pos = ManagedBass.Bass.ChannelGetPosition(stream);
        Console.WriteLine($"Music Position: {ManagedBass.Bass.ChannelBytes2Seconds(stream, pos) * 1000}");
        return decimal.Round((decimal)ManagedBass.Bass.ChannelBytes2Seconds(stream, pos)) * 1000;
    }

    public decimal GetLength(int stream)
    {
        var len = ManagedBass.Bass.ChannelGetLength(stream);
        Console.WriteLine($"Length: {ManagedBass.Bass.ChannelBytes2Seconds(stream, len) * 1000}");
        return decimal.Round((decimal)ManagedBass.Bass.ChannelBytes2Seconds(stream, len)) * 1000;
    }

    public PlaybackState GetState(int stream)
    {
        return ManagedBass.Bass.ChannelIsActive(stream);
    }
}