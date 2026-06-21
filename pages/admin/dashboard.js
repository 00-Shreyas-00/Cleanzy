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
  const signedIn = Boolean(state.token && state.user && state.user.role === 'Administrator');
  if (!signedIn) {
    clearSession();
    return;
  }
  $('sessionStatus').textContent = `Admin: ${state.user.name || state.user.email}`;
  $('welcomeTitle').textContent = `${state.user.name || state.user.email} · Admin Workspace`;
};

const money = (value) => `INR ${Number(value || 0).toFixed(2)}`;

const renderEmpty = (target, text) => {
  if (target) {
    target.innerHTML = `<div class="result-card"><p>${text}</p></div>`;
  }
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

  $('loadAdminButton').addEventListener('click', () => loadAdminOverview().catch((error) => showMessage(error.message, true)));
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
  await loadAdminOverview().catch((error) => showMessage(error.message, true));
  await loadNotifications().catch(() => undefined);
};

init();
