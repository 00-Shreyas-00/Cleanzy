const state = {
  token: localStorage.getItem('cleanzy_token') || '',
  user: JSON.parse(localStorage.getItem('cleanzy_user') || 'null'),
};

const $ = (id) => document.getElementById(id);

const money = (value) => `INR ${Number(value || 0).toFixed(2)}`;

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
  if (status === 'Confirmed' || status === 'Accepted') return 'tag';
  if (status === 'Cancelled' || status === 'Declined' || status === 'Rejected') return 'tag danger';
  if (status === 'Approved') return 'tag';
  if (status === 'Pending') return 'tag warn';
  return 'tag';
};

const getSharedLeaveRequests = () => {
  try {
    return JSON.parse(localStorage.getItem('cleanzy_leave_requests') || '[]');
  } catch (err) {
    return [];
  }
};

const saveSharedLeaveRequests = (requests) => {
  localStorage.setItem('cleanzy_leave_requests', JSON.stringify(requests));
};

const renderEmpty = (target, text) => {
  if (target) {
    target.innerHTML = `<div class="result-card"><p>${text}</p></div>`;
  }
};

const clearNotifications = async (userId) => {
  console.log(`clearNotifications(${userId})`);
  const target = $('notificationsList');
  if (target) {
    renderEmpty(target, 'No notifications.');
  }
};

const updateBookingCardStatus = (bookingId, status) => {
  state.jobStatusByBookingId = state.jobStatusByBookingId || {};
  state.jobStatusByBookingId[bookingId] = status;
  const statusEl = document.querySelector(`[data-booking-status="${bookingId}"]`);
  const acceptBtn = document.querySelector(`[data-action="accept"][data-booking-id="${bookingId}"]`);
  const declineBtn = document.querySelector(`[data-action="decline"][data-booking-id="${bookingId}"]`);
  if (statusEl) {
    statusEl.textContent = status;
    statusEl.className = tagClass(status);
  }
  if (acceptBtn) acceptBtn.disabled = status === 'Accepted';
  if (declineBtn) declineBtn.disabled = status === 'Declined';
};

const acceptJob = async (bookingId) => {
  // Stub: call accept job flow and update locally.
  console.log(`acceptJob(${bookingId})`);
  updateBookingCardStatus(bookingId, 'Accepted');
  showMessage('Booking accepted locally.');
};

const declineJob = async (bookingId) => {
  // Stub: call decline job flow and update locally.
  console.log(`declineJob(${bookingId})`);
  updateBookingCardStatus(bookingId, 'Declined');
  showMessage('Booking declined locally.');
};

const submitLeaveRequest = async (workerId, fromDate, toDate, remarks) => {
  // Stub: create leave request locally in shared state.
  console.log(`submitLeaveRequest(${workerId}, ${fromDate}, ${toDate}, ${remarks})`);
  const requests = getSharedLeaveRequests();
  const newRequest = {
    request_id: `lr_${Date.now()}`,
    worker_id: workerId,
    worker_name: state.user.name || 'Worker',
    from_date: fromDate,
    to_date: toDate,
    remarks,
    status: 'Pending',
    created_at: new Date().toISOString(),
  };
  requests.unshift(newRequest);
  saveSharedLeaveRequests(requests);
  return newRequest;
};

const renderLeaveRequests = () => {
  const target = $('leaveRequestsList');
  const requests = getSharedLeaveRequests().filter((item) => item.worker_id === state.user.user_id);
  if (!requests.length) {
    renderEmpty(target, 'No leave requests recorded.');
    return;
  }
  target.innerHTML = requests
    .map(
      (request) => `
      <article class="result-card">
        <div class="metric-row">
          <span class="tag">${new Date(request.from_date).toLocaleDateString()} – ${new Date(request.to_date).toLocaleDateString()}</span>
          <span class="${tagClass(request.status)}">${request.status}</span>
        </div>
        <p>${request.remarks || 'No remarks provided.'}</p>
      </article>`
    )
    .join('');
};

const loadWorkerBookings = async () => {
  const data = await api('/api/worker/bookings');
  state.pastBookings = data.data.past || [];
  renderEarnings();

  const target = $('workerBookingsList');
  const combined = [...data.data.upcoming, ...data.data.past];
  if (!combined.length) {
    renderEmpty(target, 'No assigned bookings.');
    return;
  }
  state.workerBookings = combined;
  target.innerHTML = combined
    .map((booking) => {
      const localStatus = state.jobStatusByBookingId?.[booking.booking_id] || booking.status || 'Pending';
      const disabledAccept = localStatus === 'Accepted' ? 'disabled' : '';
      const disabledDecline = localStatus === 'Declined' ? 'disabled' : '';
      return `
      <article class="result-card">
        <h3>${booking.service.service_name}</h3>
        <div class="metric-row">
          <span data-booking-status="${booking.booking_id}" class="${tagClass(localStatus)}">${localStatus}</span>
          <span class="tag">${booking.client.name}</span>
        </div>
        <p>${new Date(booking.scheduled_time).toLocaleString()} · ${booking.location}</p>
        <div class="button-row" style="margin-top: 14px; gap: 8px;">
          <button class="primary" data-action="accept" data-booking-id="${booking.booking_id}" ${disabledAccept}>Accept</button>
          <button class="danger" data-action="decline" data-booking-id="${booking.booking_id}" ${disabledDecline}>Decline</button>
        </div>
      </article>`;
    })
    .join('');
};

const requestPayout = (workerId, amount) => {
  // TODO: Integrate Razorpay payout/route API.
  console.log(`requestPayout: workerId=${workerId}, amount=${amount}`);
  showMessage(`Payout request of INR ${amount.toFixed(2)} submitted for worker: ${workerId}`);
};

const renderEarnings = () => {
  const target = $('earningsContainer');
  if (!target) return;

  const past = state.pastBookings || [];
  if (!past.length) {
    target.innerHTML = `<p>No completed jobs yet.</p>`;
    return;
  }

  const totalEarnings = past.reduce((sum, booking) => sum + (booking.service.base_price || 0), 0);

  const tableRows = past
    .map(
      (booking) => `
      <tr>
        <td>${booking.service.service_name}</td>
        <td>${new Date(booking.scheduled_time).toLocaleDateString()}</td>
        <td>${money(booking.service.base_price)}</td>
      </tr>`
    )
    .join('');

  target.innerHTML = `
    <div class="earnings-total-card">
      <span class="earnings-total-label">Total Earnings:</span>
      <span class="earnings-total-value">${money(totalEarnings)}</span>
    </div>
    <div class="earnings-table-wrapper">
      <table class="earnings-table">
        <thead>
          <tr>
            <th>Service</th>
            <th>Date</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
    <button id="requestPayoutButton" class="primary w-full" style="margin-top: 14px;">Request Payout</button>
  `;

  $('requestPayoutButton').addEventListener('click', () => {
    const workerId = state.user.user_id;
    requestPayout(workerId, totalEarnings);
  });
};

const loadAttendance = async () => {
  const data = await api('/api/worker/attendance');
  const target = $('attendanceList');
  const historyContainer = $('attendanceHistoryContainer');
  state.attendanceHistory = data.data.attendance || [];
  const today = state.attendanceHistory.find((item) => item.date === new Date().toISOString().slice(0, 10));
  if (!state.attendanceHistory.length) {
    renderEmpty(target, 'No attendance records.');
    if (historyContainer) historyContainer.innerHTML = '';
    return;
  }
  const todayItem = today || state.attendanceHistory[0];
  target.innerHTML = `
    <article class="result-card">
      <h3>${new Date(todayItem.date).toLocaleDateString()}</h3>
      <p>In: ${new Date(todayItem.check_in).toLocaleString()}</p>
      <p>Out: ${todayItem.check_out ? new Date(todayItem.check_out).toLocaleString() : 'Open'}</p>
    </article>`;
  if (historyContainer) {
    historyContainer.innerHTML = `
      <button id="toggleAttendanceHistory" class="secondary">View History</button>
      <div id="attendanceHistoryTable" class="result-list" style="display:none;"></div>`;
  }
};

const showAttendanceHistory = () => {
  const container = $('attendanceHistoryTable');
  const toggle = $('toggleAttendanceHistory');
  if (!container || !toggle) return;
  if (container.style.display === 'none' || container.style.display === '') {
    const rows = state.attendanceHistory
      .map(
        (item) => `
        <tr>
          <td>${new Date(item.date).toLocaleDateString()}</td>
          <td>${new Date(item.check_in).toLocaleTimeString()}</td>
          <td>${item.check_out ? new Date(item.check_out).toLocaleTimeString() : 'Open'}</td>
        </tr>`
      )
      .join('');
    container.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr><th>Date</th><th>Check-In</th><th>Check-Out</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    container.style.display = 'block';
    toggle.textContent = 'Hide History';
  } else {
    container.style.display = 'none';
    toggle.textContent = 'View History';
  }
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
  $('loadLeaveRequestsButton').addEventListener('click', () => renderLeaveRequests());
  $('loadAttendanceButton').addEventListener('click', () => loadAttendance().catch((error) => showMessage(error.message, true)));
  $('loadEarningsButton').addEventListener('click', () => loadWorkerBookings().catch((error) => showMessage(error.message, true)));
  $('clearNotificationsButton').addEventListener('click', async () => {
    await api('/api/notifications/clear', { method: 'POST', body: { user_id: state.user.user_id } }).catch(() => {});
    await clearNotifications(state.user.user_id);
  });
  $('requestLeaveButton').addEventListener('click', () => {
    $('leaveModal').classList.add('active');
  });
  $('closeLeaveModal').addEventListener('click', () => $('leaveModal').classList.remove('active'));
  $('cancelLeaveModal').addEventListener('click', () => $('leaveModal').classList.remove('active'));
  $('submitLeaveModal').addEventListener('click', async () => {
    const fromDate = $('leaveFromInput').value;
    const toDate = $('leaveToInput').value;
    const remarks = $('leaveRemarksInput').value.trim();
    if (!fromDate || !toDate) {
      showMessage('Please select both from and to dates.', true);
      return;
    }
    await submitLeaveRequest(state.user.user_id, fromDate, toDate, remarks).catch((error) => showMessage(error.message, true));
    $('leaveModal').classList.remove('active');
    $('leaveFromInput').value = '';
    $('leaveToInput').value = '';
    $('leaveRemarksInput').value = '';
    renderLeaveRequests();
  });

  $('checkInButton').addEventListener('click', () => attendanceAction('check-in').catch((error) => showMessage(error.message, true)));
  $('checkOutButton').addEventListener('click', () => attendanceAction('check-out').catch((error) => showMessage(error.message, true)));
  $('refreshNotificationsButton').addEventListener('click', () => loadNotifications().catch((error) => showMessage(error.message, true)));
  document.body.addEventListener('click', (event) => {
    const toggleHistory = event.target.id === 'toggleAttendanceHistory';
    if (toggleHistory) showAttendanceHistory();
  });

  document.body.addEventListener('click', (event) => {
    const readId = event.target.dataset.read;
    const action = event.target.dataset.action;
    const bookingId = event.target.dataset.bookingId;
    const toggleHistoryBtn = event.target.id === 'toggleAttendanceHistory';
    if (readId) readNotification(readId).catch((error) => showMessage(error.message, true));
    if (action === 'accept' && bookingId) acceptJob(bookingId).catch((error) => showMessage(error.message, true));
    if (action === 'decline' && bookingId) declineJob(bookingId).catch((error) => showMessage(error.message, true));
    if (toggleHistoryBtn) showAttendanceHistory();
  });
};

const init = async () => {
  renderSession();
  drawOpsCanvas();
  wireEvents();
  await loadWorkerBookings().catch((error) => showMessage(error.message, true));
  renderLeaveRequests();
  await loadAttendance().catch((error) => showMessage(error.message, true));
  await loadNotifications().catch(() => undefined);
};

init();
