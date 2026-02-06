"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, LogOut, User, BookOpen, Globe, Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/settings/theme-toggle";
import { SettingsPopover } from "@/components/settings/settings-popover";

const NAV_ITEMS = [
  { href: "/", label: "Explore", icon: Compass, authRequired: false, hideWhenAuthed: true },
  { href: "/feed", label: "Feed", icon: BookOpen, authRequired: true, hideWhenAuthed: false },
  { href: "/sources", label: "Sources", icon: Globe, authRequired: false, hideWhenAuthed: false },
];

export function Header() {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  const isLoggedIn = isLoaded && !!user;

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-6xl items-center px-4">
        <Link href={isLoggedIn ? "/feed" : "/"} className="flex items-center gap-2 font-heading">
          <Image src="/logo.svg" alt="" width={20} height={20} className="dark:invert" />
          Noiseless
        </Link>

        <nav className="ml-8 hidden items-center gap-1 md:flex">
          {NAV_ITEMS.filter((item) => (!item.authRequired || isLoggedIn) && (!item.hideWhenAuthed || !isLoggedIn)).map(
            (item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent",
                  pathname === item.href
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <SettingsPopover />
          {isLoggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {user.fullName || user.primaryEmailAddress?.emailAddress}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
                  {user.primaryEmailAddress?.emailAddress}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut({ redirectUrl: "/" })}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          )}

          {/* Mobile menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild className="md:hidden">
              <Button variant="ghost" size="sm">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {NAV_ITEMS.filter((item) => (!item.authRequired || isLoggedIn) && (!item.hideWhenAuthed || !isLoggedIn)).map(
                (item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                )
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
