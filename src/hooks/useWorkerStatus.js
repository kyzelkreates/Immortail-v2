// ================================================================
// IMMORTAIL™ Gen2 — useWorkerStatus hook
// Real-time worker status from orchestrator + storage.
// ================================================================

import { useState, useEffect, useCallback } from 'react';
import { getAllWorkers, resetWorkerErrors } from '../workers/orchestrator.js';
import { EventBus }     from '../core/eventBus.js';

export function useWorkerStatus() {
  const [workers, setWorkers] = useState(() => getAllWorkers());

  const refresh = useCallback(() => setWorkers(getAllWorkers()), []);

  useEffect(() => {
    const u1 = EventBus.on('SYSTEM::WORKER_REGISTERED',    refresh);
    const u2 = EventBus.on('SYSTEM::WORKER_STARTED',       refresh);
    const u3 = EventBus.on('SYSTEM::WORKER_STOPPED',       refresh);
    const u4 = EventBus.on('SYSTEM::WORKER_ERROR',         refresh);
    const u5 = EventBus.on('SYSTEM::WORKER_TASK_COMPLETE', refresh);
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [refresh]);

  const resetWorker = useCallback((id) => {
    resetWorkerErrors(id);
    refresh();
  }, [refresh]);

  const activeCount = workers.filter(w => w.status === 'active').length;
  const errorCount  = workers.filter(w => w.status === 'error').length;
  const totalTasks  = workers.reduce((s, w) => s + (w.tasksRun ?? 0), 0);

  return { workers, activeCount, errorCount, totalTasks, resetWorker, refresh };
}

export default useWorkerStatus;
