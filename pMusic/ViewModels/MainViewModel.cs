using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using System.Web;
using System.Windows.Input;
using System.Xml.Linq;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Media.Imaging;
using Avalonia.Threading;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.DependencyInjection;
using CommunityToolkit.Mvvm.Input;
using KeySharp;
using pMusic.Interface;
using pMusic.Models;
using pMusic.Services;
using SoundFlow.Enums;

namespace pMusic.ViewModels;

public partial class MainViewModel : ViewModelBase
{
    private readonly Plex _plex;
    private readonly IAudioPlayerService _audioPlayer;
    public static MusicPlayer MusicPlayer { get; set; }

    [ObservableProperty] private string _greeting = "Welcome to Avalonia!";

    [ObservableProperty] private bool _isLoggedIn =
        !string.IsNullOrEmpty(Keyring.GetPassword("com.ib.pmusic-avalonia", "pMusic-Avalonia", "authToken"));

    [ObservableProperty] private bool _isLoggedInTrue =
        string.IsNullOrEmpty(Keyring.GetPassword("com.ib.pmusic-avalonia", "pMusic-Avalonia", "authToken"));

    [ObservableProperty] private Bitmap _thumbnailUrl;
    [ObservableProperty] private bool _isLoading;
    [ObservableProperty] private ViewModelBase _currentPage;
    [ObservableProperty] private float _pos;

    public MainViewModel(Plex plex, MusicPlayer musicPlayer, IAudioPlayerService audioPlayer)
    {
        _plex = plex;
        MusicPlayer = musicPlayer;
        _audioPlayer = audioPlayer;
        _pos = MusicPlayer.Position;
    }

    public MainViewModel() : this(Ioc.Default.GetRequiredService<Plex>(), Ioc.Default.GetRequiredService<MusicPlayer>(),
        Ioc.Default.GetRequiredService<IAudioPlayerService>())
    {
    }

    public void CheckLoginStatus()
    {
        string? authToken = null;

        try
        {
            authToken = Keyring.GetPassword("com.ib.pmusic-avalonia", "pMusic-Avalonia", "authToken");
        }
        catch (Exception ex)
        {
            authToken = null;
        }

        // var auth = services.GetRequiredService<IAuthenticationService>();
        // var authenticated = await auth.RefreshAsync();
        if (!string.IsNullOrEmpty(authToken))
        {
            IsLoggedIn = true;
        }
        else
        {
            IsLoggedIn = false;
        }
    }

    public async Task GetUserInfo()
    {
        ThumbnailUrl = await _plex.GetUserProfilePicture();
        Console.WriteLine($"thumbnail url {ThumbnailUrl}");
    }

    public void PlayPause()
    {
        if (MusicPlayer.PlaybackState == PlaybackState.Playing)
        {
            _audioPlayer.PauseAudio();
        }
        else
        {
            _audioPlayer.ResumeAudio();
        }
    }
}