using ManagedBass;

namespace pMusic.Interface;

public interface IAudioBackend
{
    long GetPosition(int stream);
    long GetLength(int stream);

    PlaybackState GetState(int stream);
}