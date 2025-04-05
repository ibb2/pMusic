using System.Net.Http;
using Microsoft.Extensions.DependencyInjection;
using pMusic.Interface;
using pMusic.Services;
using pMusic.ViewModels;
using pMusic.Views;

namespace pMusic.DI;

public static class ServiceCollectionExtensions
{
    public static void AddCommonServices(this IServiceCollection collection)
    {
        collection.AddHttpClient<Plex>();
        collection.AddTransient<MainViewModel>();
        collection.AddTransient<MainWindow>();
        collection.AddSingleton<Navigation>();
    }
}