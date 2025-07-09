using CommunityToolkit.Mvvm.ComponentModel;
using pMusic.Models;

namespace pMusic.ViewModels;

public partial class ArtistViewModel : ViewModelBase
{
    [ObservableProperty] public Artist _Artist;
    [ObservableProperty] public string _title = "Title";
}