using CommunityToolkit.Mvvm.ComponentModel;

namespace pMusic.ViewModels;

public partial class AlbumViewModel: ViewModelBase
{
    [ObservableProperty]
    public string _title = "Album";

    public AlbumViewModel()
    {
        
    }
}