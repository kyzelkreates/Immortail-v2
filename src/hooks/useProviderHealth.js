// ================================================================
// IMMORTAIL™ Gen2 — useProviderHealth hook
// Reads provider registry state. Exposes test trigger.
// ================================================================

import { useState, useEffect, useCallback } from 'react';
import storage           from '../core/storage.js';
import { EventBus }      from '../core/eventBus.js';
import { testProvider }  from '../services/ai/connectionTester.js';
import { toggleProvider, getAllProviders } from '../services/ai/providerRegistry.js';

export function useProviderHealth() {
  const [providers, setProviders] = useState(() => storage.getProviders());
  const [testing,   setTesting]   = useState({});  // { [id]: boolean }

  const refresh = useCallback(() => setProviders(storage.getProviders()), []);

  useEffect(() => {
    const unsub1 = EventBus.on('SYSTEM::AI_PROVIDER_ADDED',   refresh);
    const unsub2 = EventBus.on('SYSTEM::AI_PROVIDER_UPDATED', refresh);
    const unsub3 = EventBus.on('SYSTEM::AI_PROVIDER_REMOVED', refresh);
    const unsub4 = EventBus.on('SYSTEM::AI_PROVIDER_TOGGLED', refresh);
    const unsub5 = EventBus.on('SYSTEM::AI_TEST_COMPLETE',    refresh);
    const unsub6 = EventBus.on('SYSTEM::AI_TEST_FAILED',      refresh);
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); };
  }, [refresh]);

  const test = useCallback(async (id) => {
    setTesting(t => ({ ...t, [id]: true }));
    await testProvider(id);
    refresh();
    setTesting(t => ({ ...t, [id]: false }));
  }, [refresh]);

  const toggle = useCallback((id) => {
    toggleProvider(id);
    refresh();
  }, [refresh]);

  const onlineCount  = providers.filter(p => p.status === 'online').length;
  const enabledCount = providers.filter(p => p.enabled).length;

  return { providers, testing, test, toggle, refresh, onlineCount, enabledCount };
}

export default useProviderHealth;
