"use client";

import { useState, useRef, useEffect } from 'react';
import { Bell, BellOff, CheckCircle, AlertTriangle, Rocket, PauseCircle, BatteryLow, BatteryCharging, BarChart, Settings, X, ExternalLink, LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications, useNotificationCount, markAsRead, markAllAsRead } from '../hooks/useNotifications';
import { useUserPreferences, updateNotificationPreference } from '../hooks/useUserPreferences';
import { UserNotification } from '@/lib/types/mongodb';
import { useRouter } from 'next/navigation';

const ICON_MAP: Record<string, LucideIcon> = {
  CheckCircle,
  AlertTriangle,
  Rocket,
  PauseCircle,
  BatteryLow,
  BatteryCharging,
  BarChart,
  Settings,
};

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { count, mutate: mutateCount } = useNotificationCount();
  const { notifications, mutate: mutateNotifications } = useNotifications(5, 0);
  const { notificationsEnabled, mutate: mutatePreferences } = useUserPreferences();
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead(notificationId);
      mutateNotifications();
      mutateCount();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      mutateNotifications();
      mutateCount();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationClick = (notification: UserNotification) => {
    handleMarkAsRead(notification.id);
    
    if (notification.metadata?.agentId) {
      setIsOpen(false);
      router.push(`/agents/${notification.metadata.agentId}`);
    }
  };

  const handleBellClick = () => {
    if (!isOpen) {
      mutateNotifications();
      mutateCount();
    }
    setIsOpen(!isOpen);
  };

  const handleToggleNotifications = async () => {
    const newValue = !notificationsEnabled;
    setIsToggling(true);

    try {
      await updateNotificationPreference(newValue);
      await mutatePreferences();
      await mutateCount();
    } catch (error) {
      console.error('Failed to update notification preference:', error);
    } finally {
      setIsToggling(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      default: return 'text-blue-400';
    }
  };

  const unreadNotifications = notifications.filter(n => n.status === 'unread');
  const readNotifications = notifications.filter(n => n.status === 'read');

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleBellClick}
        className="relative p-2.5 md:p-2 hover:bg-white/[0.08] rounded-lg transition-all duration-200 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
        aria-label="Notifications"
      >
        <Bell size={18} className="text-gray-300 md:w-5 md:h-5" />
        {notificationsEnabled && count > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 md:-top-1 md:-right-1 bg-red-500 text-white text-[10px] md:text-xs font-bold rounded-full min-w-[16px] h-[16px] md:min-w-[18px] md:h-[18px] flex items-center justify-center px-0.5 md:px-1"
          >
            {count > 9 ? '9+' : count}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed md:absolute left-4 right-4 md:left-auto md:right-0 top-20 md:top-full mt-0 md:mt-2 w-auto md:w-[60vw] md:max-w-[500px] bg-black/95 backdrop-blur-xl border border-white/[0.08] rounded-xl md:rounded-2xl shadow-2xl overflow-hidden z-50"
          >
            {/* Header */}
            <div className="p-3 md:p-4 border-b border-white/[0.08] flex items-center justify-between">
              <h3 className="text-base md:text-lg font-semibold text-white">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadNotifications.length > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-[11px] md:text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/[0.08] rounded-lg transition-colors min-w-[36px] min-h-[36px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                >
                  <X size={14} className="text-gray-400 md:w-4 md:h-4" />
                </button>
              </div>
            </div>

            {/* Notification Toggle Control */}
            <div className="p-3 md:p-4 border-b border-white/[0.08] bg-white/[0.02]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {notificationsEnabled ? (
                    <Bell size={16} className="text-blue-400 flex-shrink-0 md:w-[18px] md:h-[18px]" />
                  ) : (
                    <BellOff size={16} className="text-gray-500 flex-shrink-0 md:w-[18px] md:h-[18px]" />
                  )}
                  <span className="text-xs md:text-sm text-white">Live pop-ups</span>
                </div>
                
                <div className="relative">
                  <button
                    onClick={handleToggleNotifications}
                    disabled={isToggling}
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 ${
                      notificationsEnabled ? 'bg-blue-500' : 'bg-gray-600'
                    }`}
                    aria-label={`${notificationsEnabled ? 'Disable' : 'Enable'} live pop-ups`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ${
                        notificationsEnabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  
                  {/* Tooltip */}
                  {showTooltip && (
                    <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-900 text-white text-[10px] md:text-xs rounded whitespace-nowrap z-10 border border-white/[0.1]">
                      Enable/Disable Live pop-ups
                      <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Helper text */}
              <p className="text-[10px] md:text-xs text-gray-500 mt-2">
                {notificationsEnabled 
                  ? 'Badge counts and visual alerts enabled'
                  : 'Notifications recorded without alerts'}
              </p>
            </div>

            {/* Notifications List */}
            <div className="max-h-[60vh] md:max-h-[70vh] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 md:p-8 text-center">
                  <Bell size={40} className="mx-auto mb-3 text-gray-600 md:w-12 md:h-12" />
                  <p className="text-gray-400 text-xs md:text-sm">No notifications yet</p>
                </div>
              ) : (
                <>
                  {/* Unread notifications */}
                  {unreadNotifications.length > 0 && (
                    <div>
                      {unreadNotifications.map((notification) => {
                        const IconComponent = ICON_MAP[notification.icon] || Bell;
                        return (
                          <div
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className="p-3 md:p-4 border-b border-white/[0.05] hover:bg-white/[0.03] cursor-pointer transition-colors bg-blue-500/5"
                          >
                            <div className="flex items-start gap-2 md:gap-3">
                              <div className={`p-1.5 md:p-2 rounded-lg bg-white/[0.05] ${getPriorityColor(notification.priority)}`}>
                                <IconComponent size={16} className="md:w-[18px] md:h-[18px]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="text-xs md:text-sm font-semibold text-white truncate">
                                    {notification.title}
                                  </h4>
                                  <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-500 rounded-full flex-shrink-0" />
                                </div>
                                <p className="text-[11px] md:text-xs text-gray-400 line-clamp-2 mb-1">
                                  {notification.body}
                                </p>
                                <p className="text-[10px] md:text-xs text-gray-500">
                                  {formatTimestamp(notification.createdAt)}
                                </p>
                              </div>
                              {notification.metadata?.agentId && (
                                <ExternalLink size={12} className="text-gray-500 flex-shrink-0 md:w-[14px] md:h-[14px]" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Read notifications */}
                  {readNotifications.map((notification) => {
                    const IconComponent = ICON_MAP[notification.icon] || Bell;
                    return (
                      <div
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className="p-3 md:p-4 border-b border-white/[0.05] hover:bg-white/[0.03] cursor-pointer transition-colors opacity-60"
                      >
                        <div className="flex items-start gap-2 md:gap-3">
                          <div className={`p-1.5 md:p-2 rounded-lg bg-white/[0.05] ${getPriorityColor(notification.priority)}`}>
                            <IconComponent size={16} className="md:w-[18px] md:h-[18px]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs md:text-sm font-semibold text-white truncate mb-1">
                              {notification.title}
                            </h4>
                            <p className="text-[11px] md:text-xs text-gray-400 line-clamp-2 mb-1">
                              {notification.body}
                            </p>
                            <p className="text-[10px] md:text-xs text-gray-500">
                              {formatTimestamp(notification.createdAt)}
                            </p>
                          </div>
                          {notification.metadata?.agentId && (
                            <ExternalLink size={12} className="text-gray-500 flex-shrink-0 md:w-[14px] md:h-[14px]" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-white/[0.08] bg-black/40">
                <button
                  onClick={() => {
                    setIsNavigating(true);
                    setIsOpen(false);
                    router.push('/notifications');
                  }}
                  className="block w-full text-center text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View all notifications
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-screen loading overlay */}
      {isNavigating && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-white text-sm md:text-base">Loading notifications...</p>
          </div>
        </div>
      )}
    </div>
  );
}
