using System.Xml.Linq;
using KeySharp;
using LukeHagar.PlexAPI.SDK;
using pMusic.Services;
using Image = pMusic.Services.Image;
using Media = pMusic.Models.Media;

namespace pMusic.Helpers;

public class Plex
{
    public readonly HttpClient httpClient;
    private readonly string _plexClientIdentifier = Keyring.GetPassword("com.ib.pmusic", "pMusic", "cIdentifier");
    private readonly string _plexToken = Keyring.GetPassword("com.ib.pmusic", "pMusic", "authToken");
    private static readonly string _plexSessionIdentifier = Keyring.GetPassword("com.ib.pmusic", "pMusic", "cIdentifier");
    private static readonly string _plexProduct = "pMusic"; 
    private static readonly string _plexDeviceName = "Desktop"; 
    private static readonly string _plexPlatform = "Desktop"; 
    private static readonly PlexAPI _plexApi = new PlexAPI(Keyring.GetPassword("com.ib.pmusic", "pMusic", "authToken"));

    public Plex(HttpClient httpClient)
    {
        this.httpClient = httpClient;
        this.httpClient.DefaultRequestHeaders.Add("X-Plex-Token", _plexToken);
        this.httpClient.DefaultRequestHeaders.Add("X-Plex-Client-Identifier", _plexClientIdentifier);
        this.httpClient.DefaultRequestHeaders.Add("X-Plex-Session-Identifier", _plexSessionIdentifier);
        this.httpClient.DefaultRequestHeaders.Add("X-Plex-Product", _plexProduct);
        this.httpClient.DefaultRequestHeaders.Add("X-Plex-Device-Name", _plexDeviceName);
        this.httpClient.DefaultRequestHeaders.Add("X-Plex-Platform", _plexPlatform);
    }

    public async ValueTask<String> GetServerCapabilitiesAsync()
    {
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
        var artists = ParseArtists(XElement.Parse(artistsDetailsXml), lib.Key);
        var i = 1;

        return artists.ToImmutableList();
    }

    public async ValueTask<IImmutableList<Album>> GetArtistAlbums(string uri, int libraryId, string artistKey)
    {
        var albumUri =
            uri + "/library/sections/" + libraryId + "/all?artist.id=" + artistKey +
            "&type=9&"; // "includeGuids={include_guids}&{filter}"
        var albumXml = await httpClient.GetStringAsync(albumUri);

        var albums = ParseAlbums(XElement.Parse(albumXml));

        return albums.ToImmutableList();
    }

    public async ValueTask<IImmutableList<Track>> GetTrackList(string uri, string albumKey)
    {
        var trackUri = uri + "/library/metadata/" + albumKey + "/children";
        var trackXml = await httpClient.GetStringAsync(trackUri);

        var tracks = ParseTracks(XElement.Parse(trackXml)).ToImmutableList();
        var empty = ImmutableList<Track>.Empty;
        
        return tracks;
    }

    public async ValueTask UpdateTrackProgress(string ratingKey, float progress)
    {
        var res = await _plexApi.Media.UpdatePlayProgressAsync(
            key: ratingKey,
            time: progress,
            state: "played"
        );
        
        Console.WriteLine($"Update Play Progress Response: {res}");
    }

    public async ValueTask MarkTrackAsPlayed(double ratingKey)
    {
        var res = await _plexApi.Media.MarkPlayedAsync(key: ratingKey);
        Console.WriteLine($"Mark Played Response: {res}");

    }

    public async ValueTask CreateSession(string uri, string key, string ratingKey, Decimal duration)
    {

        var cleanedDecimal = Decimal.Round(duration, MidpointRounding.ToZero);
        var timelineUri = "https://192-168-50-58.1362f9412e8f48b7a8d1d03e7b44a1e2.plex.direct:32400" + "/:/timeline?type=music&key=" + key +"&state=playing&ratingKey=" + ratingKey + "&time=0&playbackTime=0&duration=" + cleanedDecimal ;
        await httpClient.GetAsync(timelineUri);
        // var request = new HttpRequestMessage(HttpMethod.Put, timelineUri);
        // request.Headers.Add("Accept", "application/json");
        // var res = await httpClient.SendAsync(request);
    }

    public async ValueTask UpdateSession(string uri, string key, string state, string ratingKey, Decimal time, Decimal duration)
    {
        var cleanedDecimal = Decimal.Round(duration, MidpointRounding.ToZero);
        var timelineUri = "192-168-50-58.1362f9412e8f48b7a8d1d03e7b44a1e2.plex.direct:32400" + "/:/timeline?type=music&key=" + key +"&state=" + state +"&ratingKey=" + ratingKey + "&time="+time+"&playbackTime="+time+"&duration=" + cleanedDecimal;
        await httpClient.GetAsync(timelineUri);
        // var request = new HttpRequestMessage(HttpMethod.Put, timelineUri);
        // request.Headers.Add("Accept", "application/json");
        // var res = await httpClient.SendAsync(request);
    }

    public static List<Track> ParseTracks(XElement mediaContainer)
    {
        if (mediaContainer == null) return new List<Track>();

        var items = mediaContainer.Elements("Track").Select(
            track => new Track(
                RatingKey: track.Attribute("ratingKey")?.Value ?? "",
                Key: track.Attribute("key")?.Value ?? "",
                ParentRatingKey: track.Attribute("parentRatingKey")?.Value ?? "",
                GrandparentRatingKey: track.Attribute("grandparentRatingKey")?.Value ?? "",
                Guid: track.Attribute("guid")?.Value ?? "",
                ParentGuid: track.Attribute("parentGuid")?.Value ?? "",
                GrandparentGuid: track.Attribute("grandparentGuid")?.Value ?? "",
                ParentStudio: track.Attribute("parentStudio")?.Value ?? "",
                Type: track.Attribute("type")?.Value ?? "",
                Title: track.Attribute("title")?.Value ?? "",
                GrandparentKey: track.Attribute("grandparentKey")?.Value ?? "",
                ParentKey: track.Attribute("parentKey")?.Value ?? "",
                GrandparentTitle: track.Attribute("grandparentTitle")?.Value ?? "",
                ParentTitle: track.Attribute("parentTitle")?.Value ?? "",
                Summary: track.Attribute("summary")?.Value ?? "",
                Index: int.Parse(track.Attribute("index")?.Value ?? "0"),
                ParentIndex: int.Parse(track.Attribute("parentIndex")?.Value ?? "0"),
                RatingCount: int.Parse(track.Attribute("ratingCount")?.Value ?? "0"),
                ParentYear: int.Parse(track.Attribute("parentYear")?.Value! ?? "0"),
                Thumb: track.Attribute("thumb")?.Value ?? "",
                Art: track.Attribute("art")?.Value ?? "",
                ParentThumb: track.Attribute("parentThumb")?.Value ?? "",
                GrandparentThumb: track.Attribute("grandparentThumb")?.Value ?? "",
                GrandparentArt: track.Attribute("grandparentArt")?.Value ?? "",
                Duration: int.Parse(track.Attribute("duration")?.Value ?? "0"),
                AddedAt: int.Parse(track.Attribute("addedAt")?.Value ?? "0"),
                UpdatedAt: int.Parse(track.Attribute("updatedAt")?.Value ?? "0"),
                MusicAnalysisVersion: int.Parse(track.Attribute("musicAnalysisVersion")?.Value ?? "0"),
                Media: ParseMedia(track.Element("Media")!)
            )
        ).ToList();

        return items;
    }

    private static Media ParseMedia(XElement mediaElement)
    {
        if (mediaElement == null) return null;

        return new Media(
            Id: mediaElement.Attribute("id")?.Value ?? "",
            Duration: int.Parse(mediaElement.Attribute("duration")?.Value ?? "0"),
            Bitrate: int.Parse(mediaElement.Attribute("bitrate")?.Value ?? "0"),
            AudioChannels: double.Parse(mediaElement.Attribute("audioChannels")?.Value ?? "0"),
            AudioCodec: mediaElement.Attribute("audioCodec")?.Value ?? "",
            Container: mediaElement.Attribute("container")?.Value ?? "",
            Part: ParsePart(mediaElement.Element("Part"))
        );
    }

    private static Part ParsePart(XElement partElement)
    {
        if (partElement == null) return null;

        return new Part(
            Id: partElement.Attribute("id")?.Value ?? "",
            Key: partElement.Attribute("key")?.Value ?? "",
            Duration: int.Parse(partElement.Attribute("duration")?.Value ?? "0"),
            File: partElement.Attribute("file")?.Value ?? "",
            Size: long.Parse(partElement.Attribute("size")?.Value ?? "0"),
            Container: partElement.Attribute("container")?.Value ?? ""
        );
    }
    
    public static List<Album> ParseAlbums(XElement mediaContainer)
    {
        if (mediaContainer == null) return new List<Album>();

        var directory1 = mediaContainer.Element("Directory");

        var items = mediaContainer.Elements("Directory").Select(
            directory => new Album(
                RatingKey: directory.Attribute("ratingKey")?.Value ?? "",
                Key: directory.Attribute("key")?.Value ?? "",
                ParentRatingKey: directory.Attribute("parentRatingKey")?.Value ?? "",
                Guid: directory.Attribute("guid")?.Value ?? "",
                ParentGuid: directory.Attribute("parentGuid")?.Value ?? "",
                Studio: directory.Attribute("studio")?.Value ?? "",
                Type: directory.Attribute("type")?.Value ?? "",
                Title: directory.Attribute("title")?.Value ?? "",
                ParentKey: directory.Attribute("parentKey")?.Value ?? "",
                ParentTitle: directory.Attribute("parentTitle")?.Value ?? "",
                Summary: directory.Attribute("summary")?.Value ?? "",
                Index: int.Parse(directory.Attribute("index")?.Value ?? "0"),
                Rating: double.Parse(directory.Attribute("rating")?.Value ?? "0"),
                LastViewedAt: int.Parse(directory.Attribute("lastViewedAt")?.Value ?? "0"),
                Year: directory.Attribute("year")?.Value ?? "",
                Thumb: directory.Attribute("thumb")?.Value ?? "",
                Art: directory.Attribute("art")?.Value ?? "",
                ParentThumb: directory.Attribute("parentThumb")?.Value ?? "0",
                OriginallyAvailableAt: DateTime.Parse(directory.Attribute("originallyAvailableAt")!.Value),
                AddedAt: int.Parse(directory.Attribute("addedAt")?.Value ?? "0"),
                UpdatedAt: int.Parse(directory.Attribute("updatedAt")?.Value ?? "0"),
                LoudnessAnalysisVersion: int.Parse(directory.Attribute("loudnessAnalysisVersion")?.Value ?? "0"),
                MusicAnalysisVersion: int.Parse(directory.Attribute("musicAnalysisVersion")?.Value ?? "0")
            )
        ).ToList();

        return items;
    }

    public static List<Artist> ParseArtists(XElement mediaContainer, int libKey)
    {
        if (mediaContainer == null) return new List<Artist>();

        return mediaContainer.Elements("Directory")
            .Select(directory => new Artist
            (
                RatingKey: directory.Attribute("ratingKey")?.Value ?? "",
                Key: directory.Attribute("key")?.Value ?? "",
                Guid: directory.Attribute("guid")?.Value ?? "",
                Type: directory.Attribute("type")?.Value ?? "",
                Title: directory.Attribute("title")?.Value ?? "",
                Index: directory.Attribute("index")?.Value ?? "",
                UserRating: directory.Attribute("userRating")?.Value ?? "",
                ViewCount: directory.Attribute("viewCount")?.Value ?? "",
                SkipCount: directory.Attribute("skipCount")?.Value ?? "",
                LastViewedAt: directory.Attribute("lastViewedAt")?.Value ?? "",
                LastRatedAt: directory.Attribute("lastRatedAt")?.Value ?? "",
                Thumb: directory.Attribute("thumb")?.Value ?? "",
                AddedAt: directory.Attribute("addedAt")?.Value ?? "",
                UpdatedAt: directory.Attribute("updatedAt")?.Value ?? "",
                LibraryKey: libKey,

                // Parse Image
                Image: directory.Element("Image") != null
                    ? new Image
                    {
                        Alt = directory.Element("Image")?.Attribute("alt")?.Value,
                        Type = directory.Element("Image")?.Attribute("type")?.Value,
                        Url = directory.Element("Image")?.Attribute("url")?.Value
                    }
                    : null,

                // Parse UltraBlurColors
                Ubc: directory.Element("UltraBlurColors") != null
                    ? new UltraBlurColors
                    {
                        TopLeft = directory.Element("UltraBlurColors")?.Attribute("topLeft")?.Value,
                        TopRight = directory.Element("UltraBlurColors")?.Attribute("topRight")?.Value,
                        BottomLeft = directory.Element("UltraBlurColors")?.Attribute("bottomLeft")?.Value,
                        BottomRight = directory.Element("UltraBlurColors")?.Attribute("bottomRight")?.Value
                    }
                    : null,

                // Parse Genres
                Genres: directory.Elements("Genre")
                    .Select(genre => new Genre { Tag = genre.Attribute("tag")?.Value })
                    .ToArray(),

                // Parse Country
                Country: directory.Element("Country") != null
                    ? new Country { Tag = directory.Element("Country")?.Attribute("tag")?.Value }
                    : null
            )).ToList();
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
}

public class LibraryDir
{
    public bool AllowSync { get; set; }
    public string Art { get; set; }
    public string Composite { get; set; }
    public bool Filters { get; set; }
    public bool Refreshing { get; set; }
    public string Thumb { get; set; }
    public int Key { get; set; }
    public string Type { get; set; }
    public string Title { get; set; }
    public string Agent { get; set; }
    public string Scanner { get; set; }
    public string Language { get; set; }
    public string UUID { get; set; }
    public long UpdatedAt { get; set; }
    public long CreatedAt { get; set; }
    public long ScannedAt { get; set; }
    public bool Content { get; set; }
    public bool Directory { get; set; }
    public long ContentChangedAt { get; set; }
    public bool Hidden { get; set; }
    public LocationInfo Location { get; set; }
}

public class LocationInfo
{
    public int Id { get; set; }
    public string Path { get; set; }
}
