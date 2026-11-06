// server.js - Alva's Campus Wayfinder SQLite Backend
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db.js');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) { // 25MB limit for photos/base64
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { ok: false, error: message });
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  try {
    // -------------------------------------------------------------
    // REST API ROUTES
    // -------------------------------------------------------------

    // Status check
    if (pathname === '/api/status' && method === 'GET') {
      return sendJson(res, 200, { ok: true, version: '1.0.0', db: 'SQLite (node:sqlite)', port: PORT });
    }

    // Full state dump (fast single fetch on client load)
    if (pathname === '/api/all' && method === 'GET') {
      const timetable = db.prepare('SELECT * FROM timetable ORDER BY date ASC, startTime ASC').all();
      const announcements = db.prepare('SELECT * FROM announcements ORDER BY id DESC').all();
      const students = db.prepare('SELECT * FROM students ORDER BY name ASC').all();
      const faculty = db.prepare('SELECT name FROM faculty ORDER BY name ASC').all().map(r => r.name);
      const subjects = db.prepare('SELECT name FROM subjects ORDER BY name ASC').all().map(r => r.name);
      const attendance = db.prepare('SELECT * FROM attendance ORDER BY id DESC').all().map(r => ({
        ...r,
        present: r.present ? JSON.parse(r.present) : [],
        absent: r.absent ? JSON.parse(r.absent) : []
      }));
      const marks = db.prepare('SELECT * FROM marks ORDER BY date DESC').all().map(r => ({
        ...r,
        scores: r.scores ? JSON.parse(r.scores) : {}
      }));
      const assignments = db.prepare('SELECT * FROM assignments ORDER BY due ASC').all();
      const exams = db.prepare('SELECT * FROM exams ORDER BY date ASC').all();
      const events = db.prepare('SELECT * FROM events ORDER BY date ASC').all();
      const leaves = db.prepare('SELECT * FROM leaves ORDER BY id DESC').all();
      const tickets = db.prepare('SELECT * FROM tickets ORDER BY id DESC').all();

      const photosRows = db.prepare('SELECT * FROM timetable_photos').all();
      const timetablePhotos = {};
      photosRows.forEach(p => { timetablePhotos[p.section] = p; });

      const staffRows = db.prepare('SELECT * FROM staff_profiles').all();
      const staffProfiles = {};
      staffRows.forEach(s => { staffProfiles[s.role] = s; });

      const hodDirectory = db.prepare('SELECT * FROM hod_directory').all();

      const settingRows = db.prepare('SELECT key, value FROM key_value_settings').all();
      const settings = {};
      settingRows.forEach(s => { settings[s.key] = s.value; });

      return sendJson(res, 200, {
        ok: true,
        data: {
          timetable,
          announcements,
          students,
          faculty,
          subjects,
          attendance,
          marks,
          assignments,
          exams,
          events,
          leaves,
          tickets,
          timetablePhotos,
          staffProfiles,
          hodDirectory,
          settings
        }
      });
    }

    // 1. Timetable
    if (pathname === '/api/timetable') {
      if (method === 'GET') {
        const rows = db.prepare('SELECT * FROM timetable ORDER BY date ASC, startTime ASC').all();
        return sendJson(res, 200, { ok: true, data: rows });
      }
      if (method === 'POST') {
        const entry = await parseJsonBody(req);
        if (Array.isArray(entry)) {
          // Bulk sync
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO timetable (id, date, day, startTime, endTime, subject, teacher, room, section)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          entry.forEach(e => stmt.run(e.id || Date.now(), e.date, e.day, e.startTime, e.endTime, e.subject, e.teacher, e.room, e.section));
          return sendJson(res, 200, { ok: true, count: entry.length });
        }
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO timetable (id, date, day, startTime, endTime, subject, teacher, room, section)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const id = entry.id || Date.now();
        stmt.run(id, entry.date, entry.day, entry.startTime, entry.endTime, entry.subject, entry.teacher, entry.room, entry.section);
        return sendJson(res, 200, { ok: true, id });
      }
    }
    if (pathname.startsWith('/api/timetable/') && method === 'DELETE') {
      const id = Number(pathname.split('/').pop());
      db.prepare('DELETE FROM timetable WHERE id = ?').run(id);
      return sendJson(res, 200, { ok: true, id });
    }

    // 2. Announcements
    if (pathname === '/api/announcements') {
      if (method === 'GET') {
        const rows = db.prepare('SELECT * FROM announcements ORDER BY id DESC').all();
        return sendJson(res, 200, { ok: true, data: rows });
      }
      if (method === 'POST') {
        const item = await parseJsonBody(req);
        if (Array.isArray(item)) {
          const stmt = db.prepare('INSERT OR REPLACE INTO announcements (id, text, author, date, recipient) VALUES (?, ?, ?, ?, ?)');
          item.forEach(a => stmt.run(a.id || Date.now(), a.text, a.author, a.date, a.recipient || ''));
          return sendJson(res, 200, { ok: true, count: item.length });
        }
        const id = item.id || Date.now();
        db.prepare('INSERT OR REPLACE INTO announcements (id, text, author, date, recipient) VALUES (?, ?, ?, ?, ?)')
          .run(id, item.text, item.author || 'HOD', item.date, item.recipient || '');
        return sendJson(res, 200, { ok: true, id });
      }
    }
    if (pathname.startsWith('/api/announcements/') && method === 'DELETE') {
      const id = Number(pathname.split('/').pop());
      db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
      return sendJson(res, 200, { ok: true, id });
    }

    // 3. Students
    if (pathname === '/api/students') {
      if (method === 'GET') {
        const rows = db.prepare('SELECT * FROM students ORDER BY name ASC').all();
        return sendJson(res, 200, { ok: true, data: rows });
      }
      if (method === 'POST') {
        const s = await parseJsonBody(req);
        if (Array.isArray(s)) {
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO students (id, name, branch, section, semester, phone, email, dob, blood, guardian, guardianPhone, address, photo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          s.forEach(stu => stmt.run(stu.id || stu.usn, stu.name, stu.branch || '', stu.section || '', stu.semester || '', stu.phone || '', stu.email || '', stu.dob || '', stu.blood || '', stu.guardian || '', stu.guardianPhone || '', stu.address || '', stu.photo || ''));
          return sendJson(res, 200, { ok: true, count: s.length });
        }
        const id = s.id || s.usn;
        db.prepare(`
          INSERT OR REPLACE INTO students (id, name, branch, section, semester, phone, email, dob, blood, guardian, guardianPhone, address, photo)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, s.name, s.branch || '', s.section || '', s.semester || '', s.phone || '', s.email || '', s.dob || '', s.blood || '', s.guardian || '', s.guardianPhone || '', s.address || '', s.photo || '');
        return sendJson(res, 200, { ok: true, id });
      }
    }
    if (pathname.startsWith('/api/students/') && method === 'DELETE') {
      const id = decodeURIComponent(pathname.split('/').pop());
      db.prepare('DELETE FROM students WHERE id = ?').run(id);
      return sendJson(res, 200, { ok: true, id });
    }

    // 4. Attendance
    if (pathname === '/api/attendance') {
      if (method === 'GET') {
        const rows = db.prepare('SELECT * FROM attendance ORDER BY id DESC').all().map(r => ({
          ...r,
          present: r.present ? JSON.parse(r.present) : [],
          absent: r.absent ? JSON.parse(r.absent) : []
        }));
        return sendJson(res, 200, { ok: true, data: rows });
      }
      if (method === 'POST') {
        const item = await parseJsonBody(req);
        if (Array.isArray(item)) {
          const stmt = db.prepare('INSERT OR REPLACE INTO attendance (id, date, subject, section, teacher, present, absent) VALUES (?, ?, ?, ?, ?, ?, ?)');
          item.forEach(a => stmt.run(a.id || Date.now(), a.date, a.subject, a.section, a.teacher || '', JSON.stringify(a.present || []), JSON.stringify(a.absent || [])));
          return sendJson(res, 200, { ok: true, count: item.length });
        }
        const id = item.id || Date.now();
        db.prepare('INSERT OR REPLACE INTO attendance (id, date, subject, section, teacher, present, absent) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(id, item.date, item.subject, item.section, item.teacher || '', JSON.stringify(item.present || []), JSON.stringify(item.absent || []));
        return sendJson(res, 200, { ok: true, id });
      }
    }
    if (pathname.startsWith('/api/attendance/') && method === 'DELETE') {
      const id = Number(pathname.split('/').pop());
      db.prepare('DELETE FROM attendance WHERE id = ?').run(id);
      return sendJson(res, 200, { ok: true, id });
    }

    // 5. Marks
    if (pathname === '/api/marks') {
      if (method === 'GET') {
        const rows = db.prepare('SELECT * FROM marks ORDER BY date DESC').all().map(r => ({
          ...r,
          scores: r.scores ? JSON.parse(r.scores) : {}
        }));
        return sendJson(res, 200, { ok: true, data: rows });
      }
      if (method === 'POST') {
        const item = await parseJsonBody(req);
        if (Array.isArray(item)) {
          const stmt = db.prepare('INSERT OR REPLACE INTO marks (id, teacher, section, subject, assessment, date, maxMarks, scores) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
          item.forEach(m => stmt.run(m.id || Date.now(), m.teacher, m.section, m.subject, m.assessment, m.date, m.maxMarks || 100, JSON.stringify(m.scores || {})));
          return sendJson(res, 200, { ok: true, count: item.length });
        }
        const id = item.id || Date.now();
        db.prepare('INSERT OR REPLACE INTO marks (id, teacher, section, subject, assessment, date, maxMarks, scores) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, item.teacher, item.section, item.subject, item.assessment, item.date, item.maxMarks || 100, JSON.stringify(item.scores || {}));
        return sendJson(res, 200, { ok: true, id });
      }
    }

    // 6. Assignments
    if (pathname === '/api/assignments') {
      if (method === 'GET') {
        const rows = db.prepare('SELECT * FROM assignments ORDER BY due ASC').all();
        return sendJson(res, 200, { ok: true, data: rows });
      }
      if (method === 'POST') {
        const item = await parseJsonBody(req);
        if (Array.isArray(item)) {
          const stmt = db.prepare('INSERT OR REPLACE INTO assignments (id, owner, title, subject, section, due, desc) VALUES (?, ?, ?, ?, ?, ?, ?)');
          item.forEach(a => stmt.run(a.id || Date.now(), a.owner || 'hod', a.title, a.subject || '', a.section || '', a.due, a.desc || ''));
          return sendJson(res, 200, { ok: true, count: item.length });
        }
        const id = item.id || Date.now();
        db.prepare('INSERT OR REPLACE INTO assignments (id, owner, title, subject, section, due, desc) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(id, item.owner || 'hod', item.title, item.subject || '', item.section || '', item.due, item.desc || '');
        return sendJson(res, 200, { ok: true, id });
      }
    }
    if (pathname.startsWith('/api/assignments/') && method === 'DELETE') {
      const id = Number(pathname.split('/').pop());
      db.prepare('DELETE FROM assignments WHERE id = ?').run(id);
      return sendJson(res, 200, { ok: true, id });
    }

    // 7. Exams
    if (pathname === '/api/exams') {
      if (method === 'GET') {
        const rows = db.prepare('SELECT * FROM exams ORDER BY date ASC').all();
        return sendJson(res, 200, { ok: true, data: rows });
      }
      if (method === 'POST') {
        const item = await parseJsonBody(req);
        if (Array.isArray(item)) {
          const stmt = db.prepare('INSERT OR REPLACE INTO exams (id, subject, type, date, start, end, room, section) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
          item.forEach(e => stmt.run(e.id || Date.now(), e.subject, e.type, e.date, e.start, e.end, e.room, e.section || 'All'));
          return sendJson(res, 200, { ok: true, count: item.length });
        }
        const id = item.id || Date.now();
        db.prepare('INSERT OR REPLACE INTO exams (id, subject, type, date, start, end, room, section) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, item.subject, item.type, item.date, item.start, item.end, item.room, item.section || 'All');
        return sendJson(res, 200, { ok: true, id });
      }
    }
    if (pathname.startsWith('/api/exams/') && method === 'DELETE') {
      const id = Number(pathname.split('/').pop());
      db.prepare('DELETE FROM exams WHERE id = ?').run(id);
      return sendJson(res, 200, { ok: true, id });
    }

    // 8. Events (Academic Calendar)
    if (pathname === '/api/events') {
      if (method === 'GET') {
        const rows = db.prepare('SELECT * FROM events ORDER BY date ASC').all();
        return sendJson(res, 200, { ok: true, data: rows });
      }
      if (method === 'POST') {
        const item = await parseJsonBody(req);
        if (Array.isArray(item)) {
          const stmt = db.prepare('INSERT OR REPLACE INTO events (id, title, date, type, note) VALUES (?, ?, ?, ?, ?)');
          item.forEach(e => stmt.run(e.id || Date.now(), e.title, e.date, e.type || 'Event', e.note || ''));
          return sendJson(res, 200, { ok: true, count: item.length });
        }
        const id = item.id || Date.now();
        db.prepare('INSERT OR REPLACE INTO events (id, title, date, type, note) VALUES (?, ?, ?, ?, ?)')
          .run(id, item.title, item.date, item.type || 'Event', item.note || '');
        return sendJson(res, 200, { ok: true, id });
      }
    }
    if (pathname.startsWith('/api/events/') && method === 'DELETE') {
      const id = Number(pathname.split('/').pop());
      db.prepare('DELETE FROM events WHERE id = ?').run(id);
      return sendJson(res, 200, { ok: true, id });
    }

    // 9. Leave Requests
    if (pathname === '/api/leaves') {
      if (method === 'GET') {
        const rows = db.prepare('SELECT * FROM leaves ORDER BY id DESC').all();
        return sendJson(res, 200, { ok: true, data: rows });
      }
      if (method === 'POST') {
        const item = await parseJsonBody(req);
        if (Array.isArray(item)) {
          const stmt = db.prepare('INSERT OR REPLACE INTO leaves (id, usn, name, section, type, fromDate, toDate, reason, status, remark, applied) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
          item.forEach(l => stmt.run(l.id || Date.now(), l.usn, l.name, l.section, l.type, l.from || l.fromDate, l.to || l.toDate, l.reason, l.status || 'Pending', l.remark || '', l.applied || ''));
          return sendJson(res, 200, { ok: true, count: item.length });
        }
        const id = item.id || Date.now();
        db.prepare('INSERT OR REPLACE INTO leaves (id, usn, name, section, type, fromDate, toDate, reason, status, remark, applied) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, item.usn, item.name, item.section, item.type, item.from || item.fromDate, item.to || item.toDate, item.reason, item.status || 'Pending', item.remark || '', item.applied || '');
        return sendJson(res, 200, { ok: true, id });
      }
    }
    if (pathname.startsWith('/api/leaves/') && method === 'DELETE') {
      const id = Number(pathname.split('/').pop());
      db.prepare('DELETE FROM leaves WHERE id = ?').run(id);
      return sendJson(res, 200, { ok: true, id });
    }

    // 10. Help Desk Tickets
    if (pathname === '/api/tickets') {
      if (method === 'GET') {
        const rows = db.prepare('SELECT * FROM tickets ORDER BY id DESC').all();
        return sendJson(res, 200, { ok: true, data: rows });
      }
      if (method === 'POST') {
        const item = await parseJsonBody(req);
        if (Array.isArray(item)) {
          const stmt = db.prepare('INSERT OR REPLACE INTO tickets (id, usn, name, section, category, subject, message, status, reply, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
          item.forEach(t => stmt.run(t.id || Date.now(), t.usn, t.name, t.section, t.category, t.subject, t.message, t.status || 'Open', t.reply || '', t.date || ''));
          return sendJson(res, 200, { ok: true, count: item.length });
        }
        const id = item.id || Date.now();
        db.prepare('INSERT OR REPLACE INTO tickets (id, usn, name, section, category, subject, message, status, reply, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, item.usn, item.name, item.section, item.category, item.subject, item.message, item.status || 'Open', item.reply || '', item.date || '');
        return sendJson(res, 200, { ok: true, id });
      }
    }
    if (pathname.startsWith('/api/tickets/') && method === 'DELETE') {
      const id = Number(pathname.split('/').pop());
      db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
      return sendJson(res, 200, { ok: true, id });
    }

    // 11. Timetable Photos
    if (pathname === '/api/timetable-photos') {
      if (method === 'GET') {
        const rows = db.prepare('SELECT * FROM timetable_photos').all();
        const map = {};
        rows.forEach(r => { map[r.section] = r; });
        return sendJson(res, 200, { ok: true, data: map });
      }
      if (method === 'POST') {
        const item = await parseJsonBody(req);
        db.prepare('INSERT OR REPLACE INTO timetable_photos (section, id, title, image, publishedAt) VALUES (?, ?, ?, ?, ?)')
          .run(item.section, item.id || Date.now(), item.title, item.image, item.publishedAt);
        return sendJson(res, 200, { ok: true, section: item.section });
      }
    }

    // 12. Staff Profiles
    if (pathname === '/api/staff-profiles') {
      if (method === 'GET') {
        const rows = db.prepare('SELECT * FROM staff_profiles').all();
        const map = {};
        rows.forEach(r => { map[r.role] = r; });
        return sendJson(res, 200, { ok: true, data: map });
      }
      if (method === 'POST') {
        const p = await parseJsonBody(req);
        db.prepare(`
          INSERT OR REPLACE INTO staff_profiles (role, name, empId, department, designation, qualification, experience, phone, email, office, photo)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(p.role, p.name || '', p.empId || '', p.department || '', p.designation || '', p.qualification || '', p.experience || '', p.phone || '', p.email || '', p.office || '', p.photo || '');
        return sendJson(res, 200, { ok: true, role: p.role });
      }
    }

    // 13. HOD Directory
    if (pathname === '/api/hod-directory') {
      if (method === 'GET') {
        const rows = db.prepare('SELECT * FROM hod_directory').all();
        return sendJson(res, 200, { ok: true, data: rows });
      }
      if (method === 'POST') {
        const list = await parseJsonBody(req);
        if (Array.isArray(list)) {
          const stmt = db.prepare('INSERT OR REPLACE INTO hod_directory (dept, name, empId, phone, email, photo) VALUES (?, ?, ?, ?, ?, ?)');
          list.forEach(h => stmt.run(h.dept, h.name || '', h.empId || '', h.phone || '', h.email || '', h.photo || ''));
          return sendJson(res, 200, { ok: true, count: list.length });
        }
        db.prepare('INSERT OR REPLACE INTO hod_directory (dept, name, empId, phone, email, photo) VALUES (?, ?, ?, ?, ?, ?)')
          .run(list.dept, list.name || '', list.empId || '', list.phone || '', list.email || '', list.photo || '');
        return sendJson(res, 200, { ok: true });
      }
    }

    // 14. Key-Value Settings
    if (pathname === '/api/settings') {
      if (method === 'GET') {
        const rows = db.prepare('SELECT key, value FROM key_value_settings').all();
        const map = {};
        rows.forEach(r => { map[r.key] = r.value; });
        return sendJson(res, 200, { ok: true, data: map });
      }
      if (method === 'POST') {
        const body = await parseJsonBody(req);
        const stmt = db.prepare('INSERT OR REPLACE INTO key_value_settings (key, value) VALUES (?, ?)');
        if (body.key && body.value !== undefined) {
          stmt.run(body.key, typeof body.value === 'object' ? JSON.stringify(body.value) : String(body.value));
        } else {
          // Object of key-value pairs
          Object.keys(body).forEach(k => {
            stmt.run(k, typeof body[k] === 'object' ? JSON.stringify(body[k]) : String(body[k]));
          });
        }
        return sendJson(res, 200, { ok: true });
      }
    }

    // -------------------------------------------------------------
    // STATIC FILE SERVING (index.html, etc.)
    // -------------------------------------------------------------
    let filePath = pathname === '/' ? '/index.html' : pathname;
    let safePath = path.normalize(path.join(PUBLIC_DIR, filePath));

    // Security check to avoid path traversal
    if (!safePath.startsWith(PUBLIC_DIR)) {
      return sendError(res, 403, 'Forbidden');
    }

    if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
      const ext = path.extname(safePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      return fs.createReadStream(safePath).pipe(res);
    }

    // Fallback: 404
    sendError(res, 404, 'Not Found');
  } catch (err) {
    console.error(`[Error ${method} ${pathname}]:`, err);
    sendError(res, 500, err.message || 'Internal Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🎓 Alva's Campus Wayfinder - SQLite Backend Server`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`💾 Database: ${path.join(__dirname, 'campus.db')}`);
  console.log(`====================================================`);
});
