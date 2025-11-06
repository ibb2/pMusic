using System;
using System.Globalization;
using Avalonia.Data.Converters;
using Avalonia.Media;

namespace ShadUI.Demo.Converters;

public class StringToColor : IValueConverter
{
    public static readonly StringToColor Instance = new();

    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is not string colorString || string.IsNullOrEmpty(colorString))
        {
            return Colors.Transparent;
        }

        var namedColor = GetNamedColor(colorString);
        if (namedColor is not null) return namedColor;

        if (colorString.StartsWith("#")) colorString = colorString[1..];

        if (colorString.Length == 6)
        {
            colorString = "FF" + colorString;
        }
        else if (colorString.Length != 8)
        {
            return Colors.Transparent;
        }

        var argb = System.Convert.ToUInt32(colorString, 16);
        return Color.FromUInt32(argb);
    }

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is Color color)
        {
            return $"#{color.A:X2}{color.R:X2}{color.G:X2}{color.B:X2}";
        }

        return null;
    }

    private static Color? GetNamedColor(string colorName)
    {
        return colorName.ToLowerInvariant() switch
        {
            "red" => Colors.Red,
            "green" => Colors.Green,
            "blue" => Colors.Blue,
            "yellow" => Colors.Yellow,
            "cyan" => Colors.Cyan,
            "magenta" => Colors.Magenta,
            "black" => Colors.Black,
            "white" => Colors.White,
            "gray" => Colors.Gray,
            "grey" => Colors.Gray,
            "orange" => Colors.Orange,
            "purple" => Colors.Purple,
            "pink" => Colors.Pink,
            "brown" => Colors.Brown,
            "transparent" => Colors.Transparent,
            "aliceblue" => Colors.AliceBlue,
            "antiquewhite" => Colors.AntiqueWhite,
            "aqua" => Colors.Aqua,
            "aquamarine" => Colors.Aquamarine,
            "azure" => Colors.Azure,
            "beige" => Colors.Beige,
            "bisque" => Colors.Bisque,
            "blanchedalmond" => Colors.BlanchedAlmond,
            "blueviolet" => Colors.BlueViolet,
            "burlywood" => Colors.BurlyWood,
            "cadetblue" => Colors.CadetBlue,
            "chartreuse" => Colors.Chartreuse,
            "chocolate" => Colors.Chocolate,
            "coral" => Colors.Coral,
            "cornflowerblue" => Colors.CornflowerBlue,
            "cornsilk" => Colors.Cornsilk,
            "crimson" => Colors.Crimson,
            "darkblue" => Colors.DarkBlue,
            "darkcyan" => Colors.DarkCyan,
            "darkgoldenrod" => Colors.DarkGoldenrod,
            "darkgray" => Colors.DarkGray,
            "darkgreen" => Colors.DarkGreen,
            "darkkhaki" => Colors.DarkKhaki,
            "darkmagenta" => Colors.DarkMagenta,
            "darkolivegreen" => Colors.DarkOliveGreen,
            "darkorange" => Colors.DarkOrange,
            "darkorchid" => Colors.DarkOrchid,
            "darkred" => Colors.DarkRed,
            "darksalmon" => Colors.DarkSalmon,
            "darkseagreen" => Colors.DarkSeaGreen,
            "darkslateblue" => Colors.DarkSlateBlue,
            "darkslategray" => Colors.DarkSlateGray,
            "darkturquoise" => Colors.DarkTurquoise,
            "darkviolet" => Colors.DarkViolet,
            "deeppink" => Colors.DeepPink,
            "deepskyblue" => Colors.DeepSkyBlue,
            "dimgray" => Colors.DimGray,
            "dodgerblue" => Colors.DodgerBlue,
            "firebrick" => Colors.Firebrick,
            "floralwhite" => Colors.FloralWhite,
            "forestgreen" => Colors.ForestGreen,
            "fuchsia" => Colors.Fuchsia,
            "gainsboro" => Colors.Gainsboro,
            "ghostwhite" => Colors.GhostWhite,
            "gold" => Colors.Gold,
            "goldenrod" => Colors.Goldenrod,
            "greenyellow" => Colors.GreenYellow,
            "honeydew" => Colors.Honeydew,
            "hotpink" => Colors.HotPink,
            "indianred" => Colors.IndianRed,
            "indigo" => Colors.Indigo,
            "ivory" => Colors.Ivory,
            "khaki" => Colors.Khaki,
            "lavender" => Colors.Lavender,
            "lavenderblush" => Colors.LavenderBlush,
            "lawngreen" => Colors.LawnGreen,
            "lemonchiffon" => Colors.LemonChiffon,
            "lightblue" => Colors.LightBlue,
            "lightcoral" => Colors.LightCoral,
            "lightcyan" => Colors.LightCyan,
            "lightgoldenrodyellow" => Colors.LightGoldenrodYellow,
            "lightgray" => Colors.LightGray,
            "lightgreen" => Colors.LightGreen,
            "lightpink" => Colors.LightPink,
            "lightsalmon" => Colors.LightSalmon,
            "lightseagreen" => Colors.LightSeaGreen,
            "lightskyblue" => Colors.LightSkyBlue,
            "lightslategray" => Colors.LightSlateGray,
            "lightsteelblue" => Colors.LightSteelBlue,
            "lightyellow" => Colors.LightYellow,
            "lime" => Colors.Lime,
            "limegreen" => Colors.LimeGreen,
            "linen" => Colors.Linen,
            "maroon" => Colors.Maroon,
            "mediumaquamarine" => Colors.MediumAquamarine,
            "mediumblue" => Colors.MediumBlue,
            "mediumorchid" => Colors.MediumOrchid,
            "mediumpurple" => Colors.MediumPurple,
            "mediumseagreen" => Colors.MediumSeaGreen,
            "mediumslateblue" => Colors.MediumSlateBlue,
            "mediumspringgreen" => Colors.MediumSpringGreen,
            "mediumturquoise" => Colors.MediumTurquoise,
            "mediumvioletred" => Colors.MediumVioletRed,
            "midnightblue" => Colors.MidnightBlue,
            "mintcream" => Colors.MintCream,
            "mistyrose" => Colors.MistyRose,
            "moccasin" => Colors.Moccasin,
            "navajowhite" => Colors.NavajoWhite,
            "navy" => Colors.Navy,
            "oldlace" => Colors.OldLace,
            "olive" => Colors.Olive,
            "olivedrab" => Colors.OliveDrab,
            "orangered" => Colors.OrangeRed,
            "orchid" => Colors.Orchid,
            "palegoldenrod" => Colors.PaleGoldenrod,
            "palegreen" => Colors.PaleGreen,
            "paleturquoise" => Colors.PaleTurquoise,
            "palevioletred" => Colors.PaleVioletRed,
            "papayawhip" => Colors.PapayaWhip,
            "peachpuff" => Colors.PeachPuff,
            "peru" => Colors.Peru,
            "plum" => Colors.Plum,
            "powderblue" => Colors.PowderBlue,
            "rosybrown" => Colors.RosyBrown,
            "royalblue" => Colors.RoyalBlue,
            "saddlebrown" => Colors.SaddleBrown,
            "salmon" => Colors.Salmon,
            "sandybrown" => Colors.SandyBrown,
            "seagreen" => Colors.SeaGreen,
            "seashell" => Colors.SeaShell,
            "sienna" => Colors.Sienna,
            "silver" => Colors.Silver,
            "skyblue" => Colors.SkyBlue,
            "slateblue" => Colors.SlateBlue,
            "slategray" => Colors.SlateGray,
            "snow" => Colors.Snow,
            "springgreen" => Colors.SpringGreen,
            "steelblue" => Colors.SteelBlue,
            "tan" => Colors.Tan,
            "teal" => Colors.Teal,
            "thistle" => Colors.Thistle,
            "tomato" => Colors.Tomato,
            "turquoise" => Colors.Turquoise,
            "violet" => Colors.Violet,
            "wheat" => Colors.Wheat,
            "whitesmoke" => Colors.WhiteSmoke,
            "yellowgreen" => Colors.YellowGreen,
            _ => null
        };
    }
}