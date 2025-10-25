"use client";

import { X, Menu } from "lucide-react";
import Image from "next/image";
import { SignedIn, SignedOut, SignInButton, SignUpButton } from '@clerk/nextjs';
import UserProfileButton from './UserProfileButton';
import NotificationBell from './NotificationBell';

interface TopBarProps {
  onClose?: () => void;
  closeButtonText?: string;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

export default function TopBar({ onClose, closeButtonText = "Close", onMenuClick, showMenuButton = false }: TopBarProps = {}) {
  return (
    <div className="h-16 md:h-20 bg-black/60 backdrop-blur-xl border-b border-white/[0.08] flex items-center justify-between px-4 md:px-8 py-3 md:py-4 relative z-10">
      <div className="flex items-center gap-2 md:gap-4">
        {/* Mobile Hamburger Menu */}
        {showMenuButton && (
          <button
            onClick={onMenuClick}
            className="lg:hidden flex items-center justify-center w-11 h-11 hover:bg-white/[0.05] rounded-lg transition-all duration-200"
            aria-label="Toggle menu"
          >
            <Menu size={22} className="text-white" />
          </button>
        )}
        
        <SignedOut>
          <Image
            src="https://exthalpy-public-bucket.blr1.cdn.digitaloceanspaces.com/Screenshot%202025-10-22%20at%203.33.21%E2%80%AFPM.png"
            alt="Salesman.sh Logo"
            className="h-6 md:h-8 w-auto"
            width={120}
            height={32}
            priority
          />
        </SignedOut>
      </div>

      <div className="flex items-center gap-1.5 md:gap-2">
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center justify-center px-2 md:px-3 py-2 bg-black/[0.4] backdrop-blur-xl gap-1.5 md:gap-2 text-xs md:text-sm font-medium border border-white/[0.08] rounded-lg transition-all duration-200 hover:bg-white/[0.05] min-h-[44px]"
          >
            <X size={16} className="text-white md:w-[18px] md:h-[18px]" />
            <span className="text-white hidden sm:inline">{closeButtonText}</span>
            <kbd className="px-1.5 text-xs bg-white/[0.05] ml-1 border border-white/[0.08] rounded hidden md:inline-block">
              ESC
            </kbd>
          </button>
        )}
        
        {!onClose && <div className="w-px h-6 md:h-8 bg-white/[0.08]"></div>}
        
        <SignedOut>
          <SignInButton mode="modal">
            <button className="flex items-center justify-center px-3 md:px-4 h-11 md:h-10 bg-white/[0.02] border border-white/[0.08] rounded-lg hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200 text-xs md:text-sm font-medium text-white">
              Sign In
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="flex items-center justify-center px-3 md:px-4 h-11 md:h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 text-xs md:text-sm font-semibold text-white">
              Sign Up
            </button>
          </SignUpButton>
        </SignedOut>
        
        <SignedIn>
          <NotificationBell />
          <UserProfileButton />
        </SignedIn>
      </div>
    </div>
  );
}
