using System.Net;
using System.Net.Http.Json;
using System.Web;
using System.Xml.Linq;
using Windows.Security.Credentials;
using Windows.System;

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
            var vault = new PasswordVault();
            var credential = vault.Retrieve("pMusic", "cIdentifier");
            clientIdentifier = credential.Password;
        }
        catch (Exception ex)
        {
            // Initial Setup create the Client Identifier and store for later use
            var guid = Guid.NewGuid().ToString();
            clientIdentifier = guid;
            // var vault = new PasswordVault();
            // var credential = new PasswordCredential("pMusic", "cIdentifier", guid);
            // vault.Add(credential);
        }

        var plexPinUri = new Uri("https://plex.tv/api/v2/pins");
        
        var contents = new FormUrlEncodedContent([
            new KeyValuePair<string, string>("strong", "true"),
            new KeyValuePair<string, string>("X-Plex-Product", "pMusic"),
            new KeyValuePair<string, string>("X-Plex-Client-Identifier", clientIdentifier)
        ]);
        
        var results = await httpClient.PostAsync(plexPinUri, contents);
        var pinid = "";
        var code = "";
        if (results.IsSuccessStatusCode)
        {
            Console.WriteLine("Successfully generated pin");
            var responseBody = results.Content.ReadAsStringAsync().Result;
            var incomingXml = XElement.Parse(responseBody);
            Console.WriteLine(incomingXml.Attribute("id"));
            pinid = incomingXml.Attribute("id").ToString();
            code = incomingXml.Attribute("code").ToString();
            Console.WriteLine(incomingXml.Attribute("code"));
        }
        else
        {
            Console.WriteLine("Failed to get generated pin");
        }
        
        // Navigate to Plex.tv to authenticate
        var queryParams = new Dictionary<string, string>
        {
            { "clientID", clientIdentifier },
            { "code", code.Split('"')[1] },
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

        string queryString = string.Join("&", queryParams
            .Select(kvp => $"{WebUtility.UrlEncode(kvp.Key)}={WebUtility.UrlEncode(kvp.Value)}"));

        string finalUrl = $"https://app.plex.tv/auth#?{queryString}";

        var encodedValues = EncodeFormUrlEncoded(queryParams);

        var authAppUrl = new Uri(
        "https://app.plex.tv/auth#?" + encodedValues)
        ;
        
        Console.WriteLine($"Encoded Url {authAppUrl}");
        
        await Launcher.LaunchUriAsync(authAppUrl);

        var isPinPolling = true;
        String? authToken = null;
        do
        {
            var pcontents = new FormUrlEncodedContent([
                new KeyValuePair<string, string>("code", code.Split('"')[1]),
                new KeyValuePair<string, string>("X-Plex-Client-Identifier", clientIdentifier)
            ]);
            var plexPinPoll = new Uri($"https://plex.tv/api/v2/pins/{pinid.Split('"')[1]}??code={code.Split('"')[1]}&X-Plex-Client-Identifier={clientIdentifier}");
            var presults = await httpClient.GetStringAsync(plexPinPoll);
            var pinIncomingResults = XElement.Parse(presults);
            Console.WriteLine($"Working {presults} {pinIncomingResults.Attribute("authToken").ToString().Split('"')[1].Length}");
            if (pinIncomingResults.Attribute("authToken").ToString().Split('"')[1].Length != 0)
            {
                authToken = pinIncomingResults.Attribute("authToken").ToString();
                Console.WriteLine("Successfully Authenticated");
                isPinPolling = false;
            }
            Console.WriteLine("Waiting");
        } while (isPinPolling);
        Console.WriteLine($"Successfully Authenticated {authToken.Split('"')[1]}");

        // var success = await Authentication.LoginAsync(Dispatcher);
        // if (success)
        // {
        //     await Navigator.NavigateViewModelAsync<MainModel>(this, qualifier: Qualifiers.ClearBackStack);
        // }
    }



}
