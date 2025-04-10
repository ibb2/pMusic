using System;
using Avalonia.Media.Imaging;

namespace pMusic.Models;

public record Album(
    DateTime? AddedAt,
    string? Guid,
    string? Key,
    DateTime? LastRatedAt,
    DateTime? LastViewedAt,
    string? LoudnessAnalysisVersion,
    string? MusicAnalysisVersion,
    DateTime? OriginallyAvailableAt,
    string? ParentGuid,
    string? ParentKey,
    string? ParentRatingKey,
    string? ParentThumb,
    string? ParentTitle,
    string? Rating,
    string? RatingKey,
    string? SkipCount,
    string? Studio,
    string? Summary,
    string? Index,
    Bitmap? Thumb,
    string? Title,
    string? Artist,
    string? Type,
    DateTime? UpdatedAt,
    string? UserRating,
    string? ViewCount,
    string? Year,
    Image? Image,
    UltraBlurColors? UltraBlurColors
    // List<Genre> Genres
);