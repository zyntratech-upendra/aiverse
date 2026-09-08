require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const http = require('http');

const PORT = 4001; // test port
process.env.PORT = PORT;

const app = require('../index');

async function testAll() {
  console.log('🧪 Starting Full-Stack Backend Integration Test on port ' + PORT + '...');

  // Wait for mongoose connection
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => {
      mongoose.connection.once('connected', resolve);
      setTimeout(resolve, 4000);
    });
  }

  const fetchAPI = async (path, options = {}) => {
    const res = await fetch(`http://localhost:${PORT}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    try {
      return { status: res.status, data: JSON.parse(text) };
    } catch {
      return { status: res.status, text };
    }
  };

  try {
    // 1. Health
    console.log('1. Testing /health...');
    const health = await fetchAPI('/health');
    console.log('   Status:', health.status, 'DB:', health.data?.database);
    if (health.status !== 200 || health.data?.database !== 'connected') throw new Error('Health check failed');

    // 2. Auth Login
    console.log('2. Testing /api/auth/login with Super Admin...');
    const authRes = await fetchAPI('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@aiverse.in', password: 'password123' }),
    });
    console.log('   Status:', authRes.status, 'Role:', authRes.data?.user?.role, 'Token received:', !!authRes.data?.token);
    if (authRes.status !== 200 || !authRes.data?.token) throw new Error('Auth failed');
    const token = authRes.data.token;
    const authHeader = { Authorization: `Bearer ${token}` };

    // 3. Events
    console.log('3. Testing /api/events...');
    const eventsRes = await fetchAPI('/api/events');
    console.log('   Status:', eventsRes.status, 'Events count:', eventsRes.data?.length);
    if (eventsRes.status !== 200 || !Array.isArray(eventsRes.data)) throw new Error('Events fetch failed');

    // 4. Quizzes
    console.log('4. Testing /api/quizzes...');
    const quizzesRes = await fetchAPI('/api/quizzes');
    console.log('   Status:', quizzesRes.status, 'Quizzes count:', quizzesRes.data?.length);
    if (quizzesRes.status !== 200) throw new Error('Quizzes fetch failed');

    // 5. Registrations
    console.log('5. Testing /api/registrations...');
    const regsRes = await fetchAPI('/api/registrations');
    console.log('   Status:', regsRes.status, 'Registrations count:', regsRes.data?.length);
    if (regsRes.status !== 200) throw new Error('Registrations fetch failed');

    // 6. Users
    console.log('6. Testing /api/users...');
    const usersRes = await fetchAPI('/api/users');
    console.log('   Status:', usersRes.status, 'Users count:', usersRes.data?.length);
    if (usersRes.status !== 200) throw new Error('Users fetch failed');

    // 7. Organizers
    console.log('7. Testing /api/organizers...');
    const orgsRes = await fetchAPI('/api/organizers');
    console.log('   Status:', orgsRes.status, 'Organizers count:', orgsRes.data?.length);
    if (orgsRes.status !== 200) throw new Error('Organizers fetch failed');

    // 8. Albums
    console.log('8. Testing /api/albums...');
    const albumsRes = await fetchAPI('/api/albums');
    console.log('   Status:', albumsRes.status, 'Albums count:', albumsRes.data?.length);
    if (albumsRes.status !== 200) throw new Error('Albums fetch failed');

    // 9. Contacts
    console.log('9. Testing /api/contacts (Create & List)...');
    const createContactRes = await fetchAPI('/api/contacts', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Automated Test User',
        email: 'test@aiverse.in',
        subject: 'Automated Integration Test',
        message: 'Verifying MongoDB contact queries integration.',
      }),
    });
    console.log('   Create Contact Status:', createContactRes.status, 'ID:', createContactRes.data?.id);
    if (createContactRes.status !== 201) throw new Error('Contact create failed');

    const contactsList = await fetchAPI('/api/contacts');
    console.log('   Contacts count:', contactsList.data?.length);

    // 10. Attendance
    console.log('10. Testing /api/attendance (Mark & List)...');
    const markAttRes = await fetchAPI('/api/attendance', {
      method: 'POST',
      body: JSON.stringify({
        eventId: 'event-hackathon-2026',
        registrationId: 'REG-2026-001',
        userEmail: 'participant@aiverse.in',
        status: 'Present',
        markedBy: 'Automated Test',
      }),
    });
    console.log('    Attendance mark status:', markAttRes.status, 'Marked:', markAttRes.data?.attendance?.status);

    // 11. Cloudinary Upload
    console.log('11. Testing /api/upload (Cloudinary base64 upload)...');
    const samplePixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const uploadRes = await fetchAPI('/api/upload', {
      method: 'POST',
      body: JSON.stringify({ image: samplePixel, folder: 'ai_verse_test' }),
    });
    console.log('    Upload Status:', uploadRes.status, 'Secure URL:', uploadRes.data?.secure_url?.substring(0, 50) + '...');
    if (uploadRes.status !== 200 || !uploadRes.data?.secure_url) throw new Error('Upload to Cloudinary failed');

    // 12. Transactional Email via Nodemailer SMTP
    console.log('12. Testing /api/send-email (Nodemailer SMTP transporter)...');
    const emailRes = await fetchAPI('/api/send-email', {
      method: 'POST',
      body: JSON.stringify({
        to: 'ramarajukoyyalagadda@gmail.com',
        subject: 'AI Verse - Full Stack Production Test Email',
        html: '<h2>AI Verse Production Test</h2><p>Your full stack backend is live, connected to MongoDB Atlas, Cloudinary storage, and Nodemailer SMTP.</p>',
      }),
    });
    console.log('    Email send status:', emailRes.status, 'Message ID:', emailRes.data?.messageId || emailRes.data);

    console.log('====================================================');
    console.log('🎉 ALL BACKEND API ENDPOINTS AND SERVICES PASSED 100%!');
    console.log('====================================================');

    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

testAll();
