import { useUltraBlur } from "@/components/layout/UltraBlurProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/theme-provider";
import {
  useCanGoBack,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Logout01Icon,
  MonitorDotIcon,
  Moon02Icon,
  PaintBoardIcon,
  Search01Icon,
  Settings01Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { FormEvent, useEffect, useState } from "react";

export function TopBar() {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const routerState = useRouterState();
  const { theme, setTheme } = useTheme();
  const { ultraBlur, enabled } = useUltraBlur();
  const hasUltraBlur = !!ultraBlur && enabled;
  const currentQuery = new URLSearchParams(
    routerState.location.searchStr,
  ).get("q") ?? "";
  const [searchQuery, setSearchQuery] = useState(currentQuery);

  useEffect(() => setSearchQuery(currentQuery), [currentQuery]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query) router.navigate({ to: "/app/search", search: { q: query } });
  };

  const { data: userProfile } = useQuery({
    queryKey: ["userProfile"],
    queryFn: () => window.api.auth.getUserProfile(),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    retry: 1,
  });

  // Check if we can go forward by comparing current index with history length
  const canGoForward =
    routerState.resolvedLocation?.state?.__TSR_index !== undefined
      ? (routerState.resolvedLocation?.state.__TSR_index as number) <
        router.history.length - 1
      : false;

  const logout = async () => {
    const logoutSuccessful = await window.api.auth.logout();
    if (logoutSuccessful) {
      router.navigate({
        to: "/auth",
        replace: true,
      });
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between sticky top-0 z-10 w-full transition-colors duration-300",
        hasUltraBlur ? "bg-transparent" : "bg-background/95 backdrop-blur",
      )}
    >
      <div className="flex items-center">
        <Button
          disabled={!canGoBack}
          variant="ghost"
          size="icon"
          onClick={() => router.history.back()}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} />
        </Button>
        <Button
          disabled={!canGoForward}
          variant="ghost"
          size="icon"
          onClick={() => router.history.forward()}
        >
          <HugeiconsIcon icon={ArrowRight01Icon} />
        </Button>
      </div>

      <form className="flex flex-1 max-w-md mx-4" onSubmit={submitSearch}>
        <div className="relative w-full">
          <HugeiconsIcon
            icon={Search01Icon}
            className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"
          />
          <Input
            placeholder="What do you want to play?"
            className="pl-8 rounded-full bg-secondary border-0 w-full"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label="Search music"
          />
        </div>
      </form>

      <div className="flex items-center">
        {/* <Link to={'/app/settings'}> */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex size-8 items-center justify-center rounded-full outline-hidden ring-offset-background transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
            }
          >
            <Avatar className="size-8">
              <AvatarImage
                src={userProfile?.thumb || undefined}
                alt={userProfile?.title || "User"}
              />
              <AvatarFallback>
                {profileInitials(userProfile?.title || userProfile?.username)}
              </AvatarFallback>
            </Avatar>
            <span className="sr-only">Open user menu</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 p-1" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 py-1.5 font-normal">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar className="size-7">
                    <AvatarImage
                      src={userProfile?.thumb || undefined}
                      alt={userProfile?.title || "User"}
                    />
                    <AvatarFallback>
                      {profileInitials(
                        userProfile?.title || userProfile?.username,
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {userProfile?.title || userProfile?.username || "Rayna"}
                    </div>
                    {userProfile?.email && (
                      <div className="truncate text-xs text-muted-foreground">
                        {userProfile.email}
                      </div>
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => router.navigate({ to: "/app/settings" })}
              >
                <HugeiconsIcon icon={Settings01Icon} />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                <HugeiconsIcon icon={PaintBoardIcon} />
                <span className="flex-1">Theme</span>

                <div className="relative grid grid-cols-3 rounded-lg bg-muted p-0.5">
                  {(["light", "dark", "system"] as const).map((value) => {
                    const isSelected = theme === value;

                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={(event) => {
                          event.stopPropagation();
                          setTheme(value);
                        }}
                        className={cn(
                          "relative z-10 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200",
                          "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isSelected && "text-foreground",
                        )}
                      >
                        {isSelected && (
                          <span className="absolute inset-0 -z-10 rounded-md bg-background shadow-sm transition-all duration-200 ease-out" />
                        )}

                        <HugeiconsIcon
                          icon={
                            value === "light"
                              ? Sun03Icon
                              : value === "dark"
                                ? Moon02Icon
                                : MonitorDotIcon
                          }
                        />
                        <span className="sr-only">{value}</span>
                      </button>
                    );
                  })}
                </div>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()} variant="destructive">
              <HugeiconsIcon icon={Logout01Icon} />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* <Settings className="w-5" /> Change back to UserProfile image */}
        {/* </Link> */}
      </div>
    </div>
  );
}

function profileInitials(name?: string | null): string {
  if (!name) return "R";

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
