namespace pMusic.Models;


public class LibraryDir
{
    public bool AllowSync { get; set; }
    public string Art { get; set; }
    public string Composite { get; set; }
    public bool Filters { get; set; }
    public bool Refreshing { get; set; }
    public string Thumb { get; set; }
    public int Key { get; set; }
    public string Type { get; set; }
    public string Title { get; set; }
    public string Agent { get; set; }
    public string Scanner { get; set; }
    public string Language { get; set; }
    public string UUID { get; set; }
    public long UpdatedAt { get; set; }
    public long CreatedAt { get; set; }
    public long ScannedAt { get; set; }
    public bool Content { get; set; }
    public bool Directory { get; set; }
    public long ContentChangedAt { get; set; }
    public bool Hidden { get; set; }
    public LocationInfo Location { get; set; }
}

public class LocationInfo
{
    public int Id { get; set; }
    public string Path { get; set; }
}