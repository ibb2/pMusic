using pMusic.Interface.Bass;

namespace pMusic.Interface;

public class AudioBackendFactory
{
    public IAudioBackend Create(string type)
    {
        var backend = new BassFlacBackend();
        return backend;
    }
}