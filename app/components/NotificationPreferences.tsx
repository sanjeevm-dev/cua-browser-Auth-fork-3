'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellOff } from 'lucide-react';
import { useUserPreferences, updateNotificationPreference } from '../hooks/useUserPreferences';

export default function NotificationPreferences() {
  const { notificationsEnabled, isLoading, mutate } = useUserPreferences();
  const [isToggling, setIsToggling] = useState(false);
  const [localEnabled, setLocalEnabled] = useState(notificationsEnabled);

  useEffect(() => {
    setLocalEnabled(notificationsEnabled);
  }, [notificationsEnabled]);

  const handleToggle = async () => {
    const newValue = !localEnabled;
    setLocalEnabled(newValue);
    setIsToggling(true);

    try {
      await updateNotificationPreference(newValue);
      await mutate();
    } catch (error) {
      console.error('Failed to update notification preference:', error);
      setLocalEnabled(!newValue);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="w-full mt-3 md:mt-6"
    >
      <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-xl md:rounded-2xl p-4 md:p-6 hover:border-white/[0.12] transition-all duration-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 md:gap-3 mb-2">
              {localEnabled ? (
                <Bell size={18} className="text-blue-400 flex-shrink-0 md:w-5 md:h-5" />
              ) : (
                <BellOff size={18} className="text-gray-500 flex-shrink-0 md:w-5 md:h-5" />
              )}
              <h3 className="text-base md:text-lg font-semibold text-white">Notification Alerts</h3>
            </div>
            <p className="text-xs md:text-sm text-gray-400 leading-relaxed">
              {localEnabled 
                ? 'You will see badge counts and visual alerts for new notifications'
                : 'Notifications are still recorded but won\'t show alerts or badge counts'}
            </p>
          </div>

          <button
            onClick={handleToggle}
            disabled={isLoading || isToggling}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 ${
              localEnabled ? 'bg-blue-500' : 'bg-gray-600'
            }`}
            aria-label={`${localEnabled ? 'Disable' : 'Enable'} notifications`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ${
                localEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {isToggling && (
          <div className="mt-3 pt-3 border-t border-white/[0.05]">
            <p className="text-[10px] md:text-xs text-gray-500 flex items-center gap-2">
              <span className="animate-spin">⚙️</span>
              Updating preferences...
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
