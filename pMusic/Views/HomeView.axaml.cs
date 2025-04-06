using System;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Markup.Xaml;
using CommunityToolkit.Mvvm.DependencyInjection;
using Microsoft.Extensions.DependencyInjection;
using pMusic.ViewModels;

namespace pMusic.Views;

public partial class HomeView : UserControl
{
    public HomeView()
    {
        InitializeComponent();
        this.DataContext = Ioc.Default.GetRequiredService<HomeViewModel>();
    }
    
    // // Parameterless constructor needed for XAML instantiation.
    // public HomeView()
    // {
    // }

}