"use client";

import { useState, useEffect } from 'react';
import { Bell, CheckCircle, AlertTriangle, Rocket, PauseCircle, BatteryLow, BatteryCharging, BarChart, Settings, CheckCheck, ExternalLink, LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNotifications, markAsRead, markAllAsRead } from '../hooks/useNotifications';
import { NotificationCategory, UserNotification } from '@/lib/types/mongodb';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';

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

const CATEGORY_FILTERS: { value: NotificationCategory | 'all'; label: string; icon: LucideIcon }[] = [
  { value: 'all', label: 'All', icon: Bell },
  { value: 'agent', label: 'Agents', icon: Rocket },
  { value: 'credits', label: 'Credits', icon: BatteryLow },
  // { value: 'results', label: 'Results', icon: BarChart },
  // { value: 'system', label: 'System', icon: Settings },
];

export default function NotificationsPage() {
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory | 'all'>('all');
  const [page, setPage] = useState(0);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const pageSize = 20;
  
  const { notifications, total, hasMore, mutate, isLoading } = useNotifications(
    pageSize,
    page * pageSize
  );
  const router = useRouter();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    mutate();
  }, [mutate]);

  const handleNavigate = (view: string) => {
    if (view === 'home') {
      router.push('/');
    } else if (view === 'dashboard') {
      router.push('/?view=agents');
    } else if (view === 'settings') {
      router.push('/?view=settings');
    } else if (view === 'schedule') {
      window.open('https://cal.com/exthalpy/salesman-sh-intro', '_blank');
    }
  };

  const filteredNotifications = selectedCategory === 'all' 
    ? notifications 
    : notifications.filter(n => n.category === selectedCategory);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead(notificationId);
      mutate();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      mutate();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationClick = (notification: UserNotification) => {
    if (notification.status === 'unread') {
      handleMarkAsRead(notification.id);
    }
    
    if (notification.metadata?.agentId) {
      router.push(`/agents/${notification.metadata.agentId}`);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'warning': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      default: return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    }
  };

  const unreadCount = filteredNotifications.filter(n => n.status === 'unread').length;
  
  const showLoading = isLoading || (notifications.length === 0 && !isLoading && total === 0 && !filteredNotifications.length);

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      {isSignedIn && (
        <Sidebar 
          activeView="notifications" 
          onNavigate={(view) => {
            handleNavigate(view);
            setIsMobileSidebarOpen(false);
          }}
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={() => setIsMobileSidebarOpen(false)}
        />
      )}
      
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar 
          showMenuButton={isSignedIn}
          onMenuClick={() => setIsMobileSidebarOpen(true)}
        />
        
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/[0.08]">
                <Bell size={20} className="text-blue-400 md:w-6 md:h-6" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">Notifications</h1>
                <p className="text-xs md:text-sm text-gray-400 mt-0.5 md:mt-1">
                  {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
                </p>
              </div>
            </div>
            
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-all duration-200 text-blue-400 text-xs md:text-sm font-medium min-h-[44px] whitespace-nowrap"
              >
                <CheckCheck size={14} className="md:w-4 md:h-4" />
                <span>Mark all as read</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Filters */}
        <div className="mb-6 flex items-center gap-2 overflow-x-auto hide-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0">
          {CATEGORY_FILTERS.map((filter) => {
            const FilterIcon = filter.icon;
            const isActive = selectedCategory === filter.value;
            return (
              <button
                key={filter.value}
                onClick={() => setSelectedCategory(filter.value)}
                className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 rounded-lg border transition-all duration-200 whitespace-nowrap min-h-[44px] ${
                  isActive
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                    : 'bg-white/[0.02] border-white/[0.08] text-gray-400 hover:bg-white/[0.05] hover:border-white/[0.12]'
                }`}
              >
                <FilterIcon size={14} className="md:w-4 md:h-4" />
                <span className="text-xs md:text-sm font-medium">{filter.label}</span>
              </button>
            );
          })}
        </div>

        {/* Notifications List */}
        {showLoading ? (
          <div className="text-center py-10 md:py-12">
            <div className="animate-spin rounded-full h-10 w-10 md:h-12 md:w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-400 mt-4 text-sm md:text-base">Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-12 md:py-16">
            <Bell size={48} className="mx-auto mb-4 text-gray-600 md:w-16 md:h-16" />
            <h3 className="text-lg md:text-xl font-semibold text-white mb-2">No notifications</h3>
            <p className="text-sm md:text-base text-gray-400">
              {selectedCategory === 'all' 
                ? "You're all caught up! Check back later for updates."
                : `No ${selectedCategory} notifications yet.`}
            </p>
          </div>
        ) : (
          <div className="space-y-2 md:space-y-3">
            {filteredNotifications.map((notification, index) => {
              const IconComponent = ICON_MAP[notification.icon] || Bell;
              const isUnread = notification.status === 'unread';
              
              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-3 md:p-5 rounded-xl md:rounded-2xl border cursor-pointer transition-all duration-200 ${
                    isUnread
                      ? 'bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10'
                      : 'bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.05] opacity-75'
                  }`}
                >
                  <div className="flex items-start gap-2 md:gap-4">
                    <div className={`p-2 md:p-3 rounded-lg md:rounded-xl border ${getPriorityColor(notification.priority)}`}>
                      <IconComponent size={16} className="md:w-5 md:h-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                        <h3 className="text-sm md:text-base font-semibold text-white truncate">
                          {notification.title}
                        </h3>
                        {isUnread && (
                          <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-500 rounded-full flex-shrink-0" />
                        )}
                        <span className={`text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded-full border ${getPriorityColor(notification.priority)}`}>
                          {notification.category}
                        </span>
                      </div>
                      
                      <p className="text-xs md:text-sm text-gray-300 mb-2 md:mb-3 line-clamp-2 md:line-clamp-none">
                        {notification.body}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-2 md:gap-4 text-[10px] md:text-xs text-gray-500">
                        <span className="whitespace-nowrap">{formatTimestamp(notification.createdAt)}</span>
                        {notification.metadata?.agentName && (
                          <span className="flex items-center gap-1 truncate">
                            <Rocket size={10} className="flex-shrink-0 md:w-3 md:h-3" />
                            <span className="truncate">{notification.metadata.agentName}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {notification.metadata?.agentId && (
                      <div className="flex-shrink-0">
                        <ExternalLink size={14} className="text-gray-500 md:w-4 md:h-4" />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {filteredNotifications.length > 0 && (
          <div className="mt-6 md:mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
            <p className="text-xs md:text-sm text-gray-400 text-center sm:text-left">
              Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} of {total}
            </p>
            
            <div className="flex items-center gap-2 justify-center sm:justify-end">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-3 md:px-4 py-2 bg-white/[0.02] border border-white/[0.08] rounded-lg hover:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-xs md:text-sm text-white min-h-[44px] min-w-[88px]"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={!hasMore}
                className="px-3 md:px-4 py-2 bg-white/[0.02] border border-white/[0.08] rounded-lg hover:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-xs md:text-sm text-white min-h-[44px] min-w-[88px]"
              >
                Next
              </button>
            </div>
          </div>
        )}
          </div>
        </main>
      </div>
    </div>
  );
}
