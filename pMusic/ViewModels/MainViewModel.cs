using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using System.Web;
using System.Windows.Input;
using System.Xml.Linq;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Interactivity;
using Avalonia.Media.Imaging;
using Avalonia.Threading;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.DependencyInjection;
using CommunityToolkit.Mvvm.Input;
using KeySharp;
using Microsoft.EntityFrameworkCore;
using pMusic.Database;
using pMusic.Interface;
using pMusic.Models;
using pMusic.Services;
using pMusic.Views;
using SoundFlow.Enums;

namespace pMusic.ViewModels;

public partial class MainViewModel : ViewModelBase
{
    private MusicDbContext _musicDbContext;

    private readonly Plex _plex;
    private readonly IAudioPlayerService _audioPlayer;

    public MusicPlayer MusicPlayer { get; }
    public Sidebar Sidebar { get; }

    [ObservableProperty] private string _greeting = "Welcome to Avalonia!";

    [ObservableProperty] private bool _isLoggedIn = false;

    [ObservableProperty] private bool _isLoggedInTrue = true;

    [ObservableProperty] private Bitmap _thumbnailUrl;
    [ObservableProperty] private bool _isLoading;
    [ObservableProperty] private ViewModelBase _currentPage;

    public MainViewModel(Plex plex, MusicPlayer musicPlayer, IAudioPlayerService audioPlayer,
        MusicDbContext musicDbContext, Sidebar sidebar)
    {
        _plex = plex;
        MusicPlayer = musicPlayer;
        _audioPlayer = audioPlayer;
        _musicDbContext = musicDbContext;
        Sidebar = sidebar;

        _ = CheckLoginStatus();
        _ = LoadPinnedAlbumsThumbnails();
    }

    public MainViewModel() : this(Ioc.Default.GetRequiredService<Plex>(), Ioc.Default.GetRequiredService<MusicPlayer>(),
        Ioc.Default.GetRequiredService<IAudioPlayerService>(), Ioc.Default.GetRequiredService<MusicDbContext>(),
        Ioc.Default.GetRequiredService<Sidebar>())
    {
    }

    public async ValueTask LoadPinnedAlbumsThumbnails()
    {
        // Empty Pinned Albums 
        Sidebar.PinnedAlbum.Clear();

        // Add new pinned albums
        var pinnedAlbums = _musicDbContext.Albums.Where(a => a.IsPinned).ToList();
        var viewModels = pinnedAlbums.Select(pa => new DisplayAlbumViewModel(pa, _plex)).ToList();

        await Task.WhenAll(viewModels.Select(vm => vm.LoadThumbAsync()));

        foreach (var pinnedAlbum in viewModels)
            Sidebar.PinnedAlbum.Add(pinnedAlbum);
    }


    public async ValueTask CheckLoginStatus()
    {
        string? authToken = null;

        try
        {
            authToken = Keyring.GetPassword("com.ib.pmusic", "pMusic", "authToken");
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
            IsLoggedInTrue = false;
            await GetUserInfo();
        }
        else
        {
            IsLoggedIn = false;
            IsLoggedInTrue = true;
        }
    }

    [RelayCommand]
    public async Task Logout()
    {
        Keyring.SetPassword("com.ib.pmusic", "pMusic", "cIdentifier", "");
        Keyring.SetPassword("com.ib.pmusic", "pMusic", "id", "");
        Keyring.SetPassword("com.ib.pmusic", "pMusic", "code", "");
        Keyring.SetPassword("com.ib.pmusic", "pMusic", "authToken", "");

        IsLoggedIn = false;
        IsLoggedInTrue = true;

        // OpenNewWindow();
        ToLoginWindow();
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

    [RelayCommand]
    public void GoToAlbumDetialsPage(Album album)
    {
        GoToAlbum(album);
    }

    private async Task GetUserInfo()
    {
        ThumbnailUrl = await _plex.GetUserProfilePicture();
        Console.WriteLine($"thumbnail url {ThumbnailUrl}");
    }

    private void OpenNewWindow()
    {
        var mainWindow = ((IClassicDesktopStyleApplicationLifetime)Application.Current.ApplicationLifetime).MainWindow;
        var newWindow = new LoginWindow();
        newWindow.DataContext = new LoginViewModel();

        newWindow.Show(); // Opens the window non-modally
        mainWindow.Close();
    }

    private void ToLoginWindow() => GoToLoginWindow();
}