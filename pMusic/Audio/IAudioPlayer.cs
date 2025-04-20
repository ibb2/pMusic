using pMusic.Models;
using pMusic.Services;

namespace pMusic.Interface;

public interface IAudioPlayer
{
    bool Initialize(Plex plex, MusicPlayer musicPlayer, IAudioBackend audioBackend);
    bool Play(Track track, string url);
    bool Pause();
    void Stop();
    void Dispose();
}