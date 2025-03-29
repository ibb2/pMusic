using Microsoft.UI.Xaml.Data;

namespace pMusic.Converters;

public class BoolToPlayPauseSymbolConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        // Explicit null/type check
        if (value is bool isPlaying)
        {
            return isPlaying ? Symbol.Pause : Symbol.Play;
        }
        
        // Default to Play symbol instead of Emoji
        return Symbol.Play;
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language) 
        => throw new NotImplementedException();
}
