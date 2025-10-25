import useSWR from 'swr';

interface UserPreferencesResponse {
  notificationsEnabled: boolean;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export function useUserPreferences() {
  const { data, error, mutate, isLoading } = useSWR<UserPreferencesResponse>(
    '/api/user/preferences',
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  return {
    notificationsEnabled: data?.notificationsEnabled ?? true,
    isLoading,
    isError: error,
    mutate,
  };
}

export async function updateNotificationPreference(enabled: boolean) {
  const res = await fetch('/api/user/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ notificationsEnabled: enabled }),
  });
  if (!res.ok) throw new Error('Failed to update preferences');
  return res.json();
}
