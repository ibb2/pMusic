using System.Threading;
using System.Threading.Tasks;
using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using CommunityToolkit.Mvvm.DependencyInjection;
using CommunityToolkit.Mvvm.Input;
using pMusic.Services;
using pMusic.Views;

namespace pMusic.ViewModels;

public partial class LoginViewModel : ViewModelBase
{
    private Plex _plex;

    private static CancellationTokenSource _cts = new();

    public CancellationToken cancellationToken = _cts.Token;


    public LoginViewModel(Plex plex)
    {
        _plex = plex;
    }

    public LoginViewModel() : this(Ioc.Default.GetRequiredService<Plex>())
    {
    }

    public async ValueTask Login()
    {
        var mainWindow = ((IClassicDesktopStyleApplicationLifetime)Application.Current.ApplicationLifetime).MainWindow;

        var topLevel = mainWindow;

        // Generate pin
        var (id, code) = await _plex.GeneratePin();

        // Verify pin
        var appAuthUrl = await _plex.CheckPin(code);

        await topLevel.Launcher.LaunchUriAsync(appAuthUrl);

        await _plex.PollPin(id, code);

        await Redirect();
    }

    private async Task Redirect()
    {
        await _cts.CancelAsync();
        ToMainWindow();
        // OpenNewWindow();
    }

    private void OpenNewWindow()
    {
        var mainWindow = ((IClassicDesktopStyleApplicationLifetime)Application.Current.ApplicationLifetime).MainWindow;
        var newWindow = new MainWindow();
        newWindow.DataContext = new MainViewModel();

        newWindow.Show(); // Opens the window non-modally
        mainWindow.Close();
    }

    private void ToMainWindow() => GoToMainWindow();
}