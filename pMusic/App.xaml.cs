using KeySharp;
using pMusic.Helpers;
using pMusic.Services;
using Uno.Resizetizer;

namespace pMusic;

public partial class App : Application
{
    /// <summary>
    /// Initializes the singleton application object. This is the first line of authored code
    /// executed, and as such is the logical equivalent of main() or WinMain().
    /// </summary>
    public App()
    {
        this.InitializeComponent();
    }

    protected Window? MainWindow { get; private set; }
    public IHost? Host { get; private set; }

    protected async override void OnLaunched(LaunchActivatedEventArgs args)
    {
        var builder = this.CreateBuilder(args)
            // Add navigation support for toolkit controls such as TabBar and NavigationView
            .UseToolkitNavigation()
            .Configure(host => host
#if DEBUG
                // Switch to Development environment when running in DEBUG
                .UseEnvironment(Environments.Development)
#endif
                .UseLogging(configure: (context, logBuilder) =>
                {
                    // Configure log levels for different categories of logging
                    logBuilder
                        .SetMinimumLevel(
                            context.HostingEnvironment.IsDevelopment() ? LogLevel.Information : LogLevel.Warning)

                        // Default filters for core Uno Platform namespaces
                        .CoreLogLevel(LogLevel.Warning);

                    // Uno Platform namespace filter groups
                    // Uncomment individual methods to see more detailed logging
                    //// Generic Xaml events
                    //logBuilder.XamlLogLevel(LogLevel.Debug);
                    //// Layout specific messages
                    //logBuilder.XamlLayoutLogLevel(LogLevel.Debug);
                    //// Storage messages
                    //logBuilder.StorageLogLevel(LogLevel.Debug);
                    //// Binding related messages
                    //logBuilder.XamlBindingLogLevel(LogLevel.Debug);
                    //// Binder memory references tracking
                    //logBuilder.BinderMemoryReferenceLogLevel(LogLevel.Debug);
                    //// DevServer and HotReload related
                    //logBuilder.HotReloadCoreLogLevel(LogLevel.Information);
                    //// Debug JS interop
                    //logBuilder.WebAssemblyLogLevel(LogLevel.Debug);
                }, enableUnoLogging: true)
                .UseSerilog(consoleLoggingEnabled: true, fileLoggingEnabled: true)
                .UseConfiguration(configure: configBuilder =>
                    configBuilder
                        .EmbeddedSource<App>()
                        .Section<AppConfig>()
                )
                // Enable localization (see appsettings.json for supported languages)
                .UseLocalization()
                // Register Json serializers (ISerializer and ISerializer)
                .UseSerialization((context, services) => services
                    .AddContentSerializer(context)
                    .AddJsonTypeInfo(WeatherForecastContext.Default.IImmutableListWeatherForecast))
                .UseHttp((context, services) => services
                    // Register HttpClient
#if DEBUG
                    // DelegatingHandler will be automatically injected into Refit Client
                    .AddTransient<DelegatingHandler, DebugHttpHandler>()
#endif
                    .AddSingleton<IWeatherCache, WeatherCache>()
                    .AddRefitClient<IApiClient>(context))
                .UseAuthentication(auth =>
                    auth.AddWeb(name: "WebAuthentication")
                )
                .ConfigureServices((context, services) =>
                {
                    // TODO: Register your services
                    //services.AddSingleton<IMyService, MyService>();
                    services.AddSingleton<Plex>(sp => {
                        var clientFactory = sp.GetRequiredService<IHttpClientFactory>();
                        var client = clientFactory.CreateClient(); // or use a named client if needed
                        return new Plex(client);
                    });
                    services.AddSingleton<IAudioPlayerService, AudioPlayerService>();
                    services.AddTransient<IArtistService, ArtistService>();
                    services.AddTransient<ArtistModel>();
                    services.AddTransient<ArtistViewModel>();
                    services.AddTransient<AlbumModel>();
                    services.AddTransient<AlbumViewModel>();
                    services.AddTransient<TrackModel>();
                    services.AddTransient<TrackViewModel>();
                    services.AddTransient<MainModel>();
                    services.AddTransient<MainViewModel>();
                    services.AddTransient<HomeModel>();
                    services.AddTransient<HomeViewModel>();
                    
                })
                .UseNavigation(ReactiveViewModelMappings.ViewModelMappings, RegisterRoutes)
            );
        MainWindow = builder.Window;

#if DEBUG
        MainWindow.UseStudio();
#endif
        MainWindow.SetWindowIcon();

        Host = await builder.NavigateAsync<Shell>
        (initialNavigate: async (services, navigator) =>
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
            if (!authToken.IsNullOrEmpty())
            {
                await navigator.NavigateViewModelAsync<MainModel>(this, qualifier: Qualifiers.Nested);
            }
            else
            {
                await navigator.NavigateViewModelAsync<LoginModel>(this, qualifier: Qualifiers.Nested);
            }
        });
    }

    private static void RegisterRoutes(IViewRegistry views, IRouteRegistry routes)
    {
        views.Register(
            new ViewMap(ViewModel: typeof(ShellModel)),
            new ViewMap<LoginPage, LoginModel>(),
            new ViewMap<MainPage, MainModel>(),
            new DataViewMap<SecondPage, SecondModel, Entity>(),
            new ViewMap<ArtistPage, ArtistModel>(),
            new DataViewMap<AlbumPage, AlbumModel, Artist>()
        );

        routes.Register(
            new RouteMap("", View: views.FindByViewModel<ShellModel>(),
                Nested:
                [
                    new("Login", View: views.FindByViewModel<LoginModel>()),
                    new("Main", View: views.FindByViewModel<MainModel>(), IsDefault: true),
                    new("Second", View: views.FindByViewModel<SecondModel>()),
                    new("Artist", View: views.FindByViewModel<ArtistModel>()),
                    new ("Album", View: views.FindByViewModel<AlbumModel>()),
                ]
            )
        );
    }
}
