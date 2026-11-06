# Alva's Campus Wayfinder — Full-Stack SQLite Edition

A campus wayfinder and multi-portal academic management web app for **Alva's Education Foundation** / **Alva's Institute of Engineering & Technology (AIET), Mijar, Moodbidri**.

---

## 🚀 Quick Start

### Option A: Double-Click Runner (Windows)
Double-click `start-server.bat`. It will start the server and automatically open `http://localhost:3000` in your default browser.

### Option B: Terminal Command
In your terminal, navigate to this directory and run:
```bash
node server.js
```
Then visit [http://localhost:3000](http://localhost:3000).

---

## 📁 Project Architecture

| File | Description |
| :--- | :--- |
| [`index.html`](file:///C:/Users/RUTHVIK%20T%20N/.gemini/antigravity/scratch/alvas-campus-wayfinder/index.html) | Single-page responsive client with Interactive SVG map, Student, Lecturer, HOD, and Principal portals. |
| [`server.js`](file:///C:/Users/RUTHVIK%20T%20N/.gemini/antigravity/scratch/alvas-campus-wayfinder/server.js) | Zero-dependency Node.js HTTP & REST API server that serves `index.html` and persists all data to SQLite. |
| [`db.js`](file:///C:/Users/RUTHVIK%20T%20N/.gemini/antigravity/scratch/alvas-campus-wayfinder/db.js) | Database initialization using Node 22.5+ built-in `node:sqlite` (`DatabaseSync`). |
| `campus.db` | Persistent SQLite database file containing all timetable, student, marks, attendance, and administrative records. |
| [`start-server.bat`](file:///C:/Users/RUTHVIK%20T%20N/.gemini/antigravity/scratch/alvas-campus-wayfinder/start-server.bat) | Windows launcher script that launches `server.js` and opens the browser. |

---

## 🗄️ SQLite Database Schema

The SQLite database (`campus.db`) contains 16 tables:

1. **`timetable`**: Master timetable entries (date, day, start/end time, subject, faculty, room, section).
2. **`announcements`**: Campus and department notices with recipient targeting.
3. **`students`**: Student profiles (USN, name, branch, section, phone, guardian info, photo).
4. **`faculty`**: Registered teaching faculty names.
5. **`subjects`**: Course subjects (Python, Maths, AI Lab, etc.).
6. **`attendance`**: Daily class roll calls with present/absent USN lists.
7. **`marks`**: Subject-wise assessment results and maximum scores.
8. **`assignments`**: HOD-posted work and student personal to-dos with due dates.
9. **`exams`**: Internal, semester, and laboratory exam schedules.
10. **`events`**: Academic calendar events, holidays, and deadlines.
11. **`leaves`**: Student leave applications with approval/rejection remarks.
12. **`tickets`**: Help desk queries, complaints, and HOD resolution messages.
13. **`timetable_photos`**: Published photo timetables per section.
14. **`staff_profiles`**: Digital staff ID credentials (HOD, Principal).
15. **`hod_directory`**: Department-wise HOD directory.
16. **`key_value_settings`**: General system configuration, Principal PIN hash, GPS coordinates, and WhatsApp links.

---

## ⚡ Real-Time Sync & Offline Resilience

* **Zero external dependencies**: Built purely on Node's native `node:sqlite` and `node:http`. No `npm install` required.
* **Automatic Dual-Storage**: Changes made in the UI are immediately saved to `localStorage` (for instant snappy local responsiveness) and synced to `campus.db` via REST APIs.
* **Status Badge**: The top-right header displays `● SQLite DB Connected` when connected to the backend, or `○ Local Storage Mode` when running standalone.
