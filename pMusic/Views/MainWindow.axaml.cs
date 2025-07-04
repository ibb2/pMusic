using Avalonia.Controls;
using SukiUI.Controls;

namespace pMusic.Views;

public partial class MainWindow : SukiWindow
{
    public MainWindow()
    {
        InitializeComponent();
    }

    protected override void OnClosing(WindowClosingEventArgs e)
    {
        var window = this;

        window.Closing += (s, e) =>
        {
            ((Window)s)?.Hide();
            e.Cancel = true;
        };
    }
}