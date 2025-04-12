using System;
using Avalonia.Media.Imaging;

namespace pMusic.Models;

public class Track
{
    public int Id { get; set; } // EF Core primary key
    public string RatingKey { get; set; }
    public string Key { get; set; }
    public string ParentRatingKey { get; set; }
    public string GrandparentRatingKey { get; set; }
    public string Guid { get; set; }
    public string ParentGuid { get; set; }
    public string GrandparentGuid { get; set; }
    public string ParentStudio { get; set; }
    public string Type { get; set; }
    public string Title { get; set; }
    public string Artist { get; set; }
    public string GrandparentKey { get; set; }
    public string ParentKey { get; set; }
    public string GrandparentTitle { get; set; }
    public string ParentTitle { get; set; }
    public string Summary { get; set; }
    public int Index { get; set; }
    public int ParentIndex { get; set; }
    public int RatingCount { get; set; }
    public int ParentYear { get; set; }
    public byte[]? Thumb { get; set; }
    public string Art { get; set; }
    public string ParentThumb { get; set; }
    public string GrandparentThumb { get; set; }
    public string GrandparentArt { get; set; }
    public TimeSpan Duration { get; set; }
    public long AddedAt { get; set; }
    public long UpdatedAt { get; set; }
    public int MusicAnalysisVersion { get; set; }

    public Media Media { get; set; }
}

public class Media
{
    public int Id { get; set; } // EF Core primary key
    public string MediaId { get; set; }
    public int Duration { get; set; }
    public int Bitrate { get; set; }
    public double AudioChannels { get; set; }
    public string AudioCodec { get; set; }
    public string Container { get; set; }

    public Part Part { get; set; }
}

public class Part
{
    public int Id { get; set; }
    public string PartId { get; set; }
    public string Key { get; set; }
    public int Duration { get; set; }
    public string File { get; set; }
    public long Size { get; set; }
    public string Container { get; set; }
}