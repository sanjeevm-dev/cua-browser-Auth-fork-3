import useSWR from 'swr';
import { UserNotification } from '@/lib/types/mongodb';

interface NotificationsResponse {
  notifications: UserNotification[];
  total: number;
  hasMore: boolean;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export function useNotifications(limit: number = 15, skip: number = 0) {
  const { data, error, mutate, isLoading } = useSWR<NotificationsResponse>(
    `/api/notifications?limit=${limit}&skip=${skip}`,
    fetcher,
    {
      refreshInterval: 60000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  return {
    notifications: data?.notifications || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    isLoading,
    isError: error,
    mutate,
  };
}

export function useNotificationCount() {
  const { data, error, mutate, isLoading } = useSWR<{ count: number }>(
    '/api/notifications/count',
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  return {
    count: data?.count || 0,
    isLoading,
    isError: error,
    mutate,
  };
}

export async function markAsRead(notificationId: string) {
  const res = await fetch(`/api/notifications/${notificationId}/read`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to mark as read');
  return res.json();
}

export async function markAllAsRead() {
  const res = await fetch('/api/notifications/mark-all-read', {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to mark all as read');
  return res.json();
}
