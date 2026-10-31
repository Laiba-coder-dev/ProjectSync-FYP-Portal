import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface TaskState {
  taskId: string | null;
  status: 'idle' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentStep: string;
  results: any | null;
}

interface TaskContextType extends TaskState {
  setTaskData: (data: Partial<TaskState>) => void;
  clearTask: () => void;
  cancelTask: () => Promise<void>;
}

const defaultState: TaskState = {
  taskId: null,
  status: 'idle',
  progress: 0,
  currentStep: '',
  results: null,
};

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const useTask = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTask must be used within a TaskProvider');
  }
  return context;
};

export const TaskProvider = ({ children }: { children: ReactNode }) => {
  const [taskState, setTaskState] = useState<TaskState>(defaultState);

  const setTaskData = (data: Partial<TaskState>) => {
    setTaskState((prev) => ({ ...prev, ...data }));
  };

  const clearTask = () => {
    setTaskState(defaultState);
  };

  const cancelTask = async () => {
    if (!taskState.taskId || taskState.status !== 'processing') return;

    try {
      const backendUrl = import.meta.env.VITE_AI_URL || 'http://localhost:8000';
      await fetch(`${backendUrl}/ai/analyzer/cancel/${taskState.taskId}`, {
        method: 'POST',
      });
      setTaskData({ status: 'cancelled', currentStep: 'Task cancelled by user', progress: 0 });
    } catch (error) {
      console.error('Failed to cancel task', error);
    }
  };

  // Poll for status
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const pollStatus = async () => {
      if (!taskState.taskId || taskState.status !== 'processing') return;

      try {
        const backendUrl = import.meta.env.VITE_AI_URL || 'http://localhost:8000';
        const response = await fetch(`${backendUrl}/ai/analyzer/status/${taskState.taskId}`);
        
        if (response.ok) {
          const data = await response.json();
          setTaskData({
            status: data.status,
            progress: data.progress,
            currentStep: data.current_step,
            results: data.results,
          });
        }
      } catch (error) {
        console.error('Error polling task status', error);
      }
    };

    if (taskState.taskId && taskState.status === 'processing') {
      interval = setInterval(pollStatus, 2000); // Poll every 2 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [taskState.taskId, taskState.status]);

  return (
    <TaskContext.Provider value={{ ...taskState, setTaskData, clearTask, cancelTask }}>
      {children}
    </TaskContext.Provider>
  );
};
