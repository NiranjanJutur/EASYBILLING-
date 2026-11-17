/**
 * offlineStore.ts — keeps the shop working without internet.
 *
 *  • Cache:  every successful read is saved on the device, per store.
 *            When the network is down, reads come from this copy.
 *  • Outbox: changes made while offline (bills, purchases, payments, new
 *            customers/items/suppliers) are queued on the device in order.
 *  • Sync:   the queue is sent to Supabase automatically when the network is
 *            back (every 20 s, when the browser goes online, or on "Sync now").
 *            Each queued change carries a client reference, so a retry after a
 *            dropped connection never saves the same bill twice.
 */
import { kvStore } from './kvStore';
import { uuid } from '../../utils/ids';

// ─── Network errors ──────────────────────────────────────────────────────────

const NETWORK_PATTERN = /Failed to fetch|Network request failed|NetworkError|Load failed|No internet|network|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ECONNREFUSED|ETIMEDOUT|timed? ?out|fetch failed/i;

export const isNetworkError = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : (err as any)?.message ?? '';
  return NETWORK_PATTERN.test(String(msg));
};

// ─── Cache ───────────────────────────────────────────────────────────────────

export interface CacheEntry<T> {
  data: T;
  savedAt: number;
}

const cacheKey = (storeId: string, name: string) => `sms_cache:${storeId}:${name}`;

export const readCache = <T>(storeId: string, name: string) => kvStore.get<CacheEntry<T>>(cacheKey(storeId, name));

export const writeCache = (storeId: string, name: string, data: unknown) =>
  kvStore.set(cacheKey(storeId, name), { data, savedAt: Date.now() });

// ─── Outbox ──────────────────────────────────────────────────────────────────

export type OutboxKind =
  | 'sale'
  | 'purchase'
  | 'supplier_payment'
  | 'customer_insert'
  | 'customer_update'
  | 'customer_balance'
  | 'product_insert'
  | 'product_update'
  | 'supplier_insert'
  | 'supplier_update'
  | 'transaction_insert';

export interface OutboxOp {
  id: string;            // also the client reference sent to the database
  storeId: string;
  kind: OutboxKind;
  payload: any;
  label: string;         // what the user sees, e.g. "Bill OFF-K7Q2M9 · ₹540"
  createdAt: number;
  status: 'pending' | 'failed';
  attempts: number;
  error?: string;
}

const OUTBOX_KEY = 'sms_outbox_v1';

let outboxCache: OutboxOp[] | null = null;
let outboxLock: Promise<unknown> = Promise.resolve();

/** Serialises outbox reads/writes so two quick changes can't overwrite each other. */
const withOutbox = <T>(fn: (ops: OutboxOp[]) => Promise<T> | T): Promise<T> => {
  const run = outboxLock.then(async () => {
    if (!outboxCache) outboxCache = (await kvStore.get<OutboxOp[]>(OUTBOX_KEY)) ?? [];
    const result = await fn(outboxCache);
    await kvStore.set(OUTBOX_KEY, outboxCache);
    return result;
  });
  outboxLock = run.catch(() => undefined);
  return run;
};

export const getOutbox = (): Promise<OutboxOp[]> => withOutbox(ops => ops.slice());

export const pendingOps = async (storeId: string, kind?: OutboxKind): Promise<OutboxOp[]> =>
  (await getOutbox()).filter(o => o.storeId === storeId && (!kind || o.kind === kind));

export const enqueue = async (
  op: Omit<OutboxOp, 'id' | 'createdAt' | 'status' | 'attempts'> & { id?: string },
): Promise<OutboxOp> => {
  const full: OutboxOp = { ...op, id: op.id ?? uuid(), createdAt: Date.now(), status: 'pending', attempts: 0 };
  await withOutbox(ops => { ops.push(full); });
  emit();
  scheduleSync(1500);
  return full;
};

export const discardOp = async (id: string) => {
  await withOutbox(ops => {
    const i = ops.findIndex(o => o.id === id);
    if (i >= 0) ops.splice(i, 1);
  });
  emit();
};

export const retryOp = async (id: string) => {
  await withOutbox(ops => {
    const op = ops.find(o => o.id === id);
    if (op) { op.status = 'pending'; op.error = undefined; }
  });
  emit();
  return syncNow();
};

// ─── Sync engine ─────────────────────────────────────────────────────────────

/** Return 'skip' to leave the change queued for later (e.g. it belongs to another store). */
export type SyncHandler = (op: OutboxOp) => Promise<void | 'skip'>;
const handlers: Partial<Record<OutboxKind, SyncHandler>> = {};

/** The data layer registers how each kind of queued change is sent. */
export const registerSyncHandler = (kind: OutboxKind, fn: SyncHandler) => { handlers[kind] = fn; };

export interface SyncState {
  online: boolean;
  syncing: boolean;
  pending: number;
  failed: number;
  lastSyncAt: number | null;
  lastError: string | null;
}

let state: SyncState = { online: true, syncing: false, pending: 0, failed: 0, lastSyncAt: null, lastError: null };
const listeners = new Set<(s: SyncState) => void>();
const afterSyncListeners = new Set<() => void>();

const emit = async (patch: Partial<SyncState> = {}) => {
  const ops = await getOutbox();
  state = {
    ...state,
    ...patch,
    pending: ops.filter(o => o.status === 'pending').length,
    failed: ops.filter(o => o.status === 'failed').length,
  };
  listeners.forEach(l => l(state));
};

export const getSyncState = () => state;

export const subscribeSync = (fn: (s: SyncState) => void) => {
  listeners.add(fn);
  fn(state);
  emit();
  return () => { listeners.delete(fn); };
};

/** Called after a sync that sent at least one change, so screens can reload. */
export const onSynced = (fn: () => void) => {
  afterSyncListeners.add(fn);
  return () => { afterSyncListeners.delete(fn); };
};

/** Data reads/writes report whether the network worked. */
export const reportOnline = (online: boolean) => {
  if (state.online !== online) {
    emit({ online });
    if (online) scheduleSync(500);
  }
};

let syncing: Promise<void> | null = null;

export const syncNow = (): Promise<void> => {
  if (syncing) return syncing;
  syncing = (async () => {
    let sent = 0;
    await emit({ syncing: true, lastError: null });
    try {
      const ops = (await getOutbox()).filter(o => o.status === 'pending');
      for (const op of ops) {
        const handler = handlers[op.kind];
        if (!handler) continue;
        try {
          if ((await handler(op)) === 'skip') continue;
          await withOutbox(all => {
            const i = all.findIndex(o => o.id === op.id);
            if (i >= 0) all.splice(i, 1);
          });
          sent++;
          state.online = true;
        } catch (err) {
          if (isNetworkError(err)) {
            state.online = false;
            break; // still offline — keep the rest in order for next time
          }
          // The database refused this change (e.g. a deleted item). Park it for the user.
          const message = err instanceof Error ? err.message : String(err);
          await withOutbox(all => {
            const o = all.find(x => x.id === op.id);
            if (o) { o.status = 'failed'; o.attempts += 1; o.error = message; }
          });
          state.lastError = message;
        }
      }
    } finally {
      await emit({ syncing: false, lastSyncAt: sent > 0 ? Date.now() : state.lastSyncAt });
      syncing = null;
      if (sent > 0) afterSyncListeners.forEach(l => l());
    }
  })();
  return syncing;
};

let timer: ReturnType<typeof setTimeout> | null = null;
const scheduleSync = (ms: number) => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; syncNow(); }, ms);
};

let started = false;
/** Starts background syncing. Safe to call more than once. */
export const startAutoSync = () => {
  if (started) return;
  started = true;
  setInterval(() => {
    if (state.pending > 0 || !state.online) syncNow();
  }, 20_000);
  try {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('online', () => reportOnline(true));
      window.addEventListener('offline', () => emit({ online: false }));
    }
  } catch { /* not a browser */ }
  emit();
  scheduleSync(2000);
};
