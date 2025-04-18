using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Collections.ObjectModel;
using System.Threading;
using System.Threading.Tasks;
using pMusic.Models;

namespace pMusic.Services;

public interface IMusic
{
    // ValueTask<ObservableCollection<Artist>> GetArtistsAsync(CancellationToken ct, Plex plex);
    // ValueTask<ObservableCollection<Album>> GetArtistAlbums(CancellationToken ct, Plex plex, int libraryId, string artistKey, string artistTitle);
    ValueTask<IImmutableList<Track>> GetTrackList(CancellationToken ct, Plex plex, string artistKey, string artist);
    ValueTask<ImmutableList<Playlist>> GetPlaylists(CancellationToken ct, Plex plex, bool loaded = false);
    ValueTask<IImmutableList<Album>> GetAllAlbums(CancellationToken ct, Plex plex, bool loaded = false);
    ValueTask<string> GetServerUri(CancellationToken ct, Plex plex);
}

public class Music : IMusic
{
    public string? ServerUri { get; set; }
    // public async ValueTask<ObservableCollection<Artist>> GetArtistsAsync(CancellationToken ct, Plex plex)
    // {
    //     await Task.Delay(TimeSpan.FromSeconds(1), ct);
    //
    //     var artists = await plex.GetArtists(ServerUri);
    //
    //     return artists;
    // }

    // public async ValueTask<ObservableCollection<Album>> GetArtistAlbums(CancellationToken ct, Plex plex, int libraryId, string artistKey, string artistTitle)
    // {
    //     await Task.Delay(TimeSpan.FromSeconds(1), ct);
    //
    //     var albums = await plex.GetArtistAlbums(ServerUri!, libraryId, artistKey, artistTitle);
    //
    //     var temp = ImmutableArray<Album>.Empty;
    //     return albums;
    // }    
    //
    public async ValueTask<IImmutableList<Track>> GetTrackList(CancellationToken ct, Plex plex, string artistKey,
        string artist)
    {
        await Task.Delay(TimeSpan.FromSeconds(1), ct);

        var serverUri = await plex.GetServerCapabilitiesAsync();
        var albums = await plex.GetTrackList(serverUri!, artistKey, artist);

        return albums;
    }

    public async ValueTask<ImmutableList<Playlist>> GetPlaylists(CancellationToken ct, Plex plex, bool loaded = false)
    {
        await Task.Delay(TimeSpan.FromSeconds(1), ct);

        ServerUri = await plex.GetServerCapabilitiesAsync();

        var playlists = await plex.GetPlaylists(ServerUri!, loaded);

        return playlists.ToImmutableList();
    }

    public async ValueTask<IImmutableList<Album>> GetAllAlbums(CancellationToken ct, Plex plex, bool loaded = false)
    {
        await Task.Delay(TimeSpan.FromSeconds(1), ct);

        var serverUri = await plex.GetServerCapabilitiesAsync();
        var albums = await plex.GetAllAlbums(serverUri, loaded);

        ServerUri = serverUri;

        return albums;
    }


    public async ValueTask<string> GetServerUri(CancellationToken ct, Plex plex)
    {
        ServerUri = await plex.GetServerCapabilitiesAsync();

        return ServerUri;
    }
}