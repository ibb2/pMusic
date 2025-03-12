using KeySharp;

namespace pMusic.Presentation;

public partial record MainModel
{
    private INavigator _navigator;

    public MainModel(
        IStringLocalizer localizer,
        IOptions<AppConfig> appInfo,
        IAuthenticationService authentication,
        INavigator navigator)
    {
        _navigator = navigator;
        _authentication = authentication;
        Title = "Main";
        Title += $" - {localizer["ApplicationName"]}";
        Title += $" - {appInfo?.Value?.Environment}";
    }

    public string? Title { get; }

    public IState<string> Name => State<string>.Value(this, () => string.Empty);

    public async Task GoToSecond()
    {
        var name = await Name;
        await _navigator.NavigateViewModelAsync<SecondModel>(this, data: new Entity(name!));
    }

    public async ValueTask Logout(CancellationToken token)
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

        Console.WriteLine($"Auth Token {authToken}");
        if (!authToken.IsNullOrEmpty()) Keyring.DeletePassword("com.ib.pmusic", "pMusic","authToken");
        Console.WriteLine("Logged out Successfully");
        await _navigator.NavigateViewModelAsync<LoginModel>(this);
        // await _authentication.LogoutAsync(token);
    }

    private IAuthenticationService _authentication;
}
