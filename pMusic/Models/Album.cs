using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Avalonia.Media.Imaging;

namespace pMusic.Models;

public class Album
{
    public int Id { get; set; } // EF Core primary key
    public DateTime? AddedAt { get; set; }
    public string? Guid { get; set; }
    public string? Key { get; set; }
    public DateTime? LastRatedAt { get; set; }
    public DateTime? LastViewedAt { get; set; }
    public string? LoudnessAnalysisVersion { get; set; }
    public string? MusicAnalysisVersion { get; set; }
    public DateTime? OriginallyAvailableAt { get; set; }
    public string? ParentGuid { get; set; }
    public string? ParentKey { get; set; }
    public string? ParentRatingKey { get; set; }
    public string? ParentThumb { get; set; }
    public string? ParentTitle { get; set; }
    public string? Rating { get; set; }
    public string? RatingKey { get; set; }
    public string? SkipCount { get; set; }
    public string? Studio { get; set; }
    public string? Summary { get; set; }
    public string? Index { get; set; }
    public Bitmap? Thumb { get; set; }
    public string? Title { get; set; }
    public string? Artist { get; set; }
    public string? Type { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UserRating { get; set; }
    public string? ViewCount { get; set; }
    public string? Year { get; set; }
    public Image? Image { get; set; }
    public UltraBlurColors? UltraBlurColors { get; set; }
    public List<Genre>? Genres { get; set; } = new();

    // Custom Properties
    public bool IsPinned { get; set; } = false;
}