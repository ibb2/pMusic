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
    public DbSet<Media> Medias { get; set; }
    public DbSet<Part> Parts { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // One-to-many relationship between Album and Track
        modelBuilder.Entity<Album>().HasMany(t => t.Tracks).WithOne(t => t.Album).HasForeignKey(t => t.AlbumId)
            .HasPrincipalKey(t => t.Id);

        // One-to-many relationship between Artist and Album
        modelBuilder.Entity<Artist>().HasMany(t => t.Albums).WithOne(t => t.Artist).HasForeignKey(t => t.ArtistId)
            .HasPrincipalKey(t => t.Id);

        // One-to-one relationship between Track and Media
        modelBuilder.Entity<Track>().HasOne(t => t.Media).WithOne(t => t.Track).HasForeignKey<Media>(t => t.TrackId)
            .IsRequired();

        // One-to-one relationship between Media and Part
        modelBuilder.Entity<Media>().HasOne(t => t.Part).WithOne(t => t.Media).HasForeignKey<Part>(t => t.MediaId)
            .IsRequired();
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