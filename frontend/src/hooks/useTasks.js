import { useState, useEffect } from 'react';
import { fetchTasks } from '../api';

export function useTasks(query, status, page, pageSize) {
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let isCancelled = false;

    setLoading(true);
    setError(null);

    fetchTasks({ query, status, page, pageSize, signal: controller.signal })
      .then((data) => {
        if (!isCancelled) {
          setTasks(data.items || []);
          setTotal(data.total || 0);
          setError(null);
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          // Ignored: request intentionally cancelled due to new input/params
          return;
        }
        if (!isCancelled) {
          setError(err.message);
          setTasks([]);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [query, status, page, pageSize]);

  return { tasks, total, loading, error };
}
