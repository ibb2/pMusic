using System;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using pMusic.Interface;

namespace pMusic.ViewModels;

public abstract partial class ViewModelBase : ObservableObject
{
    
    // Access to navigation
    protected Navigation Navigation => Navigation.Instance;    
    
    // [RelayCommand]
    // public void GoToHome() => Navigation.GoToHome();
    
    [RelayCommand]
    public void GoToAlbum() => Navigation.GoToView<AlbumViewModel>(vm => vm.Title = "Hello");
    
    [RelayCommand]
    public void GoToArtist() => Navigation.GoToView<ArtistViewModel>(vm => vm.Title = "Updated Artist Title");
    [RelayCommand]
    public void GoToTrack() => Navigation.GoToView<TrackViewModel>(vm => vm.Title = "Updated Track Title");
    
}