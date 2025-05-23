using CommunityToolkit.Mvvm.ComponentModel;
using pMusic.Models;

namespace pMusic.ViewModels;

public partial class PlaylistViewModel : ViewModelBase
{
    [ObservableProperty] public Playlist playlist;
}