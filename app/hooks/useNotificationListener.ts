"use client";

import { useEffect, useRef } from 'react';
import { useNotifications } from './useNotifications';
import { useUserPreferences } from './useUserPreferences';
import { useToast } from '../contexts/ToastContext';
import { UserNotification } from '@/lib/types/mongodb';
import { ToastType } from '../components/Toast';

export function useNotificationListener() {
  const { notifications } = useNotifications(5, 0);
  const { notificationsEnabled } = useUserPreferences();
  const toast = useToast();
  const previousNotificationIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (notifications.length === 0) return;

    const currentIds = new Set(notifications.map(n => n.id));

    if (isInitialLoadRef.current) {
      previousNotificationIdsRef.current = currentIds;
      isInitialLoadRef.current = false;
      return;
    }

    if (!notificationsEnabled) {
      previousNotificationIdsRef.current = currentIds;
      return;
    }

    const newNotifications = notifications.filter(
      n => !previousNotificationIdsRef.current.has(n.id)
    );

    newNotifications.forEach((notification: UserNotification) => {
      const toastType = mapPriorityToToastType(notification.priority);
      const message = `${notification.title}: ${notification.body}`;
      
      toast.showToast(message, toastType, 5000);
    });

    previousNotificationIdsRef.current = currentIds;
  }, [notifications, notificationsEnabled, toast]);
}

function mapPriorityToToastType(priority: string): ToastType {
  switch (priority) {
    case 'critical':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'info';
  }
}
