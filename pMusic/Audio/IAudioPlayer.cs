using System.Threading.Tasks;
using pMusic.Models;
using pMusic.Services;

namespace pMusic.Interface;

public interface IAudioPlayer
{
    bool Initialize(Plex plex, MusicPlayer musicPlayer, IAudioBackend audioBackend);
    bool Play(Track track, string url, string serverUrl);
    ValueTask<bool> Pause();
    ValueTask<bool> Resume();
    void Stop();
    void Dispose();
}