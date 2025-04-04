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
    public void GoToAlbum() => Navigation.GoToAlbum();
    
    [RelayCommand]
    public void GoToArtist() => Navigation.GoToArtist();
    
    [RelayCommand]
    public void GoToTrack() => Navigation.GoToTrack();
    
}