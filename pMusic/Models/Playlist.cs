using Microsoft.UI.Xaml.Media.Imaging;

namespace pMusic.Models;

public partial record Playlist(
    string RatingKey,
    string Key,
    string Guid,
    string Type,
    string Title,
    string Summary,
    int Smart,
    string PlaylistType,
    BitmapImage? Composite,
    string Icon,
    int ViewCount,
    DateTime LastViewedAt,
    int Duration,
    int LeafCount,
    DateTime AddedAt,
    DateTime UpdatedAt);
