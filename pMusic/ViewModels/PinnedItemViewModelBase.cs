using System;
using Avalonia.Media.Imaging;
using CommunityToolkit.Mvvm.ComponentModel;

namespace pMusic.ViewModels;

public partial class PinnedItemViewModelBase : ObservableObject
{
    [ObservableProperty] private Bitmap? image;
    public string Title { get; set; }
    public string ImageUrl { get; set; }

    public TimeSpan Duration { get; set; }
}