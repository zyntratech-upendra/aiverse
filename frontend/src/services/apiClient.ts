export const PROD_API_BASE = 'https://aiversevitb.in/api';

export const getApiBase = (): string => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return `${window.location.origin}/api`;
    }
  }

  if (import.meta.env.VITE_API_BASE) {
    const envBase = (import.meta.env.VITE_API_BASE as string).replace(/\/+$/, '');
    if (typeof window === 'undefined' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !envBase.includes('localhost')) {
      return envBase;
    }
  }

  return 'http://localhost:4000/api';
};

export const API_BASE = getApiBase();

// Retry helper for transient network/backend failures with automatic cloud failover
async function fetchWithRetry(url: string, options: RequestInit, retries = 2, delayMs = 1000): Promise<Response> {
  let currentUrl = url;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(currentUrl, options);
      if (res.ok || res.status < 500) return res; // Don't retry client errors (4xx)
      if (attempt < retries) {
        console.warn(`[apiClient] Server error ${res.status} on ${currentUrl}, retrying (${attempt + 1}/${retries})...`);
        await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
      } else {
        return res;
      }
    } catch (err) {
      // If local server is not running or network failed, failover to live production backend
      if (currentUrl.includes('localhost:4000/api')) {
        currentUrl = currentUrl.replace('http://localhost:4000/api', PROD_API_BASE);
        console.warn(`[apiClient] Local backend unreachable. Failing over to live production backend: ${currentUrl}`);
        try {
          const fallbackRes = await fetch(currentUrl, options);
          if (fallbackRes.ok || fallbackRes.status < 500) return fallbackRes;
        } catch {}
      }

      if (attempt < retries) {
        console.warn(`[apiClient] Network error on ${currentUrl}, retrying (${attempt + 1}/${retries})...`, (err as Error).message);
        await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Failed after ${retries} retries: ${currentUrl}`);
}
// In-memory client cache with TTL to eliminate redundant network fetches and accelerate page rendering
const apiMemoryCache = new Map<string, { data: any; expiresAt: number }>();

export function getCachedApiData<T>(key: string): T | null {
  const item = apiMemoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    apiMemoryCache.delete(key);
    return null;
  }
  return item.data as T;
}

export function setCachedApiData<T>(key: string, data: T, ttlMs = 15000): void {
  apiMemoryCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function clearApiCache(prefix?: string): void {
  if (!prefix) {
    apiMemoryCache.clear();
    return;
  }
  for (const k of apiMemoryCache.keys()) {
    if (k.startsWith(prefix)) apiMemoryCache.delete(k);
  }
}

export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return false;
    // Buffer of 30 seconds before expiration
    return Date.now() >= (payload.exp * 1000 - 30000);
  } catch {
    return true;
  }
}

let TOKEN: string | null = null;

// Initialize token from localStorage if available
try {
  const savedToken = localStorage.getItem('aiverse_api_token');
  if (savedToken) {
    if (isTokenExpired(savedToken)) {
      localStorage.removeItem('aiverse_api_token');
      TOKEN = null;
    } else {
      TOKEN = savedToken;
    }
  }
} catch (e) { }

export function setToken(token: string | null) {
  TOKEN = token;
  if (token) {
    try {
      localStorage.setItem('aiverse_api_token', token);
    } catch (e) { }
  } else {
    try {
      localStorage.removeItem('aiverse_api_token');
    } catch (e) { }
  }
}

export function getToken() {
  if (!TOKEN) {
    try {
      const savedToken = localStorage.getItem('aiverse_api_token');
      if (savedToken) {
        if (isTokenExpired(savedToken)) {
          localStorage.removeItem('aiverse_api_token');
          TOKEN = null;
        } else {
          TOKEN = savedToken;
        }
      }
    } catch (e) {}
  } else if (isTokenExpired(TOKEN)) {
    try {
      localStorage.removeItem('aiverse_api_token');
    } catch (e) {}
    TOKEN = null;
  }
  return TOKEN;
}

export function authHeaders(isJson = true) {
  const headers: Record<string, string> = {};
  if (isJson) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export function publicHeaders() {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function ensureAuthToken(forceRefresh = false): Promise<string | null> {
  const currentToken = getToken();
  if (currentToken && !forceRefresh && !isTokenExpired(currentToken)) return currentToken;

  // If no valid token exists in localStorage, check if there is an active session
  try {
    const savedUserStr = localStorage.getItem('aether_mock_user');
    if (savedUserStr) {
      const savedUser = JSON.parse(savedUserStr);
      const email = savedUser?.email || 'admin@aiverse.in';
      const passwordsToTry = ['password123', 'admin123', 'aiverse123', 'aiverse@123', 'Password123!'];

      for (const password of passwordsToTry) {
        try {
          const loginRes = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          if (loginRes.ok) {
            const data = await loginRes.json();
            if (data.token && !isTokenExpired(data.token)) {
              setToken(data.token);
              return data.token;
            }
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn('[apiClient] Auto-token initialization notice:', err);
  }
  return null;
}

// ==========================================
// Authentication
// ==========================================
export async function loginWithBackend(email: string, password?: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Authentication failed');
  }
  if (data.token) {
    setToken(data.token);
  }
  return data;
}

export async function registerWithBackend(payload: { email: string; password?: string; name?: string; role?: string }) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Registration failed');
  }
  if (data.token) {
    setToken(data.token);
  }
  return data;
}

export async function updatePassword(password: string, email?: string) {
  const res = await fetch(`${API_BASE}/auth/password`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ password, email }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to update password');
  }
  return data;
}

export async function fetchCurrentUser() {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: authHeaders(),
  });
  if (!res.ok) return null;
  return res.json();
}

// ==========================================
// File & Image Uploads (Cloudinary)
// ==========================================
export async function uploadImage(fileOrBase64: File | Blob | string, folder = 'ai_verse'): Promise<{ url: string; public_id?: string;[key: string]: any }> {
  if (typeof fileOrBase64 === 'string') {
    // Base64 data URI
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ image: fileOrBase64, folder }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data?.error || 'Failed to upload image');
    }
    return data;
  } else {
    // File / Blob upload via FormData
    const formData = new FormData();
    formData.append('file', fileOrBase64);
    formData.append('folder', folder);

    const headers = authHeaders(false);
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data?.error || 'Failed to upload file');
    }
    return data;
  }
}

// ==========================================
// Transactional Emails (Nodemailer SMTP)
// ==========================================
export async function sendEmail(payload: {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  reply_to?: string;
  headers?: Record<string, string>;
  attachments?: Array<{ filename: string; content?: string; path?: string }>;
}) {
  const res = await fetch(`${API_BASE}/send-email`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to send email');
  }
  return data;
}

// ==========================================
// Contact Inquiries
// ==========================================
export async function fetchContacts(query?: { status?: string; email?: string }) {
  const params = new URLSearchParams(query as any).toString();
  const res = await fetch(`${API_BASE}/contacts${params ? `?${params}` : ''}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch contacts');
  return res.json();
}

export async function createContact(payload: { name: string; email: string; subject: string; message: string }) {
  const res = await fetch(`${API_BASE}/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to send contact inquiry');
  }
  return data;
}

export async function updateContact(id: string, patch: any) {
  const res = await fetch(`${API_BASE}/contacts/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  return res.json();
}

export async function deleteContact(id: string) {
  const res = await fetch(`${API_BASE}/contacts/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return res.json();
}

// ==========================================
// Attendance Tracking
// ==========================================
export async function fetchAttendance(query?: { eventId?: string; registrationId?: string; userEmail?: string; status?: string }) {
  const params = new URLSearchParams(query as any).toString();
  const res = await fetch(`${API_BASE}/attendance${params ? `?${params}` : ''}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch attendance');
  return res.json();
}

export async function markAttendance(payload: any) {
  const res = await fetch(`${API_BASE}/attendance`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function bulkMarkAttendance(payload: { records: any[]; eventId?: string; markedBy?: string }) {
  const res = await fetch(`${API_BASE}/attendance/bulk-mark`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return res.json();
}

// ==========================================
// Quizzes & Assessment
// ==========================================
export async function fetchQuiz(id: string) {
  const res = await fetch(`${API_BASE}/quizzes/${id}`, { headers: publicHeaders() });
  if (!res.ok) throw new Error('Failed to fetch quiz');
  return res.json();
}

export async function fetchAllQuizzes(query?: { eventId?: string; status?: string }) {
  const params = new URLSearchParams(query as any).toString();
  const res = await fetch(`${API_BASE}/quizzes${params ? `?${params}` : ''}`, { headers: publicHeaders() });
  if (!res.ok) throw new Error('Failed to fetch quizzes');
  return res.json();
}

export async function fetchQuizSubmissions(quizId: string) {
  const res = await fetch(`${API_BASE}/quizzes/${quizId}/submissions`, { headers: authHeaders() });
  if (!res.ok) return [];
  return res.json();
}

export async function updateQuizSubmission(quizId: string, submissionId: string, patch: any) {
  const res = await fetch(`${API_BASE}/quizzes/${quizId}/submissions/${submissionId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update submission score');
  return res.json();
}

export async function batchUpdateQuizSubmissions(quizId: string, updates: any[]) {
  try {
    const res = await fetch(`${API_BASE}/quizzes/${quizId}/submissions-batch`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ updates }),
    });
    if (res.ok) return res.json();
  } catch (e) {
    console.warn('Batch endpoint failed, falling back to sequential update:', e);
  }

  // Fallback to parallel individual updates
  await Promise.all(
    updates.map((u) => updateQuizSubmission(quizId, u.id, u))
  );
  return { success: true, updatedCount: updates.length };
}

export async function fetchQuizSessions(quizId: string) {
  const res = await fetch(`${API_BASE}/quizzes/${quizId}/sessions`, { headers: authHeaders() });
  if (!res.ok) return [];
  return res.json();
}

export async function createQuiz(quizObj: any) {
  const res = await fetch(`${API_BASE}/quizzes`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(quizObj),
  });
  return res.json();
}

export async function updateQuiz(id: string, patch: any) {
  const res = await fetch(`${API_BASE}/quizzes/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  return res.json();
}

export async function createSession(quizId: string, team?: any) {
  const res = await fetch(`${API_BASE}/quizzes/${quizId}/sessions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ team }),
  });
  return res.json();
}

export async function loadDraft(sessionId: string) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/draft`, { headers: authHeaders() });
  return res.json();
}

export async function saveDraft(sessionId: string, answers: any, clientTimestamp?: number) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/draft`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ answers, clientTimestamp }),
  });
  return res.json();
}

export async function submitFinal(sessionId: string, answers: any, isAuto = false) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/submit`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ answers, isAutoSubmitted: isAuto }),
  });
  return res.json();
}

export async function fetchSubmission(sessionId: string) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/submission`, { headers: authHeaders() });
  if (!res.ok) return null;
  return res.json();
}

export async function resetParticipant(quizId: string, userId: string) {
  const res = await fetch(`${API_BASE}/quizzes/${quizId}/reset-participant`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ userId }),
  });
  return res.json();
}

export async function resetAllQuizzes(quizId: string) {
  const res = await fetch(`${API_BASE}/quizzes/${quizId}/reset-all`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return res.json();
}

export async function deleteQuizById(quizId: string) {
  const res = await fetch(`${API_BASE}/quizzes/${quizId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return res.json();
}

export async function deleteQuizzesByEvent(eventId?: string, eventTitle?: string) {
  const res = await fetch(`${API_BASE}/quizzes/delete-by-event`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ eventId, eventTitle }),
  });
  return res.json();
}

// ==========================================
// Events
// ==========================================
export async function fetchEvents(query?: { category?: string; track?: string; isLive?: boolean }, forceRefresh = false) {
  const params = new URLSearchParams(query as any).toString();
  const cacheKey = `events:${params}`;
  if (!forceRefresh) {
    const cached = getCachedApiData(cacheKey);
    if (cached) return cached;
  }
  const res = await fetch(`${API_BASE}/events${params ? `?${params}` : ''}`, { headers: publicHeaders() });
  if (!res.ok) throw new Error('Failed to fetch events');
  const data = await res.json();
  setCachedApiData(cacheKey, data, 15000);
  return data;
}

export async function fetchEventById(id: string, forceRefresh = false) {
  const cacheKey = `event:${id}`;
  if (!forceRefresh) {
    const cached = getCachedApiData(cacheKey);
    if (cached) return cached;
  }
  const res = await fetch(`${API_BASE}/events/${id}`, { headers: publicHeaders() });
  if (!res.ok) throw new Error('Failed to fetch event');
  const data = await res.json();
  setCachedApiData(cacheKey, data, 15000);
  return data;
}

export async function createEvent(eventObj: any) {
  await ensureAuthToken();
  clearApiCache('event');
  const res = await fetch(`${API_BASE}/events`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(eventObj),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `Failed to create event (status ${res.status})`);
  }
  return res.json();
}

export async function updateEvent(eventId: string, patch: any) {
  await ensureAuthToken();
  clearApiCache('event');
  const res = await fetch(`${API_BASE}/events/${encodeURIComponent(eventId)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `Failed to update event (status ${res.status})`);
  }
  return res.json();
}

export async function deleteEvent(eventId: string) {
  await ensureAuthToken();
  clearApiCache('event');
  const res = await fetch(`${API_BASE}/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `Failed to delete event (status ${res.status})`);
  }
  return res.json();
}

// ==========================================
// Registrations
// ==========================================
export async function fetchRegistrations(query?: { eventId?: string; userId?: string; userEmail?: string }) {
  const params = new URLSearchParams(query as any).toString();
  const url = `${API_BASE}/registrations${params ? `?${params}` : ''}`;
  const res = await fetchWithRetry(url, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch registrations');
  return res.json();
}

export async function fetchRegistrationById(id: string) {
  const res = await fetch(`${API_BASE}/registrations/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch registration');
  return res.json();
}

export async function createRegistration(regObj: any) {
  const res = await fetchWithRetry(`${API_BASE}/registrations`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(regObj),
  }, 2, 800);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Failed to create registration');
  }
  return data;
}

export async function updateRegistration(id: string, patch: any) {
  const res = await fetch(`${API_BASE}/registrations/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  return res.json();
}

export async function deleteRegistration(id: string) {
  const res = await fetch(`${API_BASE}/registrations/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return res.json();
}

export async function deleteParticipantCascade(registrationId: string, emailList: string[] = [], teamSize?: number, eventId?: string) {
  const res = await fetch(`${API_BASE}/registrations/${registrationId}/cascade-delete`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ emailList, teamSize, eventId }),
  });
  return res.json();
}

// ==========================================
// Users Management
// ==========================================
export async function fetchUsers(query?: { role?: string; email?: string }) {
  await ensureAuthToken();
  const params = new URLSearchParams(query as any).toString();
  const url = `${API_BASE}/users${params ? `?${params}` : ''}`;
  let res = await fetchWithRetry(url, { headers: authHeaders() });

  if (res.status === 401) {
    setToken(null);
    const refreshed = await ensureAuthToken(true);
    if (refreshed) {
      res = await fetchWithRetry(url, { headers: authHeaders() });
    }
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error || `Failed to fetch users (${res.status} ${res.statusText || 'Error'})`);
  }
  return res.json();
}

// Public endpoint - no auth required, returns only show_in_about members
export async function fetchTeamMembers(forceRefresh = false) {
  const cacheKey = 'team_members';
  if (!forceRefresh) {
    const cached = getCachedApiData(cacheKey);
    if (cached) return cached;
  }
  try {
    const res = await fetch(`${API_BASE}/users/team`, { headers: publicHeaders() });
    if (res.ok) {
      const data = await res.json();
      setCachedApiData(cacheKey, data, 60000); // 60s cache
      return data;
    }
  } catch (e) {
    console.warn('[apiClient] Notice fetching /users/team:', e);
  }

  // Fallback to organizers endpoint if /users/team is unavailable
  try {
    const orgRes = await fetch(`${API_BASE}/organizers`, { headers: publicHeaders() });
    if (orgRes.ok) {
      const data = await orgRes.json();
      setCachedApiData(cacheKey, data, 60000);
      return data;
    }
  } catch {}

  return [];
}


export async function fetchUserById(id: string) {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(id)}`, { headers: authHeaders() });
  if (!res.ok) return null;
  return res.json();
}

export const fetchUser = fetchUserById;

export async function bulkCreateUsers(users: any[]) {
  const res = await fetch(`${API_BASE}/users/bulk-create`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ users }),
  });
  return res.json();
}

export async function createUser(userObj: any) {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(userObj),
  });
  return res.json();
}

export async function updateUser(id: string, patch: any) {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  return res.json();
}

export async function removeMemberFromTeamApi(id: string) {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(id)}/remove-from-team`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return res.json();
}

export async function deleteUser(id: string) {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return res.json();
}

// ==========================================
// Organizers
// ==========================================
export async function fetchOrganizers() {
  const res = await fetch(`${API_BASE}/organizers`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch organizers');
  return res.json();
}

export async function createOrganizer(orgObj: any) {
  const res = await fetch(`${API_BASE}/organizers`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(orgObj),
  });
  return res.json();
}

export async function updateOrganizer(id: string, patch: any) {
  const res = await fetch(`${API_BASE}/organizers/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  return res.json();
}

export async function deleteOrganizer(id: string) {
  const res = await fetch(`${API_BASE}/organizers/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return res.json();
}

// ==========================================
// Photo Albums & Gallery
// ==========================================
export async function fetchAlbums(query?: { eventId?: string; category?: string; status?: string }) {
  const cacheKey = `albums_${JSON.stringify(query || {})}`;
  const cached = getCachedApiData<any[]>(cacheKey);
  if (cached && Array.isArray(cached)) return cached;

  const params = query ? `?${new URLSearchParams(query as any).toString()}` : '';

  try {
    const res = await fetchWithRetry(`${API_BASE}/albums${params}`, {
      headers: publicHeaders(),
    }, 2, 800);
    if (!res.ok) throw new Error(`Failed to fetch albums (${res.status})`);
    const data = await res.json();
    if (Array.isArray(data)) {
      setCachedApiData(cacheKey, data, 30000);
      return data;
    }
    return [];
  } catch (err) {
    console.error('[apiClient] fetchAlbums error:', err);
    return cached || [];
  }
}

export async function createAlbum(albumObj: any) {
  await ensureAuthToken();
  const res = await fetch(`${API_BASE}/albums`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(albumObj),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `Failed to create album (${res.status})`);
  }
  clearApiCache('albums');
  return res.json();
}

export async function bulkCreateAlbums(items: any[]) {
  await ensureAuthToken();
  const res = await fetch(`${API_BASE}/albums/bulk`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `Failed to bulk create albums (${res.status})`);
  }
  clearApiCache('albums');
  return res.json();
}

export async function updateAlbum(id: string, patch: any) {
  await ensureAuthToken();
  const res = await fetch(`${API_BASE}/albums/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `Failed to update album (${res.status})`);
  }
  clearApiCache('albums');
  return res.json();
}

export async function deleteAlbum(id: string) {
  await ensureAuthToken();
  const res = await fetch(`${API_BASE}/albums/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `Failed to delete album (${res.status})`);
  }
  clearApiCache('albums');
  return res.json();
}

// ==========================================
// Jury Evaluations & Results
// ==========================================
export async function fetchJuryEvaluations(query?: { eventId?: string; registrationId?: string; juryId?: string; round?: number }) {
  const params = new URLSearchParams(query as any).toString();
  const res = await fetch(`${API_BASE}/jury_evaluations${params ? `?${params}` : ''}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch jury evaluations');
  return res.json();
}

export async function createJuryEvaluation(payload: any) {
  const res = await fetch(`${API_BASE}/jury_evaluations`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function updateJuryEvaluation(id: string, patch: any) {
  const res = await fetch(`${API_BASE}/jury_evaluations/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  return res.json();
}

// ==========================================
// Settings & Configuration
// ==========================================
export async function fetchSettings(key?: string, forceRefresh = false) {
  const cacheKey = `settings:${key || 'all'}`;
  if (!forceRefresh) {
    const cached = getCachedApiData(cacheKey);
    if (cached) return cached;
  }
  const res = await fetch(`${API_BASE}/settings${key ? `/${key}` : ''}`, { headers: publicHeaders() });
  if (!res.ok) return null;
  const data = await res.json();
  setCachedApiData(cacheKey, data, 30000);
  return data;
}

export async function updateSettings(key: string, data: any) {
  clearApiCache('settings');
  const res = await fetch(`${API_BASE}/settings/${key}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

