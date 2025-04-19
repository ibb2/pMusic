using System;
using System.IO;
using Microsoft.EntityFrameworkCore;
using pMusic.Models;

namespace pMusic.Database;

public class MusicDbContext : DbContext
{
    public DbSet<Album> Albums { get; set; }
    public DbSet<Artist> Artists { get; set; }
    public DbSet<Playlist> Playlists { get; set; }
    public DbSet<Track> Tracks { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // One-to-many relationship between Album and Track
        modelBuilder.Entity<Album>().HasMany(t => t.Tracks).WithOne(t => t.Album).HasForeignKey(t => t.AlbumId)
            .HasPrincipalKey(t => t.Id);

        // One-to-many relationship between Artist and Album
        modelBuilder.Entity<Artist>().HasMany(t => t.Albums).WithOne(t => t.Artist).HasForeignKey(t => t.ArtistId)
            .HasPrincipalKey(t => t.Id);
    }

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