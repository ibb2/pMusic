using System.Collections;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.ComponentModel;

namespace pMusic.Classes;

public class ObservableStack<T> : IEnumerable<T>, INotifyCollectionChanged, INotifyPropertyChanged

{
    private readonly Stack<T> _stack = new();

    public int Count => _stack.Count;

    public IEnumerator<T> GetEnumerator() => _stack.GetEnumerator();
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

    public event NotifyCollectionChangedEventHandler? CollectionChanged;
    public event PropertyChangedEventHandler? PropertyChanged;

    public void Push(T item)
    {
        _stack.Push(item);
        CollectionChanged?.Invoke(this, new NotifyCollectionChangedEventArgs(NotifyCollectionChangedAction.Add, item));
        OnPropertyChanged(nameof(Count));
    }

    public T Pop()
    {
        var item = _stack.Pop();
        CollectionChanged?.Invoke(this,
            new NotifyCollectionChangedEventArgs(NotifyCollectionChangedAction.Remove, item));
        OnPropertyChanged(nameof(Count));
        return item;
    }

    public void Clear()
    {
        _stack.Clear();
        CollectionChanged?.Invoke(this, new NotifyCollectionChangedEventArgs(NotifyCollectionChangedAction.Reset));
        OnPropertyChanged(nameof(Count));
    }

    protected void OnPropertyChanged(string propertyName) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}