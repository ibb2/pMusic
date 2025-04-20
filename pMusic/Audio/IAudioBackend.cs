using ManagedBass;

namespace pMusic.Interface;

public interface IAudioBackend
{
    double GetRawPosition(int stream);
    decimal GetPosition(int stream);
    long GetRawLength(int stream);
    decimal GetLength(int stream);
    void Seek(double pos);
    PlaybackState GetState(int stream);
}