using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.DependencyInjection;
using CommunityToolkit.Mvvm.Input;
using pMusic.Interface;
using pMusic.Models;

namespace pMusic.ViewModels;

public abstract partial class ViewModelBase : ObservableObject
{
    // Access to navigation
    protected Navigation Navigation => Navigation.Instance;

    // [RelayCommand]
    // public void GoToHome() => Navigation.GoToHome();

    [RelayCommand]
    public void GoToAlbum(Album album)
    {
        Navigation.GoToView<AlbumViewModel>(vm =>
        {
            vm.Album = album;
            _ = vm.GetTracks();
        });
    }

    [RelayCommand]
    public void GoToArtist()
    {
        Navigation.GoToView<ArtistViewModel>(vm => vm.Title = "Updated Artist Title");
    }

    [RelayCommand]
    public void GoToTrack()
    {
        Navigation.GoToView<TrackViewModel>(vm => vm.Title = "Updated Track Title");
    }

    public void GoBack()
    {
        Navigation.GoBack();
    }

    public void GoForward()
    {
        Navigation.GoForward();
    }
}