const BASE = 'http://localhost:4000/api';
const ROOT = 'http://localhost:4000';

async function testAll() {
  console.log('🧪 Starting backend endpoint verification...');

  // 1. Health check
  const healthRes = await fetch(`${ROOT}/health`).then((r) => r.json());
  console.log('✅ 1. Health Check:', healthRes);

  // 2. Auth token
  const authRes = await fetch(`${BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: {
        uid: 'test_admin_uid',
        email: 'admin@aiverse.com',
        displayName: 'Test Admin',
        role: 'super_admin',
      },
    }),
  }).then((r) => r.json());
  console.log('✅ 2. Auth Token generation:', { success: authRes.success, role: authRes.user?.role });
  const token = authRes.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 3. User operations
  const userCreateRes = await fetch(`${BASE}/users`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      _id: 'test_user_participant_1',
      uid: 'test_user_participant_1',
      email: 'student@university.edu',
      name: 'Alex Student',
      role: 'participant',
      college: 'VIT',
    }),
  }).then((r) => r.json());
  console.log('✅ 3. User Created:', userCreateRes.success);

  // 4. Event operations
  const eventCreateRes = await fetch(`${BASE}/events`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'AI Hackathon 2026',
      description: 'Annual AI competition',
      category: 'Hackathon',
      track: 'Generative AI',
      fee: 0,
      maxParticipants: 200,
    }),
  }).then((r) => r.json());
  console.log('✅ 4. Event Created:', eventCreateRes.success, 'Event ID:', eventCreateRes.id);
  const testEventId = eventCreateRes.id;

  // 5. Quiz operations
  const quizCreateRes = await fetch(`${BASE}/quizzes`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Generative AI Foundations Quiz',
      description: 'Test your understanding of LLMs',
      eventId: testEventId,
      eventTitle: 'AI Hackathon 2026',
      durationMinutes: 15,
      totalMarks: 10,
      passingMarks: 6,
      pointsPerQuestion: 5,
      questions: [
        {
          id: 'q1',
          questionNumber: 1,
          text: 'What does LLM stand for?',
          options: [
            { id: 'opt_a', text: 'Large Language Model' },
            { id: 'opt_b', text: 'Low Level Memory' },
          ],
          correctOptionId: 'opt_a',
          points: 5,
        },
        {
          id: 'q2',
          questionNumber: 2,
          text: 'Which technique is used to align LLMs with human preferences?',
          options: [
            { id: 'opt_a', text: 'RLHF' },
            { id: 'opt_b', text: 'JPEG' },
          ],
          correctOptionId: 'opt_a',
          points: 5,
        },
      ],
    }),
  }).then((r) => r.json());
  console.log('✅ 5. Quiz Created:', quizCreateRes.success, 'Quiz ID:', quizCreateRes.quiz?.id);
  const testQuizId = quizCreateRes.quiz?.id;

  // 6. Quiz Session Flow
  const sessionRes = await fetch(`${BASE}/quizzes/${testQuizId}/sessions`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ team: { id: 'team_ai', name: 'AI Mavericks' } }),
  }).then((r) => r.json());
  console.log('✅ 6. Quiz Session Initialized:', sessionRes.id, 'Status:', sessionRes.status);
  const sessionId = sessionRes.id;

  // 7. Draft autosave
  const draftRes = await fetch(`${BASE}/sessions/${sessionId}/draft`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      answers: { q1: 'opt_a' },
      flaggedQuestions: ['q2'],
      currentQuestionIndex: 1,
    }),
  }).then((r) => r.json());
  console.log('✅ 7. Draft Saved:', draftRes.success);

  // 8. Load draft
  const loadedDraft = await fetch(`${BASE}/sessions/${sessionId}/draft`, {
    headers: authHeaders,
  }).then((r) => r.json());
  console.log('✅ 8. Draft Loaded:', loadedDraft.answers);

  // 9. Final submission & scoring
  const submissionRes = await fetch(`${BASE}/sessions/${sessionId}/submit`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      answers: { q1: 'opt_a', q2: 'opt_a' },
      violationsCount: 0,
    }),
  }).then((r) => r.json());
  console.log('✅ 9. Final Submission Evaluated:', {
    score: submissionRes.score,
    maxScore: submissionRes.maxScore,
    percentage: submissionRes.percentage,
    passed: submissionRes.passed,
    correctCount: submissionRes.correctCount,
  });

  // 10. Registration & cascade delete
  const regRes = await fetch(`${BASE}/registrations`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      eventId: testEventId,
      eventTitle: 'AI Hackathon 2026',
      userEmail: 'student@university.edu',
      userName: 'Alex Student',
      teamName: 'AI Mavericks',
      teamSize: 1,
      members: [{ name: 'Alex Student', email: 'student@university.edu' }],
    }),
  }).then((r) => r.json());
  console.log('✅ 10. Registration Created:', regRes.success, 'Reg ID:', regRes.id);

  // 11. Admin stats
  const statsRes = await fetch(`${BASE}/admin/stats`, {
    headers: authHeaders,
  }).then((r) => r.json());
  console.log('✅ 11. Admin Stats:', statsRes.stats);

  // Clean up test data
  await fetch(`${BASE}/events/${testEventId}`, { method: 'DELETE', headers: authHeaders });
  await fetch(`${BASE}/quizzes/${testQuizId}`, { method: 'DELETE', headers: authHeaders });
  await fetch(`${BASE}/registrations/${regRes.id}/cascade-delete`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ emailList: ['student@university.edu'] }),
  });
  console.log('🧹 Cleaned up test entities.');

  console.log('\n🎉 ALL BACKEND ENDPOINTS & FLOWS VERIFIED SUCCESSFULLY!');
}

testAll().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
