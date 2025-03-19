using System.Xml.Linq;
using KeySharp;
using LukeHagar.PlexAPI.SDK;
using pMusic.Services;
using Image = pMusic.Services.Image;

namespace pMusic.Helpers;

public class Plex
{
    private readonly HttpClient httpClient;
    private readonly string _plexClientIdentifier = Keyring.GetPassword("com.ib.pmusic", "pMusic", "cIdentifier");
    private readonly string _plexToken = Keyring.GetPassword("com.ib.pmusic", "pMusic", "authToken");

    public Plex(HttpClient httpClient)
    {
        this.httpClient = httpClient;
        this.httpClient.DefaultRequestHeaders.Add("X-Plex-Token", _plexToken);
    }

    public async ValueTask<String> GetServerCapabilitiesAsync()
    {
        // var sdk = new PlexAPI(accessToken: _plexToken);
        //
        // var res = await sdk.Server.GetServerListAsync();
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
        var artists = ParseArtists(XElement.Parse(artistsDetailsXml));
        var i = 1;

        return artists.ToImmutableList();
    }

    public static List<Artist> ParseArtists(XElement mediaContainer)
    {
        if (mediaContainer == null) return new List<Artist>();

        return mediaContainer.Elements("Directory")
            .Select(directory => new Artist
            (
                RatingKey : directory.Attribute("ratingKey")?.Value ?? "",
                Key : directory.Attribute("key")?.Value ?? "",
                Guid : directory.Attribute("guid")?.Value ?? "",
                Type : directory.Attribute("type")?.Value ?? "",
                Title : directory.Attribute("title")?.Value ?? "",
                Index : directory.Attribute("index")?.Value ?? "",
                UserRating : directory.Attribute("userRating")?.Value ?? "",
                ViewCount : directory.Attribute("viewCount")?.Value ?? "",
                SkipCount : directory.Attribute("skipCount")?.Value ?? "",
                LastViewedAt : directory.Attribute("lastViewedAt")?.Value ?? "",
                LastRatedAt : directory.Attribute("lastRatedAt")?.Value ?? "",
                Thumb : directory.Attribute("thumb")?.Value ?? "",
                AddedAt : directory.Attribute("addedAt")?.Value ?? "",
                UpdatedAt : directory.Attribute("updatedAt")?.Value ?? "",

                // Parse Image
                Image : directory.Element("Image") != null
                    ? new Image
                    {
                        Alt = directory.Element("Image")?.Attribute("alt")?.Value,
                        Type = directory.Element("Image")?.Attribute("type")?.Value,
                        Url = directory.Element("Image")?.Attribute("url")?.Value
                    }
                    : null,

                // Parse UltraBlurColors
                Ubc : directory.Element("UltraBlurColors") != null
                    ? new UltraBlurColors
                    {
                        TopLeft = directory.Element("UltraBlurColors")?.Attribute("topLeft")?.Value,
                        TopRight = directory.Element("UltraBlurColors")?.Attribute("topRight")?.Value,
                        BottomLeft = directory.Element("UltraBlurColors")?.Attribute("bottomLeft")?.Value,
                        BottomRight = directory.Element("UltraBlurColors")?.Attribute("bottomRight")?.Value
                    }
                    : null,

                // Parse Genres
                Genres : directory.Elements("Genre")
                    .Select(genre => new Genre { Tag = genre.Attribute("tag")?.Value })
                    .ToArray(),

                // Parse Country
                Country : directory.Element("Country") != null
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
