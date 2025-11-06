using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using Avalonia.Data.Converters;

namespace pMusic.Converters;

public class ItemIndexConverter : IMultiValueConverter
{
    public static readonly ItemIndexConverter Instance = new();

    public object? Convert(IList<object?> values, Type targetType, object? parameter, CultureInfo culture)
    {
        if (values.Count >= 2 && values[0] != null && values[1] is IEnumerable collection)
        {
            var item = values[0];
            var index = 0;

            foreach (var collectionItem in collection)
            {
                if (collectionItem == item || Equals(collectionItem, item))
                {
                    if (parameter?.ToString() == "Column")
                        return index % 4;
                    else if (parameter?.ToString() == "Row")
                        return index / 4;
                }

                index++;
            }
        }

        return 0;
    }
}