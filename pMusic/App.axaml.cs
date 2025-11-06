using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Data.Core.Plugins;
using Avalonia.Markup.Xaml;
using CommunityToolkit.Mvvm.DependencyInjection;
using KeySharp;
using ManagedBass;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using pMusic.Database;
using pMusic.DI;
using pMusic.ViewModels;
using pMusic.Views;

namespace pMusic;

public class App : Application
{
    public static ServiceProvider? ServiceProvider { get; set; }

    public override void Initialize()
    {
        AvaloniaXamlLoader.Load(this);

#if DEBUG
        this.AttachDeveloperTools();
#endif
    }

    public override async void OnFrameworkInitializationCompleted()
    {
        {
            if (!Bass.Init())
            {
                Console.WriteLine("BASS initialization failed.");
            }
            else
            {
                Console.WriteLine("BASS initialized successfully.");
            }

            // If you use CommunityToolkit, line below is needed to remove Avalonia data validation.
            // Without this line you will get duplicate validations from both Avalonia and CT
            BindingPlugins.DataValidators.RemoveAt(0);

            // Register all the services needed for the application to run
            var collection = new ServiceCollection();
            collection.AddCommonServices();

            // Creates a ServiceProvider containing services from the provided IServiceCollection
            var services = collection.BuildServiceProvider();
            ServiceProvider = services;

            Ioc.Default.ConfigureServices(services);

            try
            {
                var dbContext = Ioc.Default.GetRequiredService<MusicDbContext>();
                await dbContext.Database.MigrateAsync();
                Console.WriteLine("Migrations applied successfully.");
            }
            catch (Exception ex)
            {
                // Handle exceptions, such as logging the error or displaying a message to the user
                Console.WriteLine($"An error occurred while applying migrations: {ex.Message}");
            }

            try
            {
                Keyring.GetPassword("com.ib", "pmusic", "authToken");
            }
            catch (Exception ex)
            {
                Keyring.SetPassword("com.ib", "pmusic", "cIdentifier", "");
                Keyring.SetPassword("com.ib", "pmusic", "id", "");
                Keyring.SetPassword("com.ib", "pmusic", "code", "");
                Keyring.SetPassword("com.ib", "pmusic", "authToken", "");
            }


            var vm = services.GetRequiredService<MainViewModel>();
            if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
            {
                // Avoid duplicate validations from both Avalonia and the CommunityToolkit. 
                // More info: https://docs.avaloniaui.net/docs/guides/development-guides/data-validation#manage-validationplugins
                DisableAvaloniaDataAnnotationValidation();

                var authToken = Keyring.GetPassword("com.ib", "pmusic", "authToken");

                if (authToken.Length > 0)
                {
                    desktop.MainWindow = new MainWindow
                    {
                        DataContext = vm
                    };

                    return;
                }

                var loginWindow = new LoginWindow();
                var loginViewModel = new LoginViewModel();

                loginWindow.DataContext = loginViewModel;
                desktop.MainWindow = loginWindow;

                try
                {
                    await Task.Delay(Timeout.Infinite, cancellationToken: loginViewModel.cancellationToken);
                }
                catch (TaskCanceledException ex)
                {
                    var mainWindow = new MainWindow();
                    desktop.MainWindow = mainWindow;

                    mainWindow.Show();
                    loginWindow.Close();
                    return;
                }
            }
            else if (ApplicationLifetime is ISingleViewApplicationLifetime singleViewPlatform)
            {
                singleViewPlatform.MainView = new MainView
                {
                    DataContext = vm
                };
            }

            base.OnFrameworkInitializationCompleted();
        }
    }

    private void DisableAvaloniaDataAnnotationValidation()
    {
        // Get an array of plugins to remove
        var dataValidationPluginsToRemove =
            BindingPlugins.DataValidators.OfType<DataAnnotationsValidationPlugin>().ToArray();

        // remove each entry found
        foreach (var plugin in dataValidationPluginsToRemove)
        {
            BindingPlugins.DataValidators.Remove(plugin);
        }
    }
}