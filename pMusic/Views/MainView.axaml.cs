using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Web;
using System.Xml.Linq;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.VisualTree;
using KeySharp;
using pMusic.Models;
using pMusic.ViewModels;

namespace pMusic.Views;

public partial class MainView : UserControl
{
    public MainView()
    {
        InitializeComponent();
        this.Loaded += MainWindow_Loaded;
    }

    private static readonly HttpClient HttpClient = new()
    {
        BaseAddress = new Uri("https://jsonplaceholder.typicode.com")
    };

    public async void Login(object sender, RoutedEventArgs e)
    {
        try
        {
            var launcher = TopLevel.GetTopLevel(this).Launcher;

            var clientIdentifier = "";
            try
            {
                clientIdentifier = Keyring.GetPassword("com.ib.pmusic-avalonia", "pMusic-Avalonia", "cIdentifier");
            }
            catch (Exception ex)
            {
                // Initial Setup create the Client Identifier and store for later use
                var guid = Guid.NewGuid().ToString();
                clientIdentifier = guid;
                Keyring.SetPassword("com.ib.pmusic-avalonia", "pMusic-Avalonia", "cIdentifier", guid);
            }

            var plexPinUri = new Uri("https://plex.tv/api/v2/pins");

            var contents = new FormUrlEncodedContent([
                new KeyValuePair<string, string>("strong", "true"),
                new KeyValuePair<string, string>("X-Plex-Product", "pMusic-Avalonia"),
                new KeyValuePair<string, string>("X-Plex-Client-Identifier", clientIdentifier)
            ]);

            var results = await HttpClient.PostAsync(plexPinUri, contents);

            var id = "";
            var code = "";

            if (results.IsSuccessStatusCode)
            {
                var responseBody = results.Content.ReadAsStringAsync().Result;
                var incomingXml = XElement.Parse(responseBody);

                id = incomingXml.Attribute("id").ToString().Split('"')[1];
                code = incomingXml.Attribute("code").ToString().Split('"')[1];

                Keyring.SetPassword("com.ib.pmusic-avalonia", "pMusic-Avalonia", "id", id);
                Keyring.SetPassword("com.ib.pmusic-avalonia", "pMusic-Avalonia", "code", code);

                Console.WriteLine("Successfully generated pin");
            }
            else
            {
                Console.WriteLine("Failed to get generated pin");
            }

            // Navigate to Plex.tv to authenticate
            var queryParams = new Dictionary<string, string>
            {
                { "clientID", clientIdentifier },
                { "code", code },
                // { "forwardUrl", "https://localhost" },
                { "context[device][product]", "pMusic-Avalonia" } // Flattened for URL encoding
            };

            // HttpUtility.UrlPathEncode(queryParams);
            static string EncodeFormUrlEncoded(Dictionary<string, string> data)
            {
                var keyValuePairs = new List<string>();
                foreach (var item in data)
                {
                    keyValuePairs.Add($"{HttpUtility.UrlEncode(item.Key)}={HttpUtility.UrlEncode(item.Value)}");
                }

                return string.Join("&", keyValuePairs);
            }

            var encodedValues = EncodeFormUrlEncoded(queryParams);

            var authAppUrl = new Uri(
                    "https://app.plex.tv/auth#?" + encodedValues)
                ;

            await launcher.LaunchUriAsync(authAppUrl);

            var isPinPolling = true;
            string? authToken = null;

            do
            {
                var plexPinPoll =
                    new Uri(
                        $"https://plex.tv/api/v2/pins/{id}?code={Uri.EscapeDataString(code)}&X-Plex-Client-Identifier={Uri.EscapeDataString(clientIdentifier)}");
                var pinResults = await HttpClient.GetStringAsync(plexPinPoll);
                var pinIncomingResults = XElement.Parse(pinResults);
                var parsedToken = pinIncomingResults.Attribute("authToken").ToString().Split('"')[1];
                if (parsedToken.Length != 0 || !string.IsNullOrEmpty(parsedToken))
                {
                    authToken = parsedToken;
                    Keyring.SetPassword("com.ib.pmusic-avalonia", "pMusic-Avalonia", "authToken", authToken);
                    isPinPolling = false;
                    Console.WriteLine("Successfully Authenticated");
                }
                else
                {
                    Console.WriteLine("Waiting");
                }
            } while (isPinPolling && authToken == null);

            Console.WriteLine($"Redirecting");
            var vm = this.DataContext as MainViewModel;
            await vm?.GetUserInfo()!;

            // await Navigator.NavigateViewModelAsync<MainModel>(this, qualifier: Qualifiers.ClearBackStack);
            // var success = await Authentication.LoginAsync(Dispatcher);
            // if (success)
            // {
            //     await Navigator.NavigateViewModelAsync<MainModel>(this, qualifier: Qualifiers.ClearBackStack);
            // }
        }
        catch (Exception ex)
        {
            throw; // TODO handle exception
        }
    }

    private void MainWindow_Loaded(object? sender, RoutedEventArgs e)
    {
        if (DataContext is MainViewModel viewModel)
        {
            // Fire and forget
            _ = viewModel.GetUserInfo();
        }
    }

    public void GoToAlbum(object? sender, PointerEventArgs pointerEventArgs)
    {
        if (sender is not Border border)
            return;

        if (border.DataContext is not AlbumViewModel albumVm)
            return;

        if (albumVm.Album is null)
            return;

        if (DataContext is not MainViewModel viewModel)
            return;
    }
}