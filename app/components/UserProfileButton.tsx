"use client";

import { useState, useRef, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import Image from "next/image";

export default function UserProfileButton() {
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Extract initials from user name
  const getInitials = (): string => {
    if (!user) return "U";

    // Try firstName + lastName first
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }

    // Try firstName only
    if (user.firstName) {
      return user.firstName.slice(0, 2).toUpperCase();
    }

    // Try fullName or primaryEmailAddress
    const fullName = user.fullName || user.primaryEmailAddress?.emailAddress || "";
    const nameParts = fullName.split(" ").filter(part => part.length > 0);
    
    if (nameParts.length >= 2) {
      return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
    }
    
    if (nameParts.length === 1 && nameParts[0].length >= 2) {
      return nameParts[0].slice(0, 2).toUpperCase();
    }

    // Fallback to email
    const email = user.primaryEmailAddress?.emailAddress || "";
    return email.slice(0, 2).toUpperCase();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleManageAccount = () => {
    setIsOpen(false);
    openUserProfile();
  };

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut({ redirectUrl: '/' });
    window.location.href = '/';
  };

  if (!user) return null;

  const initials = getInitials();
  const hasProfileImage = user.imageUrl && user.imageUrl !== "";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 md:w-11 md:h-11 rounded-full border-2 border-white/[0.08] hover:border-white/[0.12] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black min-w-[44px] min-h-[44px]"
        aria-label="User menu"
      >
        {hasProfileImage ? (
          <Image
            src={user.imageUrl}
            alt={user.fullName || "User"}
            width={44}
            height={44}
            className="rounded-full object-cover"
          />
        ) : (
          <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xs md:text-sm">
            {initials}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 md:w-64 bg-[#0a0a0a] border border-white/[0.08] rounded-xl shadow-2xl backdrop-blur-xl overflow-hidden z-50">
          {/* User Info */}
          <div className="px-3 md:px-4 py-2.5 md:py-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2 md:gap-3">
              {hasProfileImage ? (
                <Image
                  src={user.imageUrl}
                  alt={user.fullName || "User"}
                  width={36}
                  height={36}
                  className="rounded-full object-cover md:w-10 md:h-10"
                />
              ) : (
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xs md:text-sm flex-shrink-0">
                  {initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-xs md:text-sm truncate">
                  {user.fullName || user.firstName || "User"}
                </div>
                <div className="text-gray-400 text-xs truncate">
                  {user.primaryEmailAddress?.emailAddress}
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={handleManageAccount}
              className="w-full px-3 md:px-4 py-2.5 md:py-2 text-left text-white hover:bg-white/[0.05] transition-all duration-200 flex items-center gap-2 md:gap-3 text-sm md:text-base min-h-[44px]"
            >
              <svg
                className="w-4 h-4 text-gray-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="font-medium">Manage account</span>
            </button>

            <button
              onClick={handleSignOut}
              className="w-full px-3 md:px-4 py-2.5 md:py-2 text-left text-white hover:bg-white/[0.05] transition-all duration-200 flex items-center gap-2 md:gap-3 text-sm md:text-base min-h-[44px]"
            >
              <svg
                className="w-4 h-4 text-gray-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="font-medium">Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
