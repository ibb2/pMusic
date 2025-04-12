using System.Collections.ObjectModel;
using System.Linq;
using CommunityToolkit.Mvvm.ComponentModel;
using pMusic.Database;
using pMusic.Models;

namespace pMusic.Services;

public partial class Sidebar : ObservableObject
{
    [ObservableProperty] public ObservableCollection<Album> pinnedAlbum = new();
}