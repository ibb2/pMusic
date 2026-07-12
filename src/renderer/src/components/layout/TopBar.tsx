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
import { DownloadActivityMenu } from "@/components/downloads/DownloadActivityMenu";
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
import type { SearchResult } from "../../../../shared/rpc";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export function TopBar() {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const routerState = useRouterState();
  const { theme, setTheme } = useTheme();
  const { ultraBlur, enabled } = useUltraBlur();
  const hasUltraBlur = !!ultraBlur && enabled;
  const currentQuery =
    new URLSearchParams(routerState.location.searchStr).get("q") ?? "";
  const [searchQuery, setSearchQuery] = useState(currentQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(currentQuery);
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setSearchQuery(currentQuery), [currentQuery]);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedQuery(searchQuery.trim()),
      250,
    );
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const autocomplete = useQuery({
    queryKey: ["search-autocomplete", debouncedQuery],
    queryFn: () => window.api.media.search(debouncedQuery, 3),
    enabled: debouncedQuery.length >= 2 && searchFocused,
    staleTime: 30_000,
  });
  const suggestions = useMemo(
    () =>
      autocomplete.data
        ? [
            ...autocomplete.data.artists,
            ...autocomplete.data.albums,
            ...autocomplete.data.tracks,
            ...autocomplete.data.playlists,
          ].slice(0, 8)
        : [],
    [autocomplete.data],
  );
  const showSuggestions = searchFocused && searchQuery.trim().length >= 2;

  useEffect(() => setActiveSuggestion(-1), [debouncedQuery]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
      selectSuggestion(suggestions[activeSuggestion]);
    } else if (query) {
      setSearchFocused(false);
      router.navigate({ to: "/app/search", search: { q: query } });
    }
  };

  const selectSuggestion = (suggestion: SearchResult) => {
    setSearchQuery(suggestion.title);
    setSearchFocused(false);
    if (suggestion.type === "track") {
      void window.api.player.playTrack(suggestion.ratingKey);
      return;
    }
    const to =
      suggestion.type === "artist"
        ? "/app/artist/$ratingKey"
        : suggestion.type === "album"
          ? "/app/album/$ratingKey"
          : "/app/playlist/$ratingKey";
    router.navigate({ to, params: { ratingKey: suggestion.ratingKey } });
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1,
      );
    } else if (event.key === "Escape") {
      setSearchFocused(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setDebouncedQuery("");
    setActiveSuggestion(-1);
    setSearchFocused(true);
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
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
            ref={searchInputRef}
            placeholder="What do you want to play?"
            className="w-full rounded-full border-0 bg-secondary pl-8 pr-9"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)}
            onKeyDown={handleSearchKeyDown}
            aria-label="Search music"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            aria-controls="search-suggestions"
          />
          {searchQuery.length > 0 && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="m7 7 10 10M17 7 7 17" />
              </svg>
            </button>
          )}
          {showSuggestions && (
            <div
              id="search-suggestions"
              role="listbox"
              className="absolute top-full z-50 mt-2 w-full overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
            >
              {autocomplete.isFetching ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Searching…
                </div>
              ) : suggestions.length > 0 ? (
                suggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.type}-${suggestion.ratingKey}`}
                    type="button"
                    role="option"
                    aria-selected={activeSuggestion === index}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectSuggestion(suggestion)}
                    onMouseEnter={() => setActiveSuggestion(index)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left",
                      activeSuggestion === index && "bg-accent",
                    )}
                  >
                    {suggestion.thumb ? (
                      <img
                        src={suggestion.thumb}
                        alt=""
                        className="size-10 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                        <HugeiconsIcon icon={Search01Icon} className="size-4" />
                      </div>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {suggestion.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {suggestion.subtitle} · {suggestion.type}
                      </span>
                    </span>
                  </button>
                ))
              ) : debouncedQuery === searchQuery.trim() ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No suggestions found
                </div>
              ) : null}
            </div>
          )}
        </div>
      </form>

      <div className="flex items-center">
        <DownloadActivityMenu />
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
