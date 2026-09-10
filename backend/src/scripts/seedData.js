require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

// Import Models
const User = require('../models/User');
const Event = require('../models/Event');
const Quiz = require('../models/Quiz');
const QuizSession = require('../models/QuizSession');
const QuizSubmission = require('../models/QuizSubmission');
const Registration = require('../models/Registration');
const Organizer = require('../models/Organizer');
const Album = require('../models/Album');
const Contact = require('../models/Contact');
const Attendance = require('../models/Attendance');

const defaultPassword = 'password123';
const now = Date.now();
const day = 24 * 60 * 60 * 1000;

async function seed() {
  console.log('🌱 Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB.');

  console.log('🧹 Cleaning up old demo data while preserving structure...');

  // 1. SEED USERS
  console.log('👤 Seeding Users with all role permissions...');
  const users = [
    {
      _id: 'admin_aiverse_in',
      uid: 'admin_aiverse_in',
      email: 'admin@aiverse.in',
      name: 'System Admin',
      display_name: 'System Admin',
      role: 'faculty',
      displayRole: 'Super Admin',
      position: 'Super Admin & Lead Architect',
      password: defaultPassword,
      status: 'Active',
      phone: '+919876543210',
      bio: 'Lead architect of AI Verse platform.',
      show_in_about: true,
      year: 'Faculty',
    },
    {
      _id: 'facultycoordinator_aiverse_in',
      uid: 'facultycoordinator_aiverse_in',
      email: 'facultycoordinator@aiverse.in',
      name: 'Dr. Sarah Mitchell',
      display_name: 'Dr. Sarah Mitchell',
      role: 'faculty',
      displayRole: 'Faculty Coordinator',
      position: 'Faculty Advisor & Head of AI Lab',
      password: defaultPassword,
      status: 'Active',
      phone: '+919876543211',
      bio: 'Faculty Coordinator overseeing student research and AI initiatives.',
      show_in_about: true,
      year: 'Faculty',
    },
    {
      _id: 'studentorganizer_aiverse_in',
      uid: 'studentorganizer_aiverse_in',
      email: 'studentorganizer@aiverse.in',
      name: 'Rahul Sharma',
      display_name: 'Rahul Sharma',
      role: 'organizer',
      displayRole: 'Student Organizer',
      position: 'President & Lead Organizer',
      password: defaultPassword,
      status: 'Active',
      phone: '+919876543212',
      bio: 'Leading the AI Verse student chapter with passion for community.',
      show_in_about: true,
      year: '4th Year CSE',
    },
    {
      _id: 'jury_aiverse_in',
      uid: 'jury_aiverse_in',
      email: 'jury@aiverse.in',
      name: 'Prof. Alan Turing',
      display_name: 'Prof. Alan Turing',
      role: 'jury',
      displayRole: 'Jury Evaluator',
      position: 'Senior Research Fellow & Jury Panelist',
      password: defaultPassword,
      status: 'Active',
      phone: '+919876543213',
      bio: 'Evaluating machine learning architecture and innovation scores.',
      show_in_about: false,
      year: 'Faculty',
    },
    {
      _id: 'participant_aiverse_in',
      uid: 'participant_aiverse_in',
      email: 'participant@aiverse.in',
      name: 'Alex Rivera',
      display_name: 'Alex Rivera',
      role: 'participant',
      displayRole: 'Participant',
      password: defaultPassword,
      status: 'Active',
      phone: '+919876543214',
      team_name: 'Team Alpha AI',
      event_title: 'Aetheria AI Hackathon 2026',
      registration_id: 'REG-2026-001',
      show_in_about: false,
      year: '3rd Year AI&DS',
    },
    {
      _id: 'alphaa_aiverse_in',
      uid: 'alphaa_aiverse_in',
      email: 'alphaa@aiverse.in',
      name: 'Priya Patel',
      display_name: 'Priya Patel',
      role: 'participant',
      displayRole: 'Participant',
      password: defaultPassword,
      status: 'Active',
      phone: '+919876543215',
      team_name: 'Neural Titans',
      event_title: 'Aetheria AI Hackathon 2026',
      registration_id: 'REG-2026-002',
      show_in_about: false,
      year: '3rd Year CSE',
    },
  ];

  for (const u of users) {
    await User.findByIdAndUpdate(u._id, { $set: { ...u, updatedAt: now } }, { upsert: true });
  }
  console.log(`✅ Seeded ${users.length} users.`);

  // 2. SEED EVENTS
  console.log('📅 Seeding Events...');
  const events = [
    {
      _id: 'event-hackathon-2026',
      title: 'Aetheria AI Hackathon 2026',
      description: 'The flagship 36-hour national AI hackathon where students build autonomous agent systems, multimodal pipelines, and intelligent workflows.',
      shortDescription: 'National 36-hour AI & Multimodal Agent Hackathon with 1 Lakh INR prize pool.',
      category: 'Hackathons',
      track: 'AI / Machine Learning',
      isLive: true,
      status: 'Open',
      date: 'March 28-29, 2026',
      time: '09:00 AM IST',
      venue: 'Main Auditorium & AI Innovation Center',
      location: 'Block III, Vishnu Institute of Technology, Bhimavaram',
      maxTeamSize: 4,
      minTeamSize: 2,
      maxReg: 150,
      currentReg: 28,
      coverImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
      bannerImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
      tags: ['Hackathon', 'Autonomous Agents', 'Computer Vision', 'Generative AI'],
      prizes: [
        { position: '1st Place', amount: '₹50,000 + Cloud Credits', desc: 'Grand Champion' },
        { position: '2nd Place', amount: '₹30,000 + Goodies', desc: 'Runner Up' },
        { position: '3rd Place', amount: '₹20,000 + Swag', desc: 'Second Runner Up' },
      ],
      rules: [
        'Teams must consist of 2 to 4 members.',
        'All code must be written during the hackathon timeframe.',
        'Pre-trained open source models are allowed; custom solutions must be unique.',
        'Jury decisions are final and binding.',
      ],
      coordinators: [
        { name: 'Rahul Sharma', phone: '+91 98765 43212', role: 'Student Lead' },
        { name: 'Dr. Sarah Mitchell', phone: '+91 98765 43211', role: 'Faculty Advisor' },
      ],
    },
    {
      _id: 'event-genai-masterclass',
      title: 'Generative AI & LLM Architecture Masterclass',
      description: 'An intensive hands-on workshop on training, fine-tuning, and deploying modern Large Language Models, LoRA adapters, and Retrieval Augmented Generation (RAG) pipelines.',
      shortDescription: 'Hands-on RAG, fine-tuning, and open-weights LLM deployment masterclass.',
      category: 'Workshops',
      track: 'Generative AI',
      isLive: true,
      status: 'Open',
      date: 'April 05, 2026',
      time: '10:00 AM - 04:30 PM IST',
      venue: 'Lab 402, AI Innovation Center',
      location: 'Vishnu Institute of Technology',
      maxTeamSize: 1,
      minTeamSize: 1,
      maxReg: 80,
      currentReg: 45,
      coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
      bannerImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
      tags: ['LLM', 'RAG', 'PyTorch', 'Transformers'],
      rules: [
        'Individual registration only.',
        'Laptops with minimum 8GB RAM recommended (Google Colab Pro GPU provided).',
      ],
    },
    {
      _id: 'event-prompt-battle',
      title: 'Prompt Engineering & Jailbreak Defense Battle 2.0',
      description: 'Real-time competitive arena where contestants optimize prompt tokens to extract exact target strings, bypass guarded LLMs, and craft defensive system prompts.',
      shortDescription: 'Live gamified prompt engineering and security championship.',
      category: 'Competitions',
      track: 'Prompt Engineering',
      isLive: false,
      status: 'Upcoming',
      date: 'April 18, 2026',
      time: '02:00 PM IST',
      venue: 'Online & Lab Arena',
      location: 'AI Verse Portal',
      maxTeamSize: 2,
      minTeamSize: 1,
      maxReg: 120,
      currentReg: 18,
      coverImage: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
      bannerImage: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
      tags: ['Security', 'Prompt Engineering', 'Adversarial AI'],
    },
    {
      _id: 'event-cv-symposium',
      title: 'Edge AI & Computer Vision Annual Symposium',
      description: 'Paper presentations, industry talks, and live robotics demonstrations focusing on embedded vision, YOLO models, and real-time spatial computing.',
      shortDescription: 'Keynotes, paper presentations, and robotics showcases.',
      category: 'Symposiums',
      track: 'Computer Vision',
      isLive: false,
      status: 'Open',
      date: 'April 25, 2026',
      time: '09:30 AM IST',
      venue: 'Seminar Hall 1',
      location: 'Vishnu Institute of Technology',
      maxTeamSize: 3,
      minTeamSize: 1,
      maxReg: 200,
      currentReg: 62,
      coverImage: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80',
      bannerImage: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80',
      tags: ['Computer Vision', 'Edge AI', 'Robotics'],
    },
  ];

  for (const e of events) {
    await Event.findByIdAndUpdate(e._id, { $set: { ...e, updatedAt: now } }, { upsert: true });
  }
  console.log(`✅ Seeded ${events.length} events.`);

  // 3. SEED QUIZZES
  console.log('🧠 Seeding Interactive Quizzes...');
  const quizzes = [
    {
      _id: 'quiz-ai-verse-core-2026',
      title: 'AI Verse Core Assessment: LLMs & Modern AI Architecture',
      description: 'Test your understanding of transformers, multi-head self-attention, vector embeddings, and retrieval-augmented generation.',
      category: 'AI Assessment',
      track: 'Generative AI',
      eventId: 'event-hackathon-2026',
      eventTitle: 'Aetheria AI Hackathon 2026',
      status: 'active',
      isLive: true,
      durationMinutes: 20,
      totalMarks: 30,
      pointsPerQuestion: 2,
      questionsCount: 5,
      questions: [
        {
          id: 'q1',
          question: 'What is the primary computational complexity bottleneck in standard dense multi-head self-attention as sequence length N grows?',
          options: [
            'O(N) linear in sequence length',
            'O(N^2) quadratic with respect to sequence length',
            'O(log N) logarithmic in token dimension',
            'O(N^3) cubic memory allocation',
          ],
          correctAnswer: 'O(N^2) quadratic with respect to sequence length',
          explanation: 'Standard self-attention computes an N x N attention matrix between all pairs of query and key tokens, resulting in O(N^2) time and memory complexity.',
          points: 2,
        },
        {
          id: 'q2',
          question: 'In Retrieval-Augmented Generation (RAG), what technique is commonly used to resolve semantic mismatch between user queries and stored chunk embeddings?',
          options: [
            'Hypothetical Document Embeddings (HyDE) / Query Rewriting',
            'Applying ReLU activation to token weights',
            'Truncating vectors to 8 bits without index',
            'Random shuffling of database vectors',
          ],
          correctAnswer: 'Hypothetical Document Embeddings (HyDE) / Query Rewriting',
          explanation: 'HyDE generates a hypothetical answer and embeds it, or rewrites the query into document-style language to better match stored chunks in vector space.',
          points: 2,
        },
        {
          id: 'q3',
          question: 'What is the key mechanism behind LoRA (Low-Rank Adaptation) parameter-efficient fine-tuning?',
          options: [
            'Freezing base weights and adding low-rank decomposition matrices A and B (W = W0 + B*A)',
            'Pruning 90% of attention heads during backpropagation',
            'Quantizing model weights to 1-bit binary numbers only',
            'Doubling the layer count of the feed-forward network',
          ],
          correctAnswer: 'Freezing base weights and adding low-rank decomposition matrices A and B (W = W0 + B*A)',
          explanation: 'LoRA decomposes weight updates into product of two low-rank matrices (d x r and r x k, where r << d), drastically reducing trainable parameters.',
          points: 2,
        },
        {
          id: 'q4',
          question: 'Which positional embedding approach uses continuous rotary transformations applied directly to queries and keys in attention layers?',
          options: [
            'ALiBi (Attention with Linear Biases)',
            'RoPE (Rotary Position Embedding)',
            'Sinusoidal absolute position encodings',
            'Learnable absolute 1D lookup tables',
          ],
          correctAnswer: 'RoPE (Rotary Position Embedding)',
          explanation: 'RoPE rotates queries and keys in 2D complex sub-planes, allowing relative positional information to decay smoothly over long context windows.',
          points: 2,
        },
        {
          id: 'q5',
          question: 'Which decoding strategy helps prevent repetitive degenerate loops in open-ended LLM text generation while maintaining coherence?',
          options: [
            'Greedy ArgMax Search with temperature 0.0',
            'Nucleus (Top-p) sampling combined with Repetition Penalty',
            'Pure Uniform Random Selection',
            'Fixed Top-1 beam search without length normalization',
          ],
          correctAnswer: 'Nucleus (Top-p) sampling combined with Repetition Penalty',
          explanation: 'Top-p sampling dynamically cuts off the low-probability tail of tokens while frequency/presence penalties suppress verbatim repetition.',
          points: 2,
        },
      ],
    },
  ];

  for (const q of quizzes) {
    await Quiz.findByIdAndUpdate(q._id, { $set: { ...q, updatedAt: now } }, { upsert: true });
  }
  console.log(`✅ Seeded ${quizzes.length} quizzes.`);

  // 4. SEED ORGANIZERS
  console.log('👥 Seeding Organizers...');
  const organizers = [
    {
      _id: 'org-rahul-sharma',
      name: 'Rahul Sharma',
      role: 'President & Lead Organizer',
      category: 'Core Team',
      email: 'studentorganizer@aiverse.in',
      phone: '+91 98765 43212',
      linkedin: 'https://linkedin.com/in/rahulsharma',
      github: 'https://github.com/rahulsharma',
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      bio: 'Leading hackathons and AI workshops at Vishnu Institute of Technology.',
      order: 1,
    },
    {
      _id: 'org-sarah-mitchell',
      name: 'Dr. Sarah Mitchell',
      role: 'Faculty Advisor',
      category: 'Faculty',
      email: 'facultycoordinator@aiverse.in',
      phone: '+91 98765 43211',
      linkedin: 'https://linkedin.com/in/sarahmitchell',
      image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
      bio: 'Professor & AI Lab Incharge at Vishnu Institute of Technology.',
      order: 2,
    },
  ];

  for (const o of organizers) {
    await Organizer.findByIdAndUpdate(o._id, { $set: { ...o, updatedAt: now } }, { upsert: true });
  }
  console.log(`✅ Seeded ${organizers.length} organizers.`);

  // 5. SEED ALBUMS
  console.log('📸 Seeding Gallery Albums...');
  const albums = [
    {
      _id: 'album-hackathon-2025',
      title: 'AI Grand Hackathon 2025 Highlights',
      description: 'Memorable moments from the 36-hour code sprint, demo presentations, and award ceremony.',
      category: 'Hackathons',
      date: 'November 2025',
      status: 'Published',
      photosCount: 6,
      coverImage: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80',
      bannerImage: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80',
      images: [
        { url: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80', caption: 'Teams coding through the night' },
        { url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80', caption: 'Jury project evaluation' },
        { url: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80', caption: 'Award celebration' },
      ],
      order: 1,
    },
    {
      _id: 'album-workshop-2025',
      title: 'Deep Learning & Neural Labs Workshop',
      description: 'Hands-on practical training with GPU clusters and PyTorch tensors.',
      category: 'Workshops',
      date: 'December 2025',
      status: 'Published',
      photosCount: 4,
      coverImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
      bannerImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
      images: [
        { url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80', caption: 'Lab demonstration' },
        { url: 'https://images.unsplash.com/photo-1531497865144-0464ef8fb9a9?auto=format&fit=crop&w=1200&q=80', caption: 'Interactive Q&A' },
      ],
      order: 2,
    },
  ];

  for (const a of albums) {
    await Album.findByIdAndUpdate(a._id, { $set: { ...a, updatedAt: now } }, { upsert: true });
  }
  console.log(`✅ Seeded ${albums.length} gallery albums.`);

  // Drop problematic index if exists on registrations
  try {
    await mongoose.connection.collection('registrations').dropIndex('ticketCode_1');
  } catch (e) {}

  // 6. SEED REGISTRATIONS & ATTENDANCE
  console.log('🎟️ Seeding Registrations & Attendance...');
  const registrations = [
    {
      _id: 'REG-2026-001',
      ticketCode: 'TICKET-AETH-001',
      eventId: 'event-hackathon-2026',
      eventTitle: 'Aetheria AI Hackathon 2026',
      groupName: 'Team Alpha AI',
      teamName: 'Team Alpha AI',
      teamSize: 3,
      teamLeadName: 'Alex Rivera',
      teamLeadEmail: 'participant@aiverse.in',
      email: 'participant@aiverse.in',
      leadPhone: '+919876543214',
      phoneNumber: '+919876543214',
      phone: '+919876543214',
      college: 'Vishnu Institute of Technology',
      year: '3rd Year',
      branch: 'AI & Data Science',
      status: 'Confirmed',
      paymentStatus: 'Free',
      accessGranted: true,
      loginAccessGranted: true,
      attendanceMarked: true,
      attendanceStatus: 'Present',
      checkedInAt: now - 3600000,
      members: [
        { name: 'Alex Rivera', email: 'participant@aiverse.in', phone: '+919876543214', role: 'Team Lead' },
        { name: 'Sam Chen', email: 'sam@aiverse.in', phone: '+919876543216', role: 'Full Stack Dev' },
        { name: 'Maya Rao', email: 'maya@aiverse.in', phone: '+919876543217', role: 'ML Engineer' },
      ],
    },
    {
      _id: 'REG-2026-002',
      ticketCode: 'TICKET-AETH-002',
      eventId: 'event-hackathon-2026',
      eventTitle: 'Aetheria AI Hackathon 2026',
      groupName: 'Neural Titans',
      teamName: 'Neural Titans',
      teamSize: 2,
      teamLeadName: 'Priya Patel',
      teamLeadEmail: 'alphaa@aiverse.in',
      email: 'alphaa@aiverse.in',
      leadPhone: '+919876543215',
      phoneNumber: '+919876543215',
      phone: '+919876543215',
      college: 'Vishnu Institute of Technology',
      year: '3rd Year',
      branch: 'Computer Science',
      status: 'Confirmed',
      paymentStatus: 'Free',
      accessGranted: true,
      loginAccessGranted: true,
      attendanceMarked: true,
      attendanceStatus: 'Present',
      checkedInAt: now - 1800000,
      members: [
        { name: 'Priya Patel', email: 'alphaa@aiverse.in', phone: '+919876543215', role: 'Team Lead' },
        { name: 'Kiran Kumar', email: 'kiran@aiverse.in', phone: '+919876543218', role: 'Frontend Dev' },
      ],
    },
  ];

  for (const r of registrations) {
    await Registration.findByIdAndUpdate(r._id, { $set: { ...r, updatedAt: now } }, { upsert: true });

    // Mark attendance record
    const attId = `${r.eventId}_${r._id}`;
    await Attendance.findByIdAndUpdate(
      attId,
      {
        $set: {
          _id: attId,
          eventId: r.eventId,
          eventTitle: r.eventTitle,
          registrationId: r._id,
          userEmail: r.email,
          userName: r.teamLeadName,
          teamName: r.teamName,
          status: 'Present',
          checkInTime: r.checkedInAt || now,
          markedBy: 'Dr. Sarah Mitchell',
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
  }
  console.log(`✅ Seeded ${registrations.length} registrations & attendance records.`);

  // 7. SEED CONTACT INQUIRIES
  console.log('💬 Seeding Contact Inquiries...');
  const contacts = [
    {
      _id: 'contact-demo-1',
      name: 'Rohan Sharma',
      email: 'rohan.sharma@gmail.com',
      subject: 'Query regarding Aetheria AI Hackathon Hardware Requirements',
      message: 'Hi team, do we need to bring our own edge devices (like Raspberry Pi / Jetson Nano) for the Computer Vision track, or will hardware be provided in the lab?',
      status: 'New',
      createdAt: now - 7200000,
      updatedAt: now - 7200000,
    },
    {
      _id: 'contact-demo-2',
      name: 'Ananya Deshmukh',
      email: 'ananya.deshmukh@gmail.com',
      subject: 'Joining AI Verse Student Volunteer Committee',
      message: 'Hello! I am a second year student enthusiastic about AI and community building. How can I apply for the organizer/volunteer committee for upcoming events?',
      status: 'In Progress',
      notes: 'Invited for interview next Monday at Lab 402.',
      createdAt: now - 18000000,
      updatedAt: now - 3600000,
    },
  ];

  for (const c of contacts) {
    await Contact.findByIdAndUpdate(c._id, { $set: { ...c, updatedAt: now } }, { upsert: true });
  }
  console.log(`✅ Seeded ${contacts.length} contact inquiries.`);

  console.log('====================================================');
  console.log('🎉 AI VERSE DATABASE SEEDING COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
  console.log('Credentials Summary:');
  console.log('👑 Super Admin:          admin@aiverse.in           / password123');
  console.log('🎓 Faculty Coordinator:   facultycoordinator@aiverse.in / password123');
  console.log('⚡ Student Organizer:     studentorganizer@aiverse.in   / password123');
  console.log('⚖️ Jury Evaluator:       jury@aiverse.in            / password123');
  console.log('🚀 Participant:           participant@aiverse.in     / password123 (or phone 9876543214)');
  console.log('🚀 Team Participant:      alphaa@aiverse.in          / password123 (or phone 9876543215)');
  console.log('====================================================');

  await mongoose.connection.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeding error:', err);
  process.exit(1);
});
