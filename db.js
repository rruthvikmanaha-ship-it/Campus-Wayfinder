// db.js - SQLite Database initialization using Node 22.5+ built-in node:sqlite
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const DB_PATH = path.join(__dirname, 'campus.db');
const db = new DatabaseSync(DB_PATH);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS timetable (
    id INTEGER PRIMARY KEY,
    date TEXT,
    day TEXT,
    startTime TEXT,
    endTime TEXT,
    subject TEXT,
    teacher TEXT,
    room TEXT,
    section TEXT
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY,
    text TEXT,
    author TEXT,
    date TEXT,
    recipient TEXT
  );

  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT,
    branch TEXT,
    section TEXT,
    semester TEXT,
    phone TEXT,
    email TEXT,
    dob TEXT,
    blood TEXT,
    guardian TEXT,
    guardianPhone TEXT,
    address TEXT,
    photo TEXT
  );

  CREATE TABLE IF NOT EXISTS faculty (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY,
    date TEXT,
    subject TEXT,
    section TEXT,
    teacher TEXT,
    present TEXT,
    absent TEXT
  );

  CREATE TABLE IF NOT EXISTS marks (
    id INTEGER PRIMARY KEY,
    teacher TEXT,
    section TEXT,
    subject TEXT,
    assessment TEXT,
    date TEXT,
    maxMarks REAL,
    scores TEXT
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY,
    owner TEXT,
    title TEXT,
    subject TEXT,
    section TEXT,
    due TEXT,
    desc TEXT
  );

  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY,
    subject TEXT,
    type TEXT,
    date TEXT,
    start TEXT,
    end TEXT,
    room TEXT,
    section TEXT
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    title TEXT,
    date TEXT,
    type TEXT,
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS leaves (
    id INTEGER PRIMARY KEY,
    usn TEXT,
    name TEXT,
    section TEXT,
    type TEXT,
    fromDate TEXT,
    toDate TEXT,
    reason TEXT,
    status TEXT,
    remark TEXT,
    applied TEXT
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY,
    usn TEXT,
    name TEXT,
    section TEXT,
    category TEXT,
    subject TEXT,
    message TEXT,
    status TEXT,
    reply TEXT,
    date TEXT
  );

  CREATE TABLE IF NOT EXISTS timetable_photos (
    section TEXT PRIMARY KEY,
    id INTEGER,
    title TEXT,
    image TEXT,
    publishedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS staff_profiles (
    role TEXT PRIMARY KEY,
    name TEXT,
    empId TEXT,
    department TEXT,
    designation TEXT,
    qualification TEXT,
    experience TEXT,
    phone TEXT,
    email TEXT,
    office TEXT,
    photo TEXT
  );

  CREATE TABLE IF NOT EXISTS hod_directory (
    dept TEXT PRIMARY KEY,
    name TEXT,
    empId TEXT,
    phone TEXT,
    email TEXT,
    photo TEXT
  );

  CREATE TABLE IF NOT EXISTS key_value_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

function getTodayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function getDayName(iso) {
  const date = new Date(iso + 'T00:00:00');
  return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
}

const today = getTodayISO();
const todayDay = getDayName(today);

// Seed default faculty
const facCount = db.prepare('SELECT COUNT(*) AS c FROM faculty').get().c;
if (facCount === 0) {
  const insertFac = db.prepare('INSERT OR IGNORE INTO faculty (name) VALUES (?)');
  ['Dr. Manjunath', 'Prof. Smitha', 'Prof. Rajesh', 'Faculty Name'].forEach(f => insertFac.run(f));
}

// Seed default subjects
const subCount = db.prepare('SELECT COUNT(*) AS c FROM subjects').get().c;
if (subCount === 0) {
  const insertSub = db.prepare('INSERT OR IGNORE INTO subjects (name) VALUES (?)');
  ['Python', 'Mathematics', 'Chemistry', 'Database Systems', 'AI Lab'].forEach(s => insertSub.run(s));
}

// Seed default timetable if empty
const ttCount = db.prepare('SELECT COUNT(*) AS c FROM timetable').get().c;
if (ttCount === 0) {
  const insertTt = db.prepare('INSERT INTO timetable (id, date, day, startTime, endTime, subject, teacher, room, section) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  [
    { id: 1, date: today, day: todayDay, startTime: "09:00", endTime: "10:00", subject: "Python", teacher: "Faculty Name", room: "103", section: "AIML-A" },
    { id: 2, date: today, day: todayDay, startTime: "10:00", endTime: "11:00", subject: "Mathematics", teacher: "Faculty Name", room: "205", section: "AIML-A" },
    { id: 3, date: today, day: todayDay, startTime: "11:15", endTime: "12:15", subject: "Chemistry", teacher: "Faculty Name", room: "Lab 2", section: "AIML-A" },
    { id: 4, date: today, day: todayDay, startTime: "14:00", endTime: "15:00", subject: "Database Systems", teacher: "Faculty Name", room: "204", section: "AIML-A" },
    { id: 5, date: today, day: todayDay, startTime: "15:15", endTime: "16:15", subject: "AI Lab", teacher: "Faculty Name", room: "Lab 1", section: "AIML-A" }
  ].forEach(t => insertTt.run(t.id, t.date, t.day, t.startTime, t.endTime, t.subject, t.teacher, t.room, t.section));
}

// Seed announcements if empty
const annCount = db.prepare('SELECT COUNT(*) AS c FROM announcements').get().c;
if (annCount === 0) {
  db.prepare('INSERT INTO announcements (id, text, author, date, recipient) VALUES (?, ?, ?, ?, ?)')
    .run(1, "Welcome to Alva's Campus Wayfinder. Live SQLite database synchronization is now active.", "Principal", today, "All Students");
}

module.exports = db;
