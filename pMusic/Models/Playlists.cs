using System;
using Avalonia.Media.Imaging;

namespace pMusic.Models;

public class Playlist
{
    public int Id { get; set; } // EF Core primary key
    public string RatingKey { get; set; }
    public string Key { get; set; }
    public string Guid { get; set; }
    public string Type { get; set; }
    public string Title { get; set; }
    public string Summary { get; set; }
    public int Smart { get; set; }
    public string PlaylistType { get; set; }
    public string Composite { get; set; }
    public string Icon { get; set; }
    public int ViewCount { get; set; }
    public DateTime LastViewedAt { get; set; }
    public TimeSpan Duration { get; set; }
    public int LeafCount { get; set; }
    public DateTime AddedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Custom Properties
    public bool IsPinned { get; set; } = false;
}