using System.Net.Http;
using Microsoft.Extensions.DependencyInjection;
using pMusic.Services;
using pMusic.ViewModels;

namespace pMusic.DI;

public static class ServiceCollectionExtensions
{
    public static void AddCommonServices(this IServiceCollection collection)
    {
        collection.AddHttpClient<Plex>();
        collection.AddTransient<MainViewModel>();
    }
}