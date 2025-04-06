using CommunityToolkit.Mvvm.ComponentModel;

namespace pMusic.ViewModels;

public partial class ArtistViewModel: ViewModelBase
{
    [ObservableProperty]
    public string _title = "Title";
}