using ManagedBass;

namespace pMusic.Interface;

public interface IAudioBackend
{
    decimal GetPosition(int stream);
    decimal GetLength(int stream);

    PlaybackState GetState(int stream);
}