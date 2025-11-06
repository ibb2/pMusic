using System.Collections.Generic;
using Avalonia.Controls;
using Avalonia.Data.Converters;

namespace ShadUI.Demo.Converters;

public static class ThemeModeConverters
{
    private static readonly Dictionary<ThemeMode, string> Icons = new()
    {
        { ThemeMode.System, "\uE2B2" },
        { ThemeMode.Light, "\uE2B1" },
        { ThemeMode.Dark, "\uE122" }
    };

    public static readonly IValueConverter ToLucideIcon =
        new FuncValueConverter<ThemeMode, string>(mode => Icons.TryGetValue(mode, out var icon) ? icon : Icons[0]);
}

public static class WindowStateConverters
{
    public static readonly IValueConverter IsFullScreen =
        new FuncValueConverter<WindowState, bool>(state => state == WindowState.FullScreen);

    public static readonly IValueConverter IsNotFullScreen =
        new FuncValueConverter<WindowState, bool>(state => state != WindowState.FullScreen);
}