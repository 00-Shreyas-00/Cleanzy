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

  if (signedIn) {
    $('authContainer').style.display = 'none';
    $('appShell').style.display = 'grid';

    // Show workspace tabs for all logged in users
    $('roleTabs').style.display = 'flex';

    const role = state.user.role;
    document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
    document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));

    // Determine initial active view based on role
    let initialView = 'customerView';
    if (role === 'Worker') {
      initialView = 'workerView';
    } else if (role === 'Administrator') {
      initialView = 'adminView';
    }

    $(initialView).classList.add('active');
    
    // Highlight the corresponding tab
    document.querySelectorAll('.tab').forEach((tab) => {
      if (tab.dataset.view === initialView) {
        tab.classList.add('active');
      }
    });

    // Load data for the user's active role defensively
    if (role === 'User') {
      loadMyBookings().catch(() => undefined);
    } else if (role === 'Worker') {
      loadWorkerBookings().catch(() => undefined);
      loadAttendance().catch(() => undefined);
    } else if (role === 'Administrator') {
      loadAdminOverview().catch(() => undefined);
    }
  } else {
    $('authContainer').style.display = 'flex';
    $('appShell').style.display = 'none';
  }

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

/* --- Data Visualizations via Canvas --- */
const drawBookingsChart = (counts) => {
  const canvas = $('bookingsChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const padding = 20;
  const chartHeight = canvas.height - 2 * padding;
  const chartWidth = canvas.width - 2 * padding - 40;

  const statuses = counts.map((item) => item.status);
  const data = counts.map((item) => item.count);
  const maxVal = Math.max(...data, 1);

  const barHeight = Math.min(22, Math.floor(chartHeight / (statuses.length || 1)) - 8);
  const gap = (chartHeight - barHeight * statuses.length) / Math.max(1, statuses.length - 1);

  // Background Grid Lines
  ctx.strokeStyle = '#eef2f1';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const x = padding + 80 + (chartWidth - 80) * (i / 4);
    ctx.beginPath();
    ctx.moveTo(x, padding);
    ctx.lineTo(x, padding + chartHeight);
    ctx.stroke();
  }

  statuses.forEach((status, index) => {
    const val = data[index];
    const y = padding + index * (barHeight + gap);

    // Label
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(status, padding + 70, y + barHeight / 2 + 4);

    // Bar width and gradient
    const barWidth = ((chartWidth - 80) * val) / maxVal;
    const grad = ctx.createLinearGradient(padding + 80, 0, padding + 80 + barWidth, 0);

    if (status === 'Confirmed') {
      grad.addColorStop(0, '#0f766e');
      grad.addColorStop(1, '#14b8a6');
    } else if (status === 'Cancelled') {
      grad.addColorStop(0, '#be123c');
      grad.addColorStop(1, '#f43f5e');
    } else {
      grad.addColorStop(0, '#b7791f');
      grad.addColorStop(1, '#f59e0b');
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(padding + 80, y, barWidth, barHeight, 4);
    ctx.fill();

    // Value Text
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(val.toString(), padding + 85 + barWidth, y + barHeight / 2 + 4);
  });
};

const drawUsersChart = (roles) => {
  const canvas = $('usersChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2 - 45;
  const cy = canvas.height / 2;
  const radius = Math.min(cx, cy) - 20;
  const innerRadius = radius * 0.6;

  const total = roles.reduce((sum, item) => sum + item.count, 0) || 1;
  let startAngle = -Math.PI / 2;

  const colors = {
    User: '#0f766e',
    Worker: '#3b82f6',
    Administrator: '#f59e0b',
  };

  roles.forEach((item) => {
    const sliceAngle = (item.count / total) * Math.PI * 2;
    if (sliceAngle === 0) return;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
    ctx.arc(cx, cy, innerRadius, startAngle + sliceAngle, startAngle, true);
    ctx.closePath();

    ctx.fillStyle = colors[item.role] || '#64748b';
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    startAngle += sliceAngle;
  });

  // Centered labels
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(roles.reduce((sum, item) => sum + item.count, 0).toString(), cx, cy - 8);
  ctx.font = 'normal 10px sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('Users', cx, cy + 10);

  // Legends on the side
  roles.forEach((item, index) => {
    const x = canvas.width - 100;
    const y = 45 + index * 26;

    ctx.fillStyle = colors[item.role] || '#64748b';
    ctx.beginPath();
    ctx.arc(x, y - 4, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(item.role === 'User' ? 'Customer' : item.role === 'Worker' ? 'Staff' : 'Admin', x + 12, y - 4);
    ctx.font = 'normal 10px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`${item.count} total`, x + 12, y + 8);
  });
};

const drawPerformanceChart = (staff) => {
  const canvas = $('performanceChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const paddingLeft = 55;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 40;

  const chartWidth = canvas.width - paddingLeft - paddingRight;
  const chartHeight = canvas.height - paddingTop - paddingBottom;

  const labels = staff.map((s) => s.worker.name.split(' ')[0]);
  const earnings = staff.map((s) => s.salary_preview.estimated_amount);
  const maxEarnings = Math.max(...earnings, 200);

  const barWidth = Math.min(42, Math.floor(chartWidth / (labels.length || 1)) - 18);
  const gap = (chartWidth - barWidth * labels.length) / Math.max(1, labels.length - 1);

  // Horizontal Grid Lines
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#64748b';
  ctx.font = 'normal 10px sans-serif';
  ctx.textAlign = 'right';

  for (let i = 0; i <= 4; i++) {
    const y = paddingTop + chartHeight * (1 - i / 4);
    ctx.fillText(`${(maxEarnings * (i / 4)).toFixed(0)}`, paddingLeft - 10, y + 3);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(canvas.width - paddingRight, y);
    ctx.stroke();
  }

  staff.forEach((item, index) => {
    const x = paddingLeft + index * (barWidth + gap) + gap / 2;
    const barHeight = (chartHeight * item.salary_preview.estimated_amount) / maxEarnings;
    const y = canvas.height - paddingBottom - barHeight;

    const grad = ctx.createLinearGradient(0, y, 0, canvas.height - paddingBottom);
    grad.addColorStop(0, '#0284c7');
    grad.addColorStop(1, '#0369a1');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
    ctx.fill();

    // Value on top of bar
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`₹${item.salary_preview.estimated_amount.toFixed(0)}`, x + barWidth / 2, y - 6);

    // Label name
    ctx.fillStyle = '#334155';
    ctx.font = 'normal 10px sans-serif';
    ctx.fillText(labels[index], x + barWidth / 2, canvas.height - paddingBottom + 15);

    // Rating star
    ctx.fillStyle = '#b7791f';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText(`★${item.rating.toFixed(1)}`, x + barWidth / 2, canvas.height - paddingBottom + 27);
  });
};

const loadAdminOverview = async () => {
  const data = await api('/api/admin/overview');
  const overview = data.data;

  // Render HTML5 Canvas-based charts
  drawBookingsChart(overview.booking_counts || []);
  drawUsersChart(overview.users_by_role || []);
  drawPerformanceChart(overview.staff_performance || []);

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
      <h3>Bookings Overview</h3>
      <div class="metric-row">${bookingMetrics || '<span class="tag">0 bookings</span>'}</div>
    </article>
    <article class="result-card">
      <h3>System Users</h3>
      <div class="metric-row">${roleMetrics || '<span class="tag">0 users</span>'}</div>
    </article>
    <article class="result-card">
      <h3>Attendance Total</h3>
      <p>${overview.attendance_count} records</p>
    </article>
    <article class="result-card">
      <h3>Operational Support</h3>
      <p>${overview.complaints.length} complaints · ${overview.holiday_requests.length} holiday requests</p>
    </article>
    <article class="result-card wide">
      <h3>Staff Performance Details</h3>
      <div class="result-list">${staffCards || '<p>No staff records.</p>'}</div>
    </article>
    <article class="result-card wide">
      <h3>Recent Booking Log</h3>
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
  // Wire role tabs on login screen
  document.querySelectorAll('.role-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.role-tab').forEach((item) => item.classList.remove('active'));
      tab.classList.add('active');
      const role = tab.dataset.role;
      $('registerRole').value = role;

      // Toggle housekeeper specific fields
      const isWorker = role === 'Worker';
      $('registerSkillLabel').style.display = isWorker ? 'grid' : 'none';
      $('registerCoordsLabel').style.display = isWorker ? 'grid' : 'none';
    });
  });

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
