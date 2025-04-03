namespace pMusic.Models;

public partial record Track(
    string RatingKey,
    string Key,
    string ParentRatingKey,
    string GrandparentRatingKey,
    string Guid,
    string ParentGuid,
    string GrandparentGuid,
    string ParentStudio,
    string Type,
    string Title,
    string GrandparentKey,
    string ParentKey,
    string GrandparentTitle,
    string ParentTitle,
    string Summary,
    int Index,
    int ParentIndex,
    int RatingCount,
    int ParentYear,
    string Thumb,
    string Art,
    string ParentThumb,
    string GrandparentThumb,
    string GrandparentArt,
    int Duration,
    long AddedAt,
    long UpdatedAt,
    int MusicAnalysisVersion,
    Media Media
);

public partial record Media(
    string Id,
    int Duration,
    int Bitrate,
    double AudioChannels,
    string AudioCodec,
    string Container,
    Part Part
);

public record Part(
    string Id,
    string Key,
    int Duration,
    string File,
    long Size,
    string Container
);