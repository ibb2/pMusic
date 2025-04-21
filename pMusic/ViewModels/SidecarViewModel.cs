using System.Collections.Generic;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.DependencyInjection;
using pMusic.Models;

namespace pMusic.ViewModels;

public partial class SidecarViewModel : ObservableObject
{
    [ObservableProperty] public bool isOpen = true;
    [ObservableProperty] public List<Track> queue = new();

    public SidecarViewModel(MusicPlayer musicPlayer)
    {
        MusicPlayer = musicPlayer;
    }

    public SidecarViewModel() : this(Ioc.Default.GetRequiredService<MusicPlayer>())
    {
    }

    public MusicPlayer MusicPlayer { get; set; }

    public void ToggleSidecar()
    {
        IsOpen = !IsOpen;
    }
}