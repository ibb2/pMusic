using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using KeySharp;
using pMusic.Models;

namespace pMusic.ViewModels;

public partial class ArtistViewModel : ViewModelBase
{
    [ObservableProperty] public Artist _Artist;
    [ObservableProperty] public string _imageUrl;
    [ObservableProperty] public string _title = "Title";

    [RelayCommand]
    public void LoadAlbumCover()
    {
        ImageUrl = Artist.Thumb + "?X-Plex-Token=" +
                   Keyring.GetPassword("com.ib", "pmusic", "authToken");
    }
}