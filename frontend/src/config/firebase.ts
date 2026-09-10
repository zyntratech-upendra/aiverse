// Pure MongoDB Atlas & REST API adapter replacing Firebase completely.
// Zero dependencies on Firebase SDKs.

const API_BASE = ((import.meta.env.VITE_API_BASE as string) || 'http://localhost:4000/api').replace(/\/+$/, '');

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = localStorage.getItem('aiverse_api_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {}
  return headers;
}

function resolveEndpoint(collectionName: string): string {
  const norm = collectionName.toLowerCase().replace(/[-_]/g, '');
  if (norm.includes('jury') || norm.includes('evaluation')) return `${API_BASE}/jury_evaluations`;
  if (norm.includes('event')) return `${API_BASE}/events`;
  if (norm.includes('user') || norm.includes('team')) return `${API_BASE}/users`;
  if (norm.includes('registration')) return `${API_BASE}/registrations`;
  if (norm.includes('attendance')) return `${API_BASE}/attendance`;
  if (norm.includes('organizer')) return `${API_BASE}/organizers`;
  if (norm.includes('album') || norm.includes('galler')) return `${API_BASE}/albums`;
  if (norm.includes('submission')) return `${API_BASE}/quizzes/submissions`;
  if (norm.includes('session')) return `${API_BASE}/sessions`;
  if (norm.includes('quiz')) return `${API_BASE}/quizzes`;
  if (norm.includes('contact') || norm.includes('inquir')) return `${API_BASE}/contacts`;
  if (norm.includes('setting')) return `${API_BASE}/settings`;
  return `${API_BASE}/${collectionName}`;
}

export interface DocumentSnapshot<T = any> {
  id: string;
  exists: () => boolean;
  data: () => T;
}

export interface QuerySnapshot<T = any> {
  empty: boolean;
  size: number;
  docs: Array<DocumentSnapshot<T>>;
  forEach: (callback: (doc: DocumentSnapshot<T>) => void) => void;
}

export interface CollectionRef {
  type: 'collection';
  name: string;
  collectionName?: string;
}

export interface DocRef {
  type: 'doc';
  collectionName: string;
  id: string;
}

export interface QueryRef {
  type: 'query';
  collectionName: string;
  filters: Array<{ field: string; op: string; value: any }>;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  limitCount?: number;
}

export const db = {
  type: 'mongodb_rest_db',
};

export const collection = (_dbInstance: any, collectionName: string): CollectionRef => ({
  type: 'collection',
  name: collectionName,
  collectionName,
});

export const doc = (_dbOrCol: any, colOrId?: string, maybeId?: string): DocRef => {
  if (maybeId) {
    return { type: 'doc', collectionName: colOrId!, id: maybeId };
  }
  if (typeof _dbOrCol === 'object' && _dbOrCol?.type === 'collection') {
    return { type: 'doc', collectionName: _dbOrCol.name, id: colOrId! };
  }
  return { type: 'doc', collectionName: colOrId || 'unknown', id: maybeId || 'unknown' };
};

export const query = (colRef: CollectionRef, ...queryConstraints: any[]): QueryRef => {
  const q: QueryRef = {
    type: 'query',
    collectionName: colRef.name,
    filters: [],
  };
  for (const c of queryConstraints) {
    if (c?.type === 'where') q.filters.push({ field: c.field, op: c.op, value: c.value });
    if (c?.type === 'orderBy') {
      q.sortField = c.field;
      q.sortDirection = c.dir || 'asc';
    }
    if (c?.type === 'limit') q.limitCount = c.count;
  }
  return q;
};

export const where = (field: string, op: string, value: any) => ({
  type: 'where',
  field,
  op,
  value,
});

export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc') => ({
  type: 'orderBy',
  field,
  dir,
});

export const limit = (count: number) => ({
  type: 'limit',
  count,
});

export const increment = (n: number) => ({ __increment: n });

export const getDoc = async (docRef: DocRef): Promise<DocumentSnapshot> => {
  if (!docRef || !docRef.id) {
    return { id: '', exists: () => false, data: () => ({}) };
  }
  try {
    const endpoint = resolveEndpoint(docRef.collectionName);
    const res = await fetch(`${endpoint}/${encodeURIComponent(docRef.id)}`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      return { id: docRef.id, exists: () => false, data: () => ({}) };
    }
    const data = await res.json();
    const docData = data?.user || data?.event || data?.registration || data?.quiz || data?.album || data?.attendance || data?.contact || data;
    const exists = Boolean(docData && Object.keys(docData).length > 0 && !docData.error);
    return {
      id: docData?.id || docData?._id || docRef.id,
      exists: () => exists,
      data: () => docData || {},
    };
  } catch {
    return { id: docRef.id, exists: () => false, data: () => ({}) };
  }
};

export const getDocs = async (queryOrCol: CollectionRef | QueryRef): Promise<QuerySnapshot> => {
  try {
    const colName = queryOrCol.type === 'query' ? queryOrCol.collectionName : (queryOrCol.collectionName || queryOrCol.name);
    const endpoint = resolveEndpoint(colName);
    const url = new URL(endpoint, window.location.origin);

    if (queryOrCol.type === 'query' && queryOrCol.filters) {
      for (const f of queryOrCol.filters) {
        if (f.op === '==' || f.op === '===') {
          url.searchParams.set(f.field, String(f.value));
        }
      }
    }

    const res = await fetch(url.toString(), {
      headers: getHeaders(),
    });

    if (!res.ok) {
      return { empty: true, size: 0, docs: [], forEach: () => {} };
    }

    let items: any[] = await res.json();
    if (!Array.isArray(items)) {
      items = (items as any).events || (items as any).users || (items as any).registrations || (items as any).quizzes || (items as any).albums || (items as any).attendance || (items as any).contacts || [];
    }

    const docs: DocumentSnapshot[] = items.map((item) => ({
      id: item.id || item._id || item.uid || '',
      exists: () => true,
      data: () => item,
    }));

    return {
      empty: docs.length === 0,
      size: docs.length,
      docs,
      forEach: (cb) => docs.forEach(cb),
    };
  } catch (err) {
    console.warn('[MongoDB Client getDocs notice]', err);
    return { empty: true, size: 0, docs: [], forEach: () => {} };
  }
};

export const setDoc = async (docRef: DocRef, data: any, _options?: { merge?: boolean }): Promise<void> => {
  const endpoint = resolveEndpoint(docRef.collectionName);
  const payload = { ...data, id: docRef.id, _id: docRef.id };

  try {
    // Try update first
    const updateRes = await fetch(`${endpoint}/${encodeURIComponent(docRef.id)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!updateRes.ok && updateRes.status === 404) {
      // Create if doesn't exist
      await fetch(endpoint, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
    }
  } catch (err) {
    console.error('[MongoDB Client setDoc error]', err);
  }
};

export const updateDoc = async (docRef: DocRef, data: any): Promise<void> => {
  const endpoint = resolveEndpoint(docRef.collectionName);
  try {
    await fetch(`${endpoint}/${encodeURIComponent(docRef.id)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.error('[MongoDB Client updateDoc error]', err);
  }
};

export const deleteDoc = async (docRef: DocRef): Promise<void> => {
  const endpoint = resolveEndpoint(docRef.collectionName);
  try {
    await fetch(`${endpoint}/${encodeURIComponent(docRef.id)}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
  } catch (err) {
    console.error('[MongoDB Client deleteDoc error]', err);
  }
};

export const addDoc = async (colRef: CollectionRef, data: any): Promise<DocRef> => {
  const endpoint = resolveEndpoint(colRef.name);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  const saved = await res.json();
  const id = saved?.id || saved?._id || saved?.event?.id || saved?.registration?.id || String(Date.now());
  return { type: 'doc', collectionName: colRef.name, id };
};

export const writeBatch = (_db?: any) => {
  const ops: Array<() => Promise<void>> = [];
  return {
    set: (docRef: DocRef, data: any, options?: any) => ops.push(() => setDoc(docRef, data, options)),
    update: (docRef: DocRef, data: any) => ops.push(() => updateDoc(docRef, data)),
    delete: (docRef: DocRef) => ops.push(() => deleteDoc(docRef)),
    commit: async () => {
      for (const op of ops) await op();
    },
  };
};

export const onSnapshot = (
  docOrQuery: DocRef | QueryRef,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void
) => {
  let isMounted = true;

  const fetchLatest = async () => {
    if (!isMounted) return;
    try {
      if (docOrQuery.type === 'doc') {
        const snap = await getDoc(docOrQuery as DocRef);
        if (isMounted) onNext(snap);
      } else {
        const snap = await getDocs(docOrQuery as QueryRef);
        if (isMounted) onNext(snap);
      }
    } catch (err) {
      if (onError && isMounted) onError(err);
    }
  };

  fetchLatest();
  const intervalId = setInterval(fetchLatest, 10000);

  return () => {
    isMounted = false;
    clearInterval(intervalId);
  };
};

// Shims for auth, app, storage, functions
export const app = { name: '[DEFAULT]', options: {} };
export const auth = { currentUser: null };
export const storage = {};
export const getFunctions = () => ({});
export const httpsCallable = (_funcs: any, _name: string) => async (_data?: any) => ({ data: { success: true } });
export const isReady = true;
export const initializationError = null;
export const firebaseConfig = {};
export const analyticsPromise = Promise.resolve(null);
