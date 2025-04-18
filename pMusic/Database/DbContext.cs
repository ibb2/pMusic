using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using pMusic.Models;

namespace pMusic.Database;

public class MusicDbContext : DbContext
{
    public DbSet<Album> Albums { get; set; }
    public DbSet<Artist> Artists { get; set; }
    public DbSet<Playlist> Playlists { get; set; }
    public DbSet<Track> Tracks { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        base.OnConfiguring(optionsBuilder);
        // optionsBuilder.UseSqlite("Data Source=music.db");
        // Get the directory where the application is running
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        string dbPath = Path.Combine(baseDir, "music.db");

        // Log or debug the path to verify
        Console.WriteLine($"Database path: {dbPath}");

        optionsBuilder.UseSqlite($"Data Source={dbPath}");
    }
}