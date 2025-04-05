using CommunityToolkit.Mvvm.ComponentModel;

namespace pMusic.ViewModels;

public partial class AlbumViewModel : ViewModelBase
{
    [ObservableProperty] public string _title = "Album";
    [ObservableProperty] public string _albumTitle = "MUSIC";
    [ObservableProperty] public string _albumArtist = "Playboi Carti";
    [ObservableProperty] public string _albumReleaseDate = "2025";
    [ObservableProperty] public string _albumTrackLength = "30";
    [ObservableProperty] public string _albumDuration = "1h 16m";

    public AlbumViewModel()
    {
    }
}