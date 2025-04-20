using pMusic.Interface.Bass;

namespace pMusic.Interface;

public class AudioBackendFactory
{
    public IAudioBackend Create(string backend)
    {
        return new BassFlacBackend();
    }
}