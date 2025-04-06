using System;
using pMusic.ViewModels;

namespace pMusic.Services;

public class Demo
{
    public Demo(HomeViewModel homeViewModel)
    {
        Console.WriteLine($"{nameof(HomeViewModel)}: {homeViewModel}");
    }

}