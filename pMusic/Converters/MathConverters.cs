using Avalonia.Data.Converters;

namespace pMusic.Converters;

public class MathConverters
{
    public static readonly IValueConverter Modulo = new FuncValueConverter<int, int>(index => index % 4
    );

    public static readonly IValueConverter Divide = new FuncValueConverter<int, int>(index => index / 4
    );
}