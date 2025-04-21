using ManagedBass;

namespace pMusic.Interface;

public interface IAudioBackend
{
    void Init(int stream);
    double GetRawPosition();
    decimal GetPosition();
    long GetRawLength();
    decimal GetLength();
    void Seek(double pos);
    bool AdjustVolume(float volume);
    PlaybackState GetState();
}