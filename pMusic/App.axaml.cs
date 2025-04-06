using System;
using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Data.Core;
using Avalonia.Data.Core.Plugins;
using System.Linq;
using System.Threading.Tasks;
using Avalonia.Markup.Xaml;
using CommunityToolkit.Mvvm.DependencyInjection;
using Microsoft.Extensions.DependencyInjection;
using pMusic.DI;
using pMusic.Services;
using pMusic.ViewModels;
using pMusic.Views;

namespace pMusic;

public class App : Application
{

    public static ServiceProvider? ServiceProvider { get; set; }

    public override void Initialize()
    {
        AvaloniaXamlLoader.Load(this);
    }

    public override void OnFrameworkInitializationCompleted()
    {
        {
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
            
            var music = services.GetService<IMusic>();
            var plex = services.GetService<Plex>();
            var homeVM = services.GetService<HomeViewModel>();

            Console.WriteLine($"IMusic resolved: {music != null}");
            Console.WriteLine($"Plex resolved: {plex != null}");
            Console.WriteLine($"HomeViewModel resolved: {homeVM != null}");



            var vm = services.GetRequiredService<MainViewModel>();
            if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
            {
                // Avoid duplicate validations from both Avalonia and the CommunityToolkit. 
                // More info: https://docs.avaloniaui.net/docs/guides/development-guides/data-validation#manage-validationplugins
                DisableAvaloniaDataAnnotationValidation();
                desktop.MainWindow = new MainWindow
                {
                    DataContext = vm
                };
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