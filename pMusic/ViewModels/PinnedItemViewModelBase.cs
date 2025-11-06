using System;
using Avalonia.Media.Imaging;
using CommunityToolkit.Mvvm.ComponentModel;

namespace pMusic.ViewModels;

public partial class PinnedItemViewModelBase : ObservableObject
{
    [ObservableProperty] public TimeSpan duration;
    [ObservableProperty] private Bitmap? image;
    [ObservableProperty] public string imageUrl;

    [ObservableProperty] public string title;
}