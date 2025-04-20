using ManagedBass;

namespace pMusic.Interface.Bass;

public class BassFlacBackend : IAudioBackend
{
    public long GetPosition(int stream)
    {
        return ManagedBass.Bass.ChannelGetPosition(stream);
    }

    public long GetLength(int stream)
    {
        return ManagedBass.Bass.ChannelGetLength(stream);
    }

    public PlaybackState GetState(int stream)
    {
        return ManagedBass.Bass.ChannelIsActive(stream);
    }
}