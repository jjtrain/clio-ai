"use client";

import { Bell, Search, Plus, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="h-14 sm:h-16 border-b border-gray-200 bg-white px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Mobile Menu Button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Search - hidden on mobile, visible on sm+ */}
      <div className="hidden sm:block flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="search"
            placeholder="Search clients, matters, documents..."
            className="pl-10 bg-gray-50 border-gray-200 focus:bg-white w-full"
          />
        </div>
      </div>

      {/* Mobile Search Icon */}
      <Button variant="ghost" size="icon" className="sm:hidden text-gray-500 hover:text-gray-700">
        <Search className="h-5 w-5" />
      </Button>

      {/* Spacer on mobile */}
      <div className="flex-1 sm:hidden" />

      {/* Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Add */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white shadow-sm h-9 px-3 sm:px-4">
              <Plus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Quick Add</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Create New</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/clients/new">New Client</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/matters/new">New Matter</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/time/new">New Time Entry</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/documents/new">Upload Document</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/calendar/new">New Event</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative text-gray-500 hover:text-gray-700 h-9 w-9">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
        </Button>
      </div>
    </header>
  );
}
