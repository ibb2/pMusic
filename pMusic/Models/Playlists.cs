using System;
using Avalonia.Media.Imaging;

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
    Bitmap? Composite,
    string Icon,
    int ViewCount,
    DateTime LastViewedAt,
    TimeSpan Duration,
    int LeafCount,
    DateTime AddedAt,
    DateTime UpdatedAt);