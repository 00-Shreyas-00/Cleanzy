const state = {
  token: localStorage.getItem('cleanzy_token') || '',
  user: JSON.parse(localStorage.getItem('cleanzy_user') || 'null'),
};

const $ = (id) => document.getElementById(id);

const api = async (path, options = {}) => {
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed with ${response.status}`);
  }
  return data;
};

const showMessage = (message, isError = false) => {
  const bar = $('messageBar');
  if (bar) {
    bar.textContent = message;
    bar.classList.toggle('error', isError);
    bar.hidden = false;
  }
};

const clearSession = () => {
  state.token = '';
  state.user = null;
  localStorage.removeItem('cleanzy_token');
  localStorage.removeItem('cleanzy_user');
  document.cookie = 'cleanzy_token=; path=/; max-age=0';
  window.location.href = '/';
};

const renderSession = () => {
  const signedIn = Boolean(state.token && state.user && state.user.role === 'Worker');
  if (!signedIn) {
    clearSession();
    return;
  }
  $('sessionStatus').textContent = `Worker: ${state.user.name || state.user.email}`;
  $('welcomeTitle').textContent = `${state.user.name || state.user.email} · Worker Workspace`;
};

const tagClass = (status) => {
  if (status === 'Confirmed') return 'tag';
  if (status === 'Cancelled') return 'tag danger';
  return 'tag warn';
};

const renderEmpty = (target, text) => {
  if (target) {
    target.innerHTML = `<div class="result-card"><p>${text}</p></div>`;
  }
};

const loadWorkerBookings = async () => {
  const data = await api('/api/worker/bookings');
  const target = $('workerBookingsList');
  const combined = [...data.data.upcoming, ...data.data.past];
  if (!combined.length) {
    renderEmpty(target, 'No assigned bookings.');
    return;
  }
  target.innerHTML = combined
    .map(
      (booking) => `
      <article class="result-card">
        <h3>${booking.service.service_name}</h3>
        <div class="metric-row">
          <span class="${tagClass(booking.status)}">${booking.status}</span>
          <span class="tag">${booking.client.name}</span>
        </div>
        <p>${new Date(booking.scheduled_time).toLocaleString()} · ${booking.location}</p>
      </article>`
    )
    .join('');
};

const loadAttendance = async () => {
  const data = await api('/api/worker/attendance');
  const target = $('attendanceList');
  if (!data.data.attendance.length) {
    renderEmpty(target, 'No attendance records.');
    return;
  }
  target.innerHTML = data.data.attendance
    .map(
      (item) => `
      <article class="result-card">
        <h3>${new Date(item.date).toLocaleDateString()}</h3>
        <p>In: ${new Date(item.check_in).toLocaleString()}</p>
        <p>Out: ${item.check_out ? new Date(item.check_out).toLocaleString() : 'Open'}</p>
      </article>`
    )
    .join('');
};

const attendanceAction = async (kind) => {
  await api(`/api/worker/attendance/${kind}`, { method: 'POST', body: {} });
  showMessage(kind === 'check-in' ? 'Checked in.' : 'Checked out.');
  await Promise.all([loadAttendance(), loadNotifications()]);
};

const loadNotifications = async () => {
  if (!state.token) {
    renderEmpty($('notificationsList'), 'Sign in to view notifications.');
    return;
  }
  const data = await api('/api/notifications');
  const target = $('notificationsList');
  if (!data.data.notifications.length) {
    renderEmpty(target, 'No notifications.');
    return;
  }
  target.innerHTML = data.data.notifications
    .map(
      (item) => `
      <article class="notification">
        <div class="metric-row">
          <span class="tag">${item.type}</span>
          <span class="${item.is_read ? 'tag' : 'tag warn'}">${item.is_read ? 'Read' : 'New'}</span>
        </div>
        <p>${item.message}</p>
        <button data-read="${item.notification_id}">Mark Read</button>
      </article>`
    )
    .join('');
};

const readNotification = async (id) => {
  await api(`/api/notifications/${id}/read`, { method: 'PUT', body: {} });
  await loadNotifications();
};

const drawOpsCanvas = () => {
  const canvas = $('opsCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#e6f4f1';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 8; i += 1) {
    ctx.beginPath();
    ctx.arc(34 + i * 45, 28 + (i % 2) * 18, 11 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#0f766e';
  ctx.fillRect(34, 68, 76, 10);
  ctx.fillRect(130, 62, 58, 16);
  ctx.fillRect(208, 54, 82, 24);
  ctx.fillStyle = '#b7791f';
  ctx.fillRect(74, 45, 8, 32);
  ctx.fillStyle = '#c2413b';
  ctx.beginPath();
  ctx.arc(318, 72, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#15252b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(38, 88);
  ctx.lineTo(330, 88);
  ctx.stroke();
};

const wireEvents = () => {
  $('logoutButton').addEventListener('click', () => {
    clearSession();
  });

  $('loadWorkerBookingsButton').addEventListener('click', () => loadWorkerBookings().catch((error) => showMessage(error.message, true)));
  $('loadAttendanceButton').addEventListener('click', () => loadAttendance().catch((error) => showMessage(error.message, true)));
  $('checkInButton').addEventListener('click', () => attendanceAction('check-in').catch((error) => showMessage(error.message, true)));
  $('checkOutButton').addEventListener('click', () => attendanceAction('check-out').catch((error) => showMessage(error.message, true)));
  $('refreshNotificationsButton').addEventListener('click', () => loadNotifications().catch((error) => showMessage(error.message, true)));

  document.body.addEventListener('click', (event) => {
    const readId = event.target.dataset.read;
    if (readId) readNotification(readId).catch((error) => showMessage(error.message, true));
  });
};

const init = async () => {
  renderSession();
  drawOpsCanvas();
  wireEvents();
  await loadWorkerBookings().catch((error) => showMessage(error.message, true));
  await loadAttendance().catch((error) => showMessage(error.message, true));
  await loadNotifications().catch(() => undefined);
};

init();
