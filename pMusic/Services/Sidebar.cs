using System.Collections.ObjectModel;
using System.Linq;
using CommunityToolkit.Mvvm.ComponentModel;
using pMusic.Database;
using pMusic.Models;
using pMusic.ViewModels;

namespace pMusic.Services;

public partial class Sidebar : ObservableObject
{
    [ObservableProperty] public ObservableCollection<DisplayAlbumViewModel> pinnedAlbum = new();
}