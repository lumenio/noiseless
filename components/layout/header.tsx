"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Rss, Menu, LogOut, User, BookOpen, Globe, PlusCircle, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
}

const NAV_ITEMS = [
  { href: "/", label: "Explore", icon: Compass, authRequired: false, hideWhenAuthed: true },
  { href: "/feed", label: "Feed", icon: BookOpen, authRequired: true, hideWhenAuthed: false },
  { href: "/sources", label: "Sources", icon: Globe, authRequired: false, hideWhenAuthed: false },
  { href: "/subscriptions", label: "Subscriptions", icon: Rss, authRequired: true, hideWhenAuthed: false },
];

export function Header({ user }: HeaderProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-6xl items-center px-4">
        <Link href={user ? "/feed" : "/"} className="flex items-center gap-2 font-heading font-bold">
          <Image src="/logo.svg" alt="" width={20} height={20} className="dark:invert" />
          Noiseless
        </Link>

        <nav className="ml-8 hidden items-center gap-1 md:flex">
          {NAV_ITEMS.filter((item) => (!item.authRequired || user) && (!item.hideWhenAuthed || !user)).map(
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
          {user && (
            <Link
              href="/sources/suggest"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent",
                pathname === "/sources/suggest"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
            >
              <PlusCircle className="h-4 w-4" />
              Suggest
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {user.name || user.email}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
                  {user.email}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
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
              {NAV_ITEMS.filter((item) => (!item.authRequired || user) && (!item.hideWhenAuthed || !user)).map(
                (item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                )
              )}
              {user && (
                <DropdownMenuItem asChild>
                  <Link
                    href="/sources/suggest"
                    className="flex items-center gap-2"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Suggest Source
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
