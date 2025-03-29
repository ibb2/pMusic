using KeySharp;
using pMusic.Helpers;
using pMusic.Services;

namespace pMusic.Presentation;

public partial record TrackModel(IArtistService ArtistService, IAudioPlayerService AudioPlayerService, Plex Plex)
{
    public string Title { get; set; }

    public IState<Album> CurrentAlbum => State<Album>.Empty(this);

    public async ValueTask SetCurrentAlbum(Album album)
    {
        await CurrentAlbum.UpdateAsync(_ => album);
    }

    public IListFeed<Track> Tracks => CurrentAlbum.SelectAsync(async (album, ct) =>
    {
        var trackList = await ArtistService.GetTrackList(ct, Plex, album.RatingKey);
        return trackList;
    }).AsListFeed().Selection(SelectedTrack);

    public IState<Track> SelectedTrack => State<Track>.Empty(this);

    public void PlayTrack(Track selectedTrack)
    {
        var authToken = Keyring.GetPassword("com.ib.pmusic", "pMusic", "authToken");
        var baseUri = ArtistService.GetServerUri();
        var uri = baseUri + selectedTrack.Media.Part.Key;
        AudioPlayerService.PlayAudio(uri: uri, baseUri:baseUri, ratingKey: selectedTrack.RatingKey, key: selectedTrack.Key);
    }

    public void PauseTrack()
    {
        AudioPlayerService.PauseAudio();
    }
}
