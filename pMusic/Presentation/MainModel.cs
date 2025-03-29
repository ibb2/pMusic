using KeySharp;
using pMusic.Helpers;
using SoundFlow.Components;
using SoundFlow.Enums;

namespace pMusic.Presentation;

public partial record MainModel
{
    private INavigator _navigator;
    private IAudioPlayerService _audioPlayer;

    public MainModel(
        IAudioPlayerService audioPlayerService,
        IStringLocalizer localizer,
        IOptions<AppConfig> appInfo,
        IAuthenticationService authentication,
        INavigator navigator)
    {
        _audioPlayer = audioPlayerService;
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
    
    public IState<bool> IsPlaying => _audioPlayer.IsPlaying;

    public async ValueTask TogglePlayPause()
    {
        if (IsPlaying.Value().Result)
        {
            await IsPlaying.UpdateAsync(_ => false);
            await _audioPlayer.PauseAudio();
        }
        else {
            await IsPlaying.UpdateAsync(_ => true);
            await _audioPlayer.ResumeAudio();
        }
    }


    private IAuthenticationService _authentication;
}
