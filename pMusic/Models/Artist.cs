using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace pMusic.Models;

public class Artist
{
    public int Id { get; set; }
    public string RatingKey { get; set; } = string.Empty;
    public string Key { get; set; } = string.Empty;
    public string Guid { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Index { get; set; } = string.Empty;
    public string UserRating { get; set; } = string.Empty;
    public string ViewCount { get; set; } = string.Empty;
    public string SkipCount { get; set; } = string.Empty;
    public string LastViewedAt { get; set; } = string.Empty;
    public string LastRatedAt { get; set; } = string.Empty;
    public string Thumb { get; set; }
    public string AddedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
    public int LibraryKey { get; set; }
    public Image? Image { get; set; }
    public UltraBlurColors? Ubc { get; set; }
    public List<Genre>? Genres { get; set; }
    public Country? Country { get; set; }

    // Custom
    [MaxLength(20)] public required string UserId { get; set; }

    // Relations
    public List<Album> Albums { get; set; } = [];
}

public class Image
{
    public int Id { get; set; }
    public string Alt { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
}

public class UltraBlurColors
{
    public int Id { get; set; }

    public string TopLeft { get; set; } = string.Empty;
    public string TopRight { get; set; } = string.Empty;
    public string BottomLeft { get; set; } = string.Empty;
    public string BottomRight { get; set; } = string.Empty;
}

public class Genre
{
    public int Id { get; set; }
    public string Tag { get; set; } = string.Empty;
}

public class Country
{
    public int Id { get; set; }
    public string Tag { get; set; } = string.Empty;
}