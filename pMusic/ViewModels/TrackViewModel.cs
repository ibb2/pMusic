using CommunityToolkit.Mvvm.ComponentModel;

namespace pMusic.ViewModels;

public partial class TrackViewModel: ViewModelBase
{
    [ObservableProperty]
    public string _title = "Track Title";
}