import { useState, useEffect } from 'react';
import type { UserChoiceListConfig } from '../services/api';
import apiClient from '../services/api';

export const useFollowedLists = () => {
  const [configs, setConfigs] = useState<UserChoiceListConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.getFollowedLists();
      setConfigs(res.data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch followed lists');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  return { configs, loading, error, refetch: fetchConfigs };
};

export const useFollowedList = (id: number) => {
  const [config, setConfig] = useState<UserChoiceListConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.getFollowedList(id);
      setConfig(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch followed list config');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [id]);

  return { config, setConfig, loading, error, refetch: fetchConfig };
};
