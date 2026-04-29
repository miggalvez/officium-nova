import { useEffect, useState } from 'react';

import { getStatus } from '../../api/client';
import type { StatusResponse } from '../../api/types';

let statusCache: StatusResponse | undefined;
let statusPromise: Promise<StatusResponse> | undefined;

async function fetchStatus(): Promise<StatusResponse> {
  if (statusCache) {
    return statusCache;
  }
  if (!statusPromise) {
    statusPromise = getStatus().then((response) => {
      statusCache = response;
      return response;
    });
  }
  return statusPromise;
}

export function useStatus(): StatusResponse | undefined {
  const [state, setState] = useState<StatusResponse | undefined>(() => statusCache);
  useEffect(() => {
    let cancelled = false;
    fetchStatus()
      .then((value) => {
        if (!cancelled) {
          setState(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState(undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

export function _resetStatusCache(): void {
  statusCache = undefined;
  statusPromise = undefined;
}
