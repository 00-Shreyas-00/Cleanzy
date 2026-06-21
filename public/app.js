const state = {
  token: localStorage.getItem('cleanzy_token') || '',
  user: JSON.parse(localStorage.getItem('cleanzy_user') || 'null'),
  services: [],
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
  bar.textContent = message;
  bar.classList.toggle('error', isError);
  bar.hidden = false;
};

const setSession = (token, user) => {
  state.token = token;
  state.user = user;
  localStorage.setItem('cleanzy_token', token);
  localStorage.setItem('cleanzy_user', JSON.stringify(user));
  renderSession();
};

const clearSession = () => {
  state.token = '';
  state.user = null;
  localStorage.removeItem('cleanzy_token');
  localStorage.removeItem('cleanzy_user');
  renderSession();
};

const renderSession = () => {
  const signedIn = Boolean(state.token && state.user);
  $('sessionStatus').textContent = signedIn ? state.user.role : 'Signed out';
  $('welcomeTitle').textContent = signedIn
    ? `${state.user.name || state.user.email} · ${state.user.role}`
    : 'Backend connected';
};

const setDefaultSchedule = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(10, 0, 0, 0);
  $('scheduleInput').value = date.toISOString().slice(0, 16);
};

const tagClass = (status) => {
  if (status === 'Confirmed') return 'tag';
  if (status === 'Cancelled') return 'tag danger';
  return 'tag warn';
};

const money = (value) => `INR ${Number(value || 0).toFixed(2)}`;

const renderEmpty = (target, text) => {
  target.innerHTML = `<div class="result-card"><p>${text}</p></div>`;
};

const loadServices = async () => {
  const data = await api('/api/services');
  state.services = data.data.services;
  $('serviceSelect').innerHTML = state.services
    .map((service) => `<option value="${service.service_id}">${service.service_name} · ${money(service.base_price)}</option>`)
    .join('');
};

const searchWorkers = async () => {
  const payload = {
    service_id: $('serviceSelect').value,
    scheduled_time: new Date($('scheduleInput').value).toISOString(),
    location: $('locationInput').value,
    client_location_coords: $('clientCoordsInput').value,
  };
  const data = await api('/api/discovery/search', { method: 'POST', body: payload });
  const target = $('choicesList');
  if (!data.data.choices.length) {
    renderEmpty(target, 'No matching workers for this schedule.');
    return;
  }
  target.innerHTML = data.data.choices
    .map(
      (choice) => `
      <article class="result-card">
        <h3>${choice.worker.name}</h3>
        <div class="metric-row">
          <span class="tag">${choice.worker.rating.toFixed(1)} rating</span>
          <span class="tag">${choice.service.duration_mins} mins</span>
          <span class="tag">${choice.distance_km ?? 'No'} km</span>
        </div>
        <p>${choice.worker.skill_type} · ${choice.worker.phone}</p>
        <p>${choice.location} · ${new Date(choice.schedule.scheduled_time).toLocaleString()}</p>
        <button class="primary" data-book="${choice.staff_id}">Book</button>
      </article>`
    )
    .join('');
};

const bookWorker = async (staffId) => {
  const payload = {
    service_id: $('serviceSelect').value,
    staff_id: staffId,
    scheduled_time: new Date($('scheduleInput').value).toISOString(),
    location: $('locationInput').value,
  };
  const data = await api('/api/bookings/commit', { method: 'POST', body: payload });
  showMessage(`Booking created. Payment intent ${data.data.payment_intent.payment_intent_id} is waiting for gateway authorization.`);
  await Promise.all([loadMyBookings(), loadNotifications()]);
};

const loadMyBookings = async () => {
  const data = await api('/api/bookings/my');
  const target = $('myBookingsList');
  if (!data.data.bookings.length) {
    renderEmpty(target, 'No customer bookings yet.');
    return;
  }
  target.innerHTML = data.data.bookings
    .map(
      (booking) => `
      <article class="result-card">
        <h3>${booking.service.service_name}</h3>
        <div class="metric-row">
          <span class="${tagClass(booking.status)}">${booking.status}</span>
          <span class="tag">${money(booking.service.base_price)}</span>
        </div>
        <p>${booking.staff.user.name} · ${new Date(booking.scheduled_time).toLocaleString()}</p>
        <p>${booking.location}</p>
        ${
          booking.status === 'Confirmed' && !booking.feedback
            ? `<textarea data-comments="${booking.booking_id}" placeholder="Feedback"></textarea>
               <div class="button-row">
                 <select data-rating="${booking.booking_id}">
                   <option value="5">5</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1</option>
                 </select>
                 <button data-feedback="${booking.booking_id}">Submit Feedback</button>
               </div>`
            : ''
        }
      </article>`
    )
    .join('');
};

const submitFeedback = async (bookingId) => {
  const rating = document.querySelector(`[data-rating="${bookingId}"]`).value;
  const comments = document.querySelector(`[data-comments="${bookingId}"]`).value;
  await api('/api/feedback', {
    method: 'POST',
    body: { booking_id: bookingId, rating: Number(rating), comments },
  });
  showMessage('Feedback submitted and worker rating updated.');
  await Promise.all([loadMyBookings(), loadNotifications()]);
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

const loadAdminOverview = async () => {
  const data = await api('/api/admin/overview');
  const overview = data.data;
  const bookingMetrics = overview.booking_counts
    .map((item) => `<span class="tag">${item.status}: ${item.count}</span>`)
    .join('');
  const roleMetrics = overview.users_by_role
    .map((item) => `<span class="tag">${item.role}: ${item.count}</span>`)
    .join('');
  const staffCards = overview.staff_performance
    .map(
      (staff) => `
      <article class="result-card">
        <h3>${staff.worker.name}</h3>
        <p>${staff.skill_type} · ${staff.rating.toFixed(1)} rating</p>
        <div class="metric-row">
          <span class="tag">${staff.confirmed_bookings} confirmed</span>
          <span class="tag">${staff.attendance_days} attendance</span>
          <span class="tag">${money(staff.salary_preview.estimated_amount)}</span>
        </div>
      </article>`
    )
    .join('');
  $('adminOverview').innerHTML = `
    <article class="result-card">
      <h3>Bookings</h3>
      <div class="metric-row">${bookingMetrics || '<span class="tag">0 bookings</span>'}</div>
    </article>
    <article class="result-card">
      <h3>Users</h3>
      <div class="metric-row">${roleMetrics || '<span class="tag">0 users</span>'}</div>
    </article>
    <article class="result-card">
      <h3>Attendance</h3>
      <p>${overview.attendance_count} records</p>
    </article>
    <article class="result-card">
      <h3>Support</h3>
      <p>${overview.complaints.length} complaints · ${overview.holiday_requests.length} holiday requests</p>
    </article>
    <article class="result-card wide">
      <h3>Staff Performance</h3>
      <div class="result-list">${staffCards || '<p>No staff records.</p>'}</div>
    </article>
    <article class="result-card wide">
      <h3>Recent Bookings</h3>
      <div class="result-list">
        ${overview.recent_bookings
          .slice(0, 6)
          .map((booking) => `<p>${booking.service.service_name} · ${booking.status} · ${new Date(booking.scheduled_time).toLocaleString()}</p>`)
          .join('') || '<p>No recent bookings.</p>'}
      </div>
    </article>`;
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
  $('loginButton').addEventListener('click', async () => {
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: { email: $('emailInput').value, password: $('passwordInput').value },
      });
      setSession(data.token, data.data);
      showMessage('Signed in.');
      await Promise.all([loadNotifications(), loadServices()]);
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $('logoutButton').addEventListener('click', () => {
    clearSession();
    showMessage('Signed out.');
  });

  $('registerButton').addEventListener('click', async () => {
    try {
      const role = $('registerRole').value;
      const body = {
        name: $('registerName').value,
        email: $('emailInput').value,
        phone: $('registerPhone').value,
        password: $('passwordInput').value,
        address: $('registerAddress').value,
      };
      const path =
        role === 'Worker'
          ? '/api/auth/register-worker'
          : '/api/auth/register';
      if (role === 'Worker') {
        body.skill_type = $('registerSkill').value;
        body.location_coords = $('registerCoords').value;
      } else {
        body.role = role;
      }
      await api(path, { method: 'POST', body });
      showMessage('Account created. Login is ready.');
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active'));
      document.querySelectorAll('.view').forEach((item) => item.classList.remove('active'));
      tab.classList.add('active');
      $(tab.dataset.view).classList.add('active');
    });
  });

  $('loadServicesButton').addEventListener('click', () => loadServices().catch((error) => showMessage(error.message, true)));
  $('searchButton').addEventListener('click', () => searchWorkers().catch((error) => showMessage(error.message, true)));
  $('loadMyBookingsButton').addEventListener('click', () => loadMyBookings().catch((error) => showMessage(error.message, true)));
  $('loadWorkerBookingsButton').addEventListener('click', () => loadWorkerBookings().catch((error) => showMessage(error.message, true)));
  $('loadAttendanceButton').addEventListener('click', () => loadAttendance().catch((error) => showMessage(error.message, true)));
  $('checkInButton').addEventListener('click', () => attendanceAction('check-in').catch((error) => showMessage(error.message, true)));
  $('checkOutButton').addEventListener('click', () => attendanceAction('check-out').catch((error) => showMessage(error.message, true)));
  $('loadAdminButton').addEventListener('click', () => loadAdminOverview().catch((error) => showMessage(error.message, true)));
  $('refreshNotificationsButton').addEventListener('click', () => loadNotifications().catch((error) => showMessage(error.message, true)));

  document.body.addEventListener('click', (event) => {
    const bookId = event.target.dataset.book;
    const feedbackId = event.target.dataset.feedback;
    const readId = event.target.dataset.read;
    if (bookId) bookWorker(bookId).catch((error) => showMessage(error.message, true));
    if (feedbackId) submitFeedback(feedbackId).catch((error) => showMessage(error.message, true));
    if (readId) readNotification(readId).catch((error) => showMessage(error.message, true));
  });
};

const init = async () => {
  renderSession();
  setDefaultSchedule();
  drawOpsCanvas();
  wireEvents();
  await loadServices().catch((error) => showMessage(error.message, true));
  await loadNotifications().catch(() => undefined);
};

init();

