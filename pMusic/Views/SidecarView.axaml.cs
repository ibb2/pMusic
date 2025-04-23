using Avalonia.Controls;
using CommunityToolkit.Mvvm.DependencyInjection;
using pMusic.ViewModels;

namespace pMusic.Views;

public partial class SidecarView : UserControl
{
    public SidecarView()
    {
        InitializeComponent();
        this.DataContext = Ioc.Default.GetRequiredService<SidecarViewModel>();
    }
}