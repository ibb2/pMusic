using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web;
using System.Xml.Linq;
using Avalonia.Controls;
using Avalonia.Media.Imaging;
using KeySharp;
using LukeHagar.PlexAPI.SDK;
using LukeHagar.PlexAPI.SDK.Models.Requests;
using pMusic.Database;
using pMusic.Models;
using Country = pMusic.Models.Country;
using Genre = pMusic.Models.Genre;
using Image = pMusic.Models.Image;
using Media = pMusic.Models.Media;
using Part = pMusic.Models.Part;
using UltraBlurColors = pMusic.Models.UltraBlurColors;


namespace pMusic.Services;

public class Plex
{
    public readonly HttpClient httpClient;
    private readonly MusicDbContext _musicDbContext;
    private readonly string _plexClientIdentifier;
    private string _plexToken;
    private string _plexId;

    private static string _plexSessionIdentifier;

    private static readonly string _plexProduct = "pMusic";
    private static readonly string _plexDeviceName = "Desktop";
    private static readonly string _plexPlatform = "Desktop";

    private PlexAPI? _plexApi;


    public Plex(HttpClient httpClient, MusicDbContext musicDbContext)
    {
        this.httpClient = httpClient;
        _musicDbContext = musicDbContext;
        _plexClientIdentifier = GetOrCreateClientIdentifier();
        try
        {
            _plexToken = Keyring.GetPassword("com.ib.pmusic", "pMusic", "authToken");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error retrieving token: {ex.Message}");
            return;
        }

        try
        {
            _plexSessionIdentifier = Keyring.GetPassword("com.ib.pmusic", "pMusic", "cIdentifier");
        }
        catch (KeyringException ex)
        {
            _plexClientIdentifier = Guid.NewGuid().ToString();
        }

        this.httpClient.DefaultRequestHeaders.Add("X-Plex-Token", _plexToken);
        this.httpClient.DefaultRequestHeaders.Add("X-Plex-Client-Identifier", _plexClientIdentifier);
        this.httpClient.DefaultRequestHeaders.Add("X-Plex-Session-Identifier", _plexSessionIdentifier);
        this.httpClient.DefaultRequestHeaders.Add("X-Plex-Product", _plexProduct);
        this.httpClient.DefaultRequestHeaders.Add("X-Plex-Device-Name", _plexDeviceName);
        this.httpClient.DefaultRequestHeaders.Add("X-Plex-Platform", _plexPlatform);
    }

    private string GetOrCreateClientIdentifier()
    {
        var clientIdentifier = "";
        try
        {
            clientIdentifier = Keyring.GetPassword("com.ib.pmusic", "pMusic", "cIdentifier");
        }
        catch (KeyringException ex)
        {
            Console.WriteLine("Cannot find Client Identifier");
        }

        if (clientIdentifier.Length > 0)
        {
            return clientIdentifier;
        }

        // Initial Setup create the Client Identifier and store for later use
        var guid = Guid.NewGuid().ToString();
        clientIdentifier = guid;
        Keyring.SetPassword("com.ib.pmusic", "pMusic", "cIdentifier", guid);

        return clientIdentifier;
    }

    public async ValueTask<(string id, string code)> GeneratePin()
    {
        var plexPinUri = new Uri("https://plex.tv/api/v2/pins");

        var contents = new FormUrlEncodedContent([
            new KeyValuePair<string, string>("strong", "true"),
            new KeyValuePair<string, string>("X-Plex-Product", "pMusic"),
            new KeyValuePair<string, string>("X-Plex-Client-Identifier", _plexClientIdentifier)
        ]);

        var results = await httpClient.PostAsync(plexPinUri, contents);

        var id = "";
        var code = "";

        if (results.IsSuccessStatusCode)
        {
            var responseBody = results.Content.ReadAsStringAsync().Result;
            var incomingXml = XElement.Parse(responseBody);

            id = incomingXml.Attribute("id").ToString().Split('"')[1];
            code = incomingXml.Attribute("code").ToString().Split('"')[1];

            Keyring.SetPassword("com.ib.pmusic", "pMusic", "id", id);
            Keyring.SetPassword("com.ib.pmusic", "pMusic", "code", code);

            Console.WriteLine("Successfully generated pin");
        }
        else
        {
            Console.WriteLine("Failed to get generated pin");
        }

        _plexId = id;

        return (id, code);
    }

    public async ValueTask<Uri> CheckPin(string code)
    {
        var queryParams = new Dictionary<string, string>
        {
            { "clientID", _plexClientIdentifier },
            { "code", code },
            // { "forwardUrl", "https://localhost" },
            { "context[device][product]", "pMusic" } // Flattened for URL encoding
        };

        // HttpUtility.UrlPathEncode(queryParams);
        static string EncodeFormUrlEncoded(Dictionary<string, string> data)
        {
            var keyValuePairs = new List<string>();
            foreach (var item in data)
            {
                keyValuePairs.Add($"{HttpUtility.UrlEncode(item.Key)}={HttpUtility.UrlEncode(item.Value)}");
            }

            return string.Join("&", keyValuePairs);
        }

        var encodedValues = EncodeFormUrlEncoded(queryParams);

        var authAppUrl = new Uri(
                "https://app.plex.tv/auth#?" + encodedValues)
            ;

        return authAppUrl;
    }

    public async ValueTask PollPin(string id, string code)
    {
        var isPinPolling = true;
        string? authToken = null;

        do
        {
            var plexPinPoll =
                new Uri(
                    $"https://plex.tv/api/v2/pins/{id}?code={Uri.EscapeDataString(code)}&X-Plex-Client-Identifier={Uri.EscapeDataString(_plexClientIdentifier)}");
            var pinResults = await httpClient.GetStringAsync(plexPinPoll);
            var pinIncomingResults = XElement.Parse(pinResults);
            var parsedToken = pinIncomingResults.Attribute("authToken").ToString().Split('"')[1];
            if (parsedToken.Length != 0 || !string.IsNullOrEmpty(parsedToken))
            {
                authToken = parsedToken;
                Keyring.SetPassword("com.ib.pmusic", "pMusic", "authToken", authToken);
                isPinPolling = false;
                Console.WriteLine("Successfully Authenticated");
            }
            else
            {
                Console.WriteLine("Waiting");
            }
        } while (isPinPolling && authToken == null);

        _plexToken = authToken;
        _plexApi = new PlexAPI(Keyring.GetPassword("com.ib.pmusic", "pMusic", "authToken"));
        Console.WriteLine($"Redirecting");
    }

    public void SetInformation()
    {
        try
        {
            _plexToken = Keyring.GetPassword("com.ib.pmusic", "pMusic", "authToken");
            _plexId = Keyring.GetPassword("com.ib.pmusic", "pMusic", "id");
        }
        catch (KeyringException ex)
        {
            Console.WriteLine($"Error retrieving token: {ex.Message}");
            return;
        }
    }

    public async ValueTask<Bitmap> GetUserProfilePicture()
    {
        SetInformation();
        var url = "https://plex.tv/api/v2/user";
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("X-Plex-Token", _plexToken);

        using var response = await httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();

        var userDataXml = await response.Content.ReadAsStringAsync();
        var thumbnail = await GetBitmapImage(XElement.Parse(userDataXml).Attribute("thumb")?.Value);
        return thumbnail;
    }

    public async ValueTask<String> GetServerCapabilitiesAsync()
    {
        SetInformation();
        var uri = "https://plex.tv/api/v2/resources?" + "X-Plex-Client-Identifier=" + _plexClientIdentifier +
                  "&X-Plex-Token=" + _plexToken;
        var serversXmlRes = await httpClient.GetStringAsync(uri);
        var serverUri = XElement.Parse(serversXmlRes).Descendants("connection").First().Attribute("uri").Value;
        Console.WriteLine($"{serverUri} -> Server Response");
        return serverUri;
    }

    public async ValueTask<IImmutableList<Artist>> GetArtists(String uri)
    {
        // TODO Get artists from plex web api
        var libUri = uri + "/library/sections/";
        var librariesXml = await httpClient.GetStringAsync(libUri);
        var directory = XElement.Parse(librariesXml).Descendants("Directory")
            .FirstOrDefault(c => c.Attribute("agent")?.Value == "tv.plex.agents.music");
        var lib = ParseDirectory(directory);
        Console.WriteLine($"Music Library {lib}");

        var libDetailsUri = uri + "/library/sections/" + lib.Key;
        var libDetailsXml = await httpClient.GetStringAsync(libDetailsUri);

        var artistUri = uri + "/library/sections/" + lib.Key + "/all";
        var artistsDetailsXml = await httpClient.GetStringAsync(artistUri);
        var artists = await ParseArtists(XElement.Parse(artistsDetailsXml), lib.Key, uri);
        var i = 1;

        return artists.ToImmutableList();
    }

    public async ValueTask<IImmutableList<Album>> GetArtistAlbums(string uri, int libraryId, string artistKey,
        string artist)
    {
        var albumsInDbCount = _musicDbContext.Albums.Count(a => a.Artist == artist & a.UserId == _plexId);

        try
        {
            var albumUrl =
                uri + "/library/sections/" + libraryId + "/all?artist.id=" + artistKey +
                "&type=9&"; // "includeGuids={include_guids}&{filter}"
            var albumXml = await httpClient.GetStringAsync(albumUrl);
            var albumXElement = XElement.Parse(albumXml);

            if (albumXElement.DescendantsAndSelf("Directory").Count() == albumsInDbCount)
            {
                Console.WriteLine($"Returning {artist}'s albums from db");
                return _musicDbContext.Albums.Where(a => a.Artist == artist & a.UserId == _plexId).ToImmutableList();
            }

            var dbAlbumsGuid = _musicDbContext.Albums.Select(a => a.Guid).ToList();
            if (albumXElement.DescendantsAndSelf("Directory").Count() != albumsInDbCount)
            {
                Console.WriteLine($"Getting {artist.ToUpper()}'s new albums from plex");
                var albumsToParse = albumXElement.DescendantsAndSelf("Directory")
                    .Where(a => !dbAlbumsGuid.Contains(a.Attribute("guid").Value)).ToList();

                var albums = await ParseAlbums(albumsToParse, uri, artist);
                await _musicDbContext.SaveChangesAsync();

                return albums.ToImmutableList();
            }
        }
        catch (HttpRequestException ex)
        {
            Console.WriteLine($"Error retrieving albums: {ex.Message}");
            if (albumsInDbCount > 0)
            {
                Console.WriteLine($"{ex.Message} -> Returning {artist}'s albums from db");
                return _musicDbContext.Albums.Where(a => a.Artist == artist & a.UserId == _plexId).ToImmutableList();
            }

            return ImmutableList<Album>.Empty;
        }

        return ImmutableList<Album>.Empty;
    }

    public async ValueTask<IImmutableList<Track>> GetTrackList(string uri, string albumKey, string artist)
    {
        var trackUri = uri + "/library/metadata/" + albumKey + "/children";
        var trackXml = await httpClient.GetStringAsync(trackUri);

        var tracks = await ParseTracks(XElement.Parse(trackXml), uri, artist);
        var empty = ImmutableList<Track>.Empty;

        return tracks.ToImmutableList();
    }

    public async ValueTask MarkTrackAsPlayed(double ratingKey)
    {
        var res = await _plexApi.Media.MarkPlayedAsync(key: ratingKey);
        Console.WriteLine($"Mark Played Response: {res}");
    }

    public async ValueTask UpdateSession(string uri, string key, string state, string ratingKey, Decimal time,
        Decimal duration)
    {
        var cleanedDecimal = Decimal.Round(duration, MidpointRounding.ToZero);
        var timelineUri = uri + "/:/timeline?type=music&key=" + key + "&state=" + state + "&ratingKey=" + ratingKey +
                          "&time=" + time + "&playbackTime=" + time + "&duration=" + cleanedDecimal;
        await httpClient.GetAsync(timelineUri);
    }

    public async ValueTask<MemoryStream> GetPlaybackStream(string uri)
    {
        using var stream = await httpClient.GetStreamAsync(uri);

        // Copy to MemoryStream
        var memoryStream = new MemoryStream();
        await stream.CopyToAsync(memoryStream);

        return memoryStream;
    }

    public async ValueTask<IImmutableList<Playlist>> GetPlaylists(string uri)
    {
        if (_musicDbContext.Playlists.Any())
        {
            return _musicDbContext.Playlists.ToImmutableList();
        }

        var playlistsXml = await httpClient.GetStringAsync(uri + "/playlists");
        var playlists = await ParsePlaylists(XElement.Parse(playlistsXml), uri);

        await _musicDbContext.SaveChangesAsync();

        return playlists.ToImmutableList();
    }

    public async ValueTask<IImmutableList<Album>> GetAllAlbums(string uri)
    {
        var artists = await GetArtists(uri);

        var albums = new List<Album>();

        foreach (Artist artist in artists)
        {
            var album = await GetArtistAlbums(uri, artist.LibraryKey, artist.RatingKey, artist.Title);
            albums.AddRange(album);
        }

        return albums.ToImmutableList();
    }

    public async ValueTask<List<Playlist>> ParsePlaylists(XElement? mediaContainer, string uri)
    {
        if (mediaContainer is null) return new List<Playlist>();

        var tasks = mediaContainer.Elements("Playlist")
            .Where(playlist => playlist.Attribute("playlistType")?.Value == "audio")
            .Select(async playlist =>
            {
                var p = new Playlist
                {
                    RatingKey = playlist.Attribute("ratingKey")?.Value ?? "",
                    Key = playlist.Attribute("key")?.Value ?? "",
                    Guid = playlist.Attribute("guid")?.Value ?? "",
                    Type = playlist.Attribute("type")?.Value ?? "",
                    Title = playlist.Attribute("title")?.Value ?? "",
                    Summary = playlist.Attribute("summary")?.Value ?? "",
                    Smart = int.Parse(playlist.Attribute("smart")?.Value ?? "0"),
                    PlaylistType = playlist.Attribute("playlistType")?.Value ?? "",
                    Composite = uri + playlist.Attribute("composite")?.Value ?? "",
                    Icon = playlist.Attribute("icon")?.Value ?? "",
                    ViewCount = int.Parse(playlist.Attribute("viewCount")?.Value ?? "0"),
                    LastViewedAt = DateTimeOffset
                        .FromUnixTimeSeconds(long.Parse(playlist.Attribute("lastViewedAt")?.Value ?? "0"))
                        .LocalDateTime,
                    Duration = TimeSpan.FromMilliseconds(int.Parse(playlist.Attribute("duration")?.Value ?? "0")),
                    LeafCount = int.Parse(playlist.Attribute("leafCount")?.Value ?? "0"),
                    AddedAt = DateTimeOffset
                        .FromUnixTimeSeconds(long.Parse(playlist.Attribute("addedAt")?.Value ?? "0"))
                        .LocalDateTime,
                    UpdatedAt = DateTimeOffset
                        .FromUnixTimeSeconds(long.Parse(playlist.Attribute("updatedAt")?.Value ?? "0")).LocalDateTime
                };

                _musicDbContext.Playlists.Add(p);
                return p;
            }).ToList();

        // Wait for all tasks to complete and return the results
        var results = await Task.WhenAll(tasks);
        return results.ToList();
    }

    public async Task<List<Track>> ParseTracks(XElement mediaContainer, string uri, string artist)
    {
        if (mediaContainer == null) return new List<Track>();

        var items = mediaContainer.Elements("Track").Select(async track =>
        {
            return new Track
            {
                RatingKey = track.Attribute("ratingKey")?.Value ?? "",
                Key = track.Attribute("key")?.Value ?? "",
                ParentRatingKey = track.Attribute("parentRatingKey")?.Value ?? "",
                GrandparentRatingKey = track.Attribute("grandparentRatingKey")?.Value ?? "",
                Guid = track.Attribute("guid")?.Value ?? "",
                ParentGuid = track.Attribute("parentGuid")?.Value ?? "",
                GrandparentGuid = track.Attribute("grandparentGuid")?.Value ?? "",
                ParentStudio = track.Attribute("parentStudio")?.Value ?? "",
                Type = track.Attribute("type")?.Value ?? "",
                Title = track.Attribute("title")?.Value ?? "",
                Artist = artist,
                GrandparentKey = track.Attribute("grandparentKey")?.Value ?? "",
                ParentKey = track.Attribute("parentKey")?.Value ?? "",
                GrandparentTitle = track.Attribute("grandparentTitle")?.Value ?? "",
                ParentTitle = track.Attribute("parentTitle")?.Value ?? "",
                Summary = track.Attribute("summary")?.Value ?? "",
                Index = int.Parse(track.Attribute("index")?.Value ?? "0"),
                ParentIndex = int.Parse(track.Attribute("parentIndex")?.Value ?? "0"),
                RatingCount = int.Parse(track.Attribute("ratingCount")?.Value ?? "0"),
                ParentYear = int.Parse(track.Attribute("parentYear")?.Value ?? "0"),
                Thumb = uri + track.Attribute("thumb")?.Value ?? "",
                Art = track.Attribute("art")?.Value ?? "",
                ParentThumb = track.Attribute("parentThumb")?.Value ?? "",
                GrandparentThumb = track.Attribute("grandparentThumb")?.Value ?? "",
                GrandparentArt = track.Attribute("grandparentArt")?.Value ?? "",
                Duration = TimeSpan.FromMilliseconds(int.Parse(track.Attribute("duration")?.Value ?? "0")),
                AddedAt = int.Parse(track.Attribute("addedAt")?.Value ?? "0"),
                UpdatedAt = int.Parse(track.Attribute("updatedAt")?.Value ?? "0"),
                MusicAnalysisVersion = int.Parse(track.Attribute("musicAnalysisVersion")?.Value ?? "0"),
                Media = ParseMedia(track.Element("Media")!)
            };
        }).ToList();

        return (await Task.WhenAll(items)).ToList();
    }

    private static Media ParseMedia(XElement mediaElement)
    {
        if (mediaElement == null) return null;

        return new Media
        {
            MediaId = mediaElement.Attribute("id")?.Value ?? "",
            Duration = int.Parse(mediaElement.Attribute("duration")?.Value ?? "0"),
            Bitrate = int.Parse(mediaElement.Attribute("bitrate")?.Value ?? "0"),
            AudioChannels = double.Parse(mediaElement.Attribute("audioChannels")?.Value ?? "0"),
            AudioCodec = mediaElement.Attribute("audioCodec")?.Value ?? "",
            Container = mediaElement.Attribute("container")?.Value ?? "",
            Part = ParsePart(mediaElement.Element("Part"))
        };
    }

    private static Part ParsePart(XElement partElement)
    {
        if (partElement == null) return null;

        return new Part
        {
            PartId = partElement.Attribute("id")?.Value ?? "",
            Key = partElement.Attribute("key")?.Value ?? "",
            Duration = int.Parse(partElement.Attribute("duration")?.Value ?? "0"),
            File = partElement.Attribute("file")?.Value ?? "",
            Size = long.Parse(partElement.Attribute("size")?.Value ?? "0"),
            Container = partElement.Attribute("container")?.Value ?? ""
        };
    }

    public async ValueTask<List<Album>> ParseAlbums(List<XElement> albums, string uri, string artist)
    {
        var newAlbums = new List<Album>();

        foreach (var album in albums)
        {
            var a = new Album
            {
                AddedAt = DateTimeOffset
                    .FromUnixTimeSeconds(long.Parse(album.Attribute("addedAt")?.Value ?? "0")).LocalDateTime,
                Guid = album.Attribute("guid")?.Value ?? "",
                Key = album.Attribute("key")?.Value ?? "",
                LastRatedAt = DateTimeOffset
                    .FromUnixTimeSeconds(long.Parse(album.Attribute("lastRatedAt")?.Value ?? "0"))
                    .LocalDateTime,
                LastViewedAt = DateTimeOffset
                    .FromUnixTimeSeconds(long.Parse(album.Attribute("lastViewedAt")?.Value ?? "0"))
                    .LocalDateTime,
                LoudnessAnalysisVersion = album.Attribute("loudnessAnalysisVersion")?.Value ?? "",
                OriginallyAvailableAt = DateTime.Parse(album.Attribute("originallyAvailableAt")!.Value),
                MusicAnalysisVersion = album.Attribute("musicAnalysisVersion")?.Value ?? "",
                ParentGuid = album.Attribute("parentGuid")?.Value ?? "",
                ParentKey = album.Attribute("parentKey")?.Value ?? "",
                ParentRatingKey = album.Attribute("parentRatingKey")?.Value ?? "",
                ParentThumb = album.Attribute("parentThumb")?.Value ?? "0",
                ParentTitle = album.Attribute("parentTitle")?.Value ?? "",
                Rating = album.Attribute("rating")?.Value ?? "0",
                RatingKey = album.Attribute("ratingKey")?.Value ?? "",
                SkipCount = album.Attribute("skipCount")?.Value ?? "",
                Studio = album.Attribute("studio")?.Value ?? "",
                Summary = album.Attribute("summary")?.Value ?? "",
                Index = album.Attribute("index")?.Value ?? "",
                Thumb = uri + album.Attribute("thumb")?.Value ?? "",
                Title = album.Attribute("title")?.Value ?? "",
                Artist = artist,
                Type = album.Attribute("type")?.Value ?? "",
                UpdatedAt = DateTimeOffset
                    .FromUnixTimeSeconds(long.Parse(album.Attribute("updatedAt")?.Value ?? "0")).LocalDateTime,
                UserRating = album.Attribute("userRating")?.Value ?? "0",
                ViewCount = album.Attribute("viewCount")?.Value ?? "0",
                Year = album.Attribute("year")?.Value ?? "",
                Image = new Image
                {
                    Alt = album.Element("Image").Attribute("alt")?.Value ?? "",
                    Type = album.Element("Image").Attribute("type")?.Value ?? "",
                    Url = album.Element("Image").Attribute("url")?.Value ?? ""
                },
                UltraBlurColors = new UltraBlurColors
                {
                    TopLeft = album.Element("UltraBlurColors").Attribute("topLeft")?.Value ?? "",
                    TopRight = album.Element("UltraBlurColors").Attribute("topRight")?.Value ?? "",
                    BottomLeft = album.Element("UltraBlurColors").Attribute("bottomLeft")?.Value ?? "",
                    BottomRight = album.Element("UltraBlurColors").Attribute("bottomRight")?.Value ?? ""
                },
                UserId = _plexId,
            };

            newAlbums.Add(a);
            _musicDbContext.Add(a);
        }

        return newAlbums;
    }

    public async ValueTask<List<Artist>> ParseArtists(XElement mediaContainer, int libKey, string uri)
    {
        if (mediaContainer == null) return new List<Artist>();

        var items = mediaContainer.Elements("Directory")
            .Select(async directory =>
            {
                return new Artist
                {
                    RatingKey = directory.Attribute("ratingKey")?.Value ?? "",
                    Key = directory.Attribute("key")?.Value ?? "",
                    Guid = directory.Attribute("guid")?.Value ?? "",
                    Type = directory.Attribute("type")?.Value ?? "",
                    Title = directory.Attribute("title")?.Value ?? "",
                    Index = directory.Attribute("index")?.Value ?? "",
                    UserRating = directory.Attribute("userRating")?.Value ?? "",
                    ViewCount = directory.Attribute("viewCount")?.Value ?? "",
                    SkipCount = directory.Attribute("skipCount")?.Value ?? "",
                    LastViewedAt = directory.Attribute("lastViewedAt")?.Value ?? "",
                    LastRatedAt = directory.Attribute("lastRatedAt")?.Value ?? "",
                    Thumb = uri + directory.Attribute("thumb")?.Value ?? "",
                    AddedAt = directory.Attribute("addedAt")?.Value ?? "",
                    UpdatedAt = directory.Attribute("updatedAt")?.Value ?? "",
                    LibraryKey = libKey,

                    Image = directory.Element("Image") != null
                        ? new Image
                        {
                            Alt = directory.Element("Image")?.Attribute("alt")?.Value,
                            Type = directory.Element("Image")?.Attribute("type")?.Value,
                            Url = directory.Element("Image")?.Attribute("url")?.Value
                        }
                        : null,

                    Ubc = directory.Element("UltraBlurColors") != null
                        ? new UltraBlurColors
                        {
                            TopLeft = directory.Element("UltraBlurColors")?.Attribute("topLeft")?.Value,
                            TopRight = directory.Element("UltraBlurColors")?.Attribute("topRight")?.Value,
                            BottomLeft = directory.Element("UltraBlurColors")?.Attribute("bottomLeft")?.Value,
                            BottomRight = directory.Element("UltraBlurColors")?.Attribute("bottomRight")?.Value
                        }
                        : null,

                    // Genres = directory.Elements("Genre")
                    //     .Select(genre => new Genre { Tag = genre.Attribute("tag")?.Value })
                    //     .ToArray(),

                    Country = directory.Element("Country") != null
                        ? new Country { Tag = directory.Element("Country")?.Attribute("tag")?.Value }
                        : null
                };
            }).ToList();

        return (await Task.WhenAll(items)).ToList();
    }

    public static LibraryDir ParseDirectory(XElement directoryElement)
    {
        if (directoryElement == null)
            return null;

        return new LibraryDir
        {
            AllowSync = directoryElement.Attribute("allowSync")?.Value == "1",
            Art = directoryElement.Attribute("art")?.Value,
            Composite = directoryElement.Attribute("composite")?.Value,
            Filters = directoryElement.Attribute("filters")?.Value == "1",
            Refreshing = directoryElement.Attribute("refreshing")?.Value == "1",
            Thumb = directoryElement.Attribute("thumb")?.Value,
            Key = int.Parse(directoryElement.Attribute("key")?.Value ?? "0"),
            Type = directoryElement.Attribute("type")?.Value,
            Title = directoryElement.Attribute("title")?.Value,
            Agent = directoryElement.Attribute("agent")?.Value,
            Scanner = directoryElement.Attribute("scanner")?.Value,
            Language = directoryElement.Attribute("language")?.Value,
            UUID = directoryElement.Attribute("uuid")?.Value,
            UpdatedAt = long.Parse(directoryElement.Attribute("updatedAt")?.Value ?? "0"),
            CreatedAt = long.Parse(directoryElement.Attribute("createdAt")?.Value ?? "0"),
            ScannedAt = long.Parse(directoryElement.Attribute("scannedAt")?.Value ?? "0"),
            Content = directoryElement.Attribute("content")?.Value == "1",
            Directory = directoryElement.Attribute("directory")?.Value == "1",
            ContentChangedAt = long.Parse(directoryElement.Attribute("contentChangedAt")?.Value ?? "0"),
            Hidden = directoryElement.Attribute("hidden")?.Value == "0",
            Location = directoryElement.Element("Location") != null
                ? new LocationInfo
                {
                    Id = int.Parse(directoryElement.Element("Location")?.Attribute("id")?.Value ?? "0"),
                    Path = directoryElement.Element("Location")?.Attribute("path")?.Value
                }
                : null
        };
    }

    public async ValueTask<Bitmap> GetBitmapImage(string url)
    {
        var imageBytes = await httpClient.GetByteArrayAsync(url);

        using var memoryStream = new MemoryStream(imageBytes);
        // In Avalonia, use DecodeToHeight instead of DecodeToWidth
        return new Bitmap(memoryStream);
    }
}