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

public record Image(
    string Alt,
    string Type,
    string Url
);

public record UltraBlurColors(
    string TopLeft,
    string TopRight,
    string BottomLeft,
    string BottomRight
);

public record Genre(
    string Tag
);

public record Country(
    string Tag
);