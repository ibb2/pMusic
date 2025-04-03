using Avalonia.Media.Imaging;

namespace pMusic.Models;

public partial record Artist(
    string RatingKey = "",
    string Key = "",
    string Guid = "",
    string Type = "",
    string Title = "",
    string Index = "",
    string UserRating = "",
    string ViewCount = "",
    string SkipCount = "",
    string LastViewedAt = "",
    string LastRatedAt = "",
    Bitmap? Thumb = null,
    string AddedAt = "",
    string UpdatedAt = "",
    int LibraryKey = 0,
    Image? Image = null,
    UltraBlurColors? Ubc = null,
    Genre[]? Genres = null,
    Country? Country = null
);

public record Image
{
    public string Alt { get; set; }
    public string Type { get; set; }
    public string Url { get; set; }
}

public record UltraBlurColors
{
    public string TopLeft { get; set; }
    public string TopRight { get; set; }
    public string BottomLeft { get; set; }
    public string BottomRight { get; set; }
}

public record Genre
{
    public string Tag { get; set; }
}

public record Country
{
    public string Tag { get; set; }
}