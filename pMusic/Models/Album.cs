using System;
using Avalonia.Media.Imaging;

namespace pMusic.Models;

public partial record Album(
    string RatingKey,
    string Key,
    string ParentRatingKey,
    string Guid,
    string ParentGuid,
    string Studio,
    string Type,
    string Title,
    string Artist,
    string ParentKey,
    string ParentTitle,
    string Summary,
    int Index,
    double Rating,
    int LastViewedAt,
    string Year,
    Bitmap? Thumb, 
    string Art,
    string ParentThumb,
    DateTime OriginallyAvailableAt,
    int AddedAt,
    int UpdatedAt,
    int LoudnessAnalysisVersion,
    int MusicAnalysisVersion
);