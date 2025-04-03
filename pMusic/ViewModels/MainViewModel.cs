using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using System.Web;
using System.Xml.Linq;
using Avalonia.Controls;
using CommunityToolkit.Mvvm.ComponentModel;
using KeySharp;

namespace pMusic.ViewModels;

public partial class MainViewModel : ViewModelBase
{
    [ObservableProperty] private string _greeting = "Welcome to Avalonia!";
    [ObservableProperty] private bool _isLoggedIn = !string.IsNullOrEmpty(Keyring.GetPassword("com.ib.pmusic-avalonia", "pMusic-Avalonia", "authToken"));
    [ObservableProperty] private bool _isLoggedInTrue = string.IsNullOrEmpty(Keyring.GetPassword("com.ib.pmusic-avalonia", "pMusic-Avalonia", "authToken"));

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
}