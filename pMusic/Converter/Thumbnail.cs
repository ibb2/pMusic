using System;
using System.Globalization;
using System.Threading.Tasks;
using Avalonia.Data.Converters;
using Avalonia.Media.Imaging;
using KeySharp;
using pMusic.Services;

namespace pMusic.Converter;

public class Thumbnail : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is string thumb)
        {
            var thumbnail = thumb + "?X-Plex-Token=" +
                            Keyring.GetPassword("com.ib.pmusic-avalonia", "pMusic-Avalonia", "authToken");

            Console.WriteLine(thumbnail);

            return thumbnail;
        }

        return "";
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => throw new NotImplementedException();
}