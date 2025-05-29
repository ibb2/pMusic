using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using pMusic.ViewModels;

namespace pMusic.Services;

public partial class Sidebar : ObservableObject
{
    [ObservableProperty] public ObservableCollection<PinnedItemViewModelBase> pinned = new();
}