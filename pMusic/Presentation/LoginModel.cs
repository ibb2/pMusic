using System.Net;
using System.Net.Http.Json;
using System.Web;
using System.Xml.Linq;
using Windows.Security.Credentials;
using Windows.System;
using KeySharp;

namespace pMusic.Presentation;

public partial record LoginModel(IDispatcher Dispatcher, INavigator Navigator, IAuthenticationService Authentication)
{
    public string Title { get; } = "Login";

    private static HttpClient httpClient = new()
    {
        BaseAddress = new Uri("https://jsonplaceholder.typicode.com")
    };

    public async ValueTask Login(CancellationToken token)
    {
        var clientIdentifier = "";
        try
        {
            clientIdentifier = Keyring.GetPassword("com.ib.pmusic", "pMusic", "cIdentifier");
        }
        catch (Exception ex)
        {
            // Initial Setup create the Client Identifier and store for later use
            var guid = Guid.NewGuid().ToString();
            clientIdentifier = guid;
            Keyring.SetPassword("com.ib.pmusic", "pMusic", "cIdentifier", guid);
        }

        var plexPinUri = new Uri("https://plex.tv/api/v2/pins");

        var contents = new FormUrlEncodedContent([
            new KeyValuePair<string, string>("strong", "true"),
            new KeyValuePair<string, string>("X-Plex-Product", "pMusic"),
            new KeyValuePair<string, string>("X-Plex-Client-Identifier", clientIdentifier)
        ]);

        var results = await httpClient.PostAsync(plexPinUri, contents);

        var id = "";
        var code = "";

        if (results.IsSuccessStatusCode)
        {
            var responseBody = results.Content.ReadAsStringAsync().Result;
            var incomingXml = XElement.Parse(responseBody);

            id = incomingXml.Attribute("id").ToString().Split('"')[1];
            code = incomingXml.Attribute("code").ToString().Split('"')[1];

            Keyring.SetPassword("com.ib.pmusic", "pMusic", "id", id);
            Keyring.SetPassword("com.ib.pmusic", "pMusic", "code", code);

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
            { "context[device][product]", "pMusic" } // Flattened for URL encoding
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

        await Launcher.LaunchUriAsync(authAppUrl);

        var isPinPolling = true;
        string? authToken = null;

        do
        {
            var plexPinPoll =
                new Uri(
                    $"https://plex.tv/api/v2/pins/{id}?code={Uri.EscapeDataString(code)}&X-Plex-Client-Identifier={Uri.EscapeDataString(clientIdentifier)}");
            var pinResults = await httpClient.GetStringAsync(plexPinPoll);
            var pinIncomingResults = XElement.Parse(pinResults);
            var parsedToken = pinIncomingResults.Attribute("authToken").ToString().Split('"')[1];
            if (parsedToken.Length != 0 || !parsedToken.IsNullOrEmpty())
            {
                authToken = parsedToken;
                Keyring.SetPassword("com.ib.pmusic", "pMusic", "authToken", authToken);
                isPinPolling = false;
                Console.WriteLine("Successfully Authenticated");
            } else {
            Console.WriteLine("Waiting");
            }
        } while (isPinPolling && authToken == null);

        Console.WriteLine($"Successfully Authenticated {authToken.Split('"')[1]}");

        await Navigator.NavigateViewModelAsync<MainModel>(this);
        // var success = await Authentication.LoginAsync(Dispatcher);
        // if (success)
        // {
        //     await Navigator.NavigateViewModelAsync<MainModel>(this, qualifier: Qualifiers.ClearBackStack);
        // }
    }
}
