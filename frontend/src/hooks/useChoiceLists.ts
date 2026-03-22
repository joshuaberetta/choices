import { useState, useEffect } from 'react';
import type { ChoiceList, Project } from '../services/api';
import apiClient from '../services/api';

export const useChoiceLists = () => {
  const [choiceLists, setChoiceLists] = useState<ChoiceList[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChoiceLists = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getChoiceLists();
      setChoiceLists(response.data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch choice lists');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChoiceLists();
  }, []);

  return { choiceLists, loading, error, refetch: fetchChoiceLists };
};

export const useChoiceList = (id: string | number) => {
  const [choiceList, setChoiceList] = useState<ChoiceList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChoiceList = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getChoiceList(id);
      setChoiceList(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch choice list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChoiceList();
  }, [id]);

  return { choiceList, loading, error, refetch: fetchChoiceList };
};

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getProjects();
      setProjects(response.data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);
  return { projects, loading, error, refetch: fetchProjects };
};
