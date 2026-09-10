const API_BASE = ((import.meta.env.VITE_API_BASE as string) || 'http://localhost:4000/api').replace(/\/+$/, '');

// Retry helper for transient network/backend failures
async function fetchWithRetry(url: string, options: RequestInit, retries = 2, delayMs = 1000): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || res.status < 500) return res; // Don't retry client errors (4xx)
      if (attempt < retries) {
        console.warn(`[apiClient] Server error ${res.status} on ${url}, retrying (${attempt + 1}/${retries})...`);
        await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
      } else {
        return res;
      }
    } catch (err) {
      if (attempt < retries) {
        console.warn(`[apiClient] Network error on ${url}, retrying (${attempt + 1}/${retries})...`, (err as Error).message);
        await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Failed after ${retries} retries: ${url}`);
}
let TOKEN: string | null = null;

// Initialize token from localStorage if available
try {
  const savedToken = localStorage.getItem('aiverse_api_token');
  if (savedToken) TOKEN = savedToken;
} catch (e) {}

export function setToken(token: string | null) {
  TOKEN = token;
  if (token) {
    try {
      localStorage.setItem('aiverse_api_token', token);
    } catch (e) {}
  } else {
    try {
      localStorage.removeItem('aiverse_api_token');
    } catch (e) {}
  }
}

export function getToken() {
  return TOKEN;
}

function authHeaders(isJson = true) {
  const headers: Record<string, string> = {};
  if (isJson) headers['Content-Type'] = 'application/json';
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  return headers;
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
export async function uploadImage(fileOrBase64: File | Blob | string, folder = 'ai_verse'): Promise<{ url: string; public_id?: string; [key: string]: any }> {
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
  const res = await fetch(`${API_BASE}/quizzes/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch quiz');
  return res.json();
}

export async function fetchAllQuizzes(query?: { eventId?: string; status?: string }) {
  const params = new URLSearchParams(query as any).toString();
  const res = await fetch(`${API_BASE}/quizzes${params ? `?${params}` : ''}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch quizzes');
  return res.json();
}

export async function fetchQuizSubmissions(quizId: string) {
  const res = await fetch(`${API_BASE}/quizzes/${quizId}/submissions`, { headers: authHeaders() });
  if (!res.ok) return [];
  return res.json();
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
export async function fetchEvents(query?: { category?: string; track?: string; isLive?: boolean }) {
  const params = new URLSearchParams(query as any).toString();
  const res = await fetch(`${API_BASE}/events${params ? `?${params}` : ''}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
}

export async function fetchEventById(id: string) {
  const res = await fetch(`${API_BASE}/events/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch event');
  return res.json();
}

export async function createEvent(eventObj: any) {
  const res = await fetch(`${API_BASE}/events`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(eventObj),
  });
  return res.json();
}

export async function updateEvent(eventId: string, patch: any) {
  const res = await fetch(`${API_BASE}/events/${eventId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  return res.json();
}

export async function deleteEvent(eventId: string) {
  const res = await fetch(`${API_BASE}/events/${eventId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
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
  const res = await fetch(`${API_BASE}/registrations`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(regObj),
  });
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
  const params = new URLSearchParams(query as any).toString();
  const url = `${API_BASE}/users${params ? `?${params}` : ''}`;
  const res = await fetchWithRetry(url, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
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
  const res = await fetch(`${API_BASE}/users/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  return res.json();
}

export async function deleteUser(id: string) {
  const res = await fetch(`${API_BASE}/users/${id}`, {
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
export async function fetchAlbums() {
  const res = await fetch(`${API_BASE}/albums`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch albums');
  return res.json();
}

export async function createAlbum(albumObj: any) {
  const res = await fetch(`${API_BASE}/albums`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(albumObj),
  });
  return res.json();
}

export async function updateAlbum(id: string, patch: any) {
  const res = await fetch(`${API_BASE}/albums/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  return res.json();
}

export async function deleteAlbum(id: string) {
  const res = await fetch(`${API_BASE}/albums/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
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
export async function fetchSettings(key?: string) {
  const res = await fetch(`${API_BASE}/settings${key ? `/${key}` : ''}`, { headers: authHeaders() });
  if (!res.ok) return null;
  return res.json();
}

export async function updateSettings(key: string, data: any) {
  const res = await fetch(`${API_BASE}/settings/${key}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

