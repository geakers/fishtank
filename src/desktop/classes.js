const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = require('../db');
const { getAccessToken } = require('./session');

// Sends a request to Supabase as the logged-in user and returns the parsed
// response, throwing Supabase's error message if it fails. Row level security
// and the class functions decide what that user may see and change.
async function request(path, { method = 'GET', body, headers } = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error('Log in first');

  const res = await fetch(`${NEXT_PUBLIC_SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message || `Supabase request failed (${res.status})`);
  }
  return data;
}

// Calls one of the Postgres functions from the classes SQL.
function rpc(name, args) {
  return request(`/rest/v1/rpc/${name}`, { method: 'POST', body: args });
}

// Creates a class taught by the logged-in user and returns
// { id, class_name, teacher_id }.
async function createClass(className) {
  if (typeof className !== 'string' || !className.trim()) throw new Error('A class name is required');

  const [created] = await request('/rest/v1/classes?select=id,class_name,teacher_id', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: { class_name: className.trim() },
  });
  return created;
}

// Returns [{ id, class_name, teacher_id }] for the classes the logged-in user
// teaches or is a student in, sorted by name.
function listClasses() {
  return request('/rest/v1/classes?select=id,class_name,teacher_id&order=class_name');
}

// Adds the user with this username to the class. Only the class's teacher can.
async function addStudent(classId, username) {
  await rpc('add_student', { cid: classId, student_username: username });
}

// Returns [{ username, role }] for everyone in the class, where role is
// 'teacher' or 'student'.
function classRoster(classId) {
  return rpc('class_roster', { cid: classId });
}

// Returns up to 10 usernames containing the search text.
async function searchUsernames(query) {
  const rows = await rpc('search_usernames', { query });
  return rows.map((row) => row.username);
}

module.exports = { createClass, listClasses, addStudent, classRoster, searchUsernames };
