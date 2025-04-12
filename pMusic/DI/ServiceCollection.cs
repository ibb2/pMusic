using System.Net.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using pMusic.Database;
using pMusic.Interface;
using pMusic.Models;
using pMusic.Services;
using pMusic.ViewModels;
using pMusic.Views;

namespace pMusic.DI;

public static class ServiceCollectionExtensions
{
    public static void AddCommonServices(this IServiceCollection collection)
    {
        collection.AddHttpClient<Plex>();
        collection.AddDbContext<MusicDbContext>(
            optionBuilder => optionBuilder.UseSqlite("Data Source=music.db"));
        collection.AddSingleton<Navigation>();
        collection.AddSingleton<IAudioPlayerService, AudioPlayer>();
        collection.AddSingleton<MusicPlayer>();
        collection.AddTransient<IMusic, Music>();
        collection.AddTransient<MainViewModel>();
        collection.AddTransient<HomeViewModel>();
        collection.AddTransient<AlbumViewModel>();
        collection.AddTransient<ArtistViewModel>();
        collection.AddTransient<MainWindow>();
        collection.AddTransient<HomeView>();
    }
}