const state = {
  token: localStorage.getItem('cleanzy_token') || '',
  user: JSON.parse(localStorage.getItem('cleanzy_user') || 'null'),
  chartsRendered: false,
  adminOverviewData: null,
  analyticsActive: false,
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

const renderStaffPerformanceCard = (staff, isHidden = false) => {
  const recentStatus = staff.last_job_status || staff.most_recent_job_response || staff.last_response || 'Pending';
  const hiddenStyle = isHidden ? ' style="display:none;"' : '';
  return `
    <article class="result-card staff-performance-card"${hiddenStyle}>
      <div class="metric-row" style="justify-content: space-between; gap: 10px; align-items: flex-start;">
        <div>
          <h3>${staff.worker.name}</h3>
          <p>${staff.skill_type} · ${staff.rating.toFixed(1)} rating</p>
        </div>
        <span class="${jobStatusClass(recentStatus)}">${recentStatus}</span>
      </div>
      <div class="metric-row">
        <span class="tag">${staff.confirmed_bookings} confirmed</span>
        <span class="tag">${staff.attendance_days} attendance</span>
        <span class="tag">${money(staff.salary_preview.estimated_amount)}</span>
      </div>
      <button class="primary w-full pay-worker-btn" style="margin-top: 8px;" data-pay-worker="${staff.worker.user_id}" data-worker-name="${staff.worker.name}" data-amount="${staff.salary_preview.estimated_amount}">Pay Worker</button>
    </article>`;
};

const toggleStaffPerformanceCards = () => {
  const button = $('toggleStaffPerformanceButton');
  const cards = Array.from(document.querySelectorAll('.staff-performance-card'));
  if (!button || !cards.length) return;

  const shouldExpand = button.dataset.expanded !== 'true';
  cards.slice(3).forEach((card) => {
    card.style.display = shouldExpand ? '' : 'none';
  });
  button.dataset.expanded = shouldExpand ? 'true' : 'false';
  button.textContent = shouldExpand ? 'Show Less' : 'Show More';
};

const setupStaffPerformanceToggle = () => {
  const button = $('toggleStaffPerformanceButton');
  const cards = Array.from(document.querySelectorAll('.staff-performance-card'));
  if (!button || !cards.length) return;

  if (cards.length <= 3) {
    button.style.display = 'none';
    return;
  }

  button.style.display = '';
  button.dataset.expanded = 'false';
  button.textContent = 'Show More';
  button.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleStaffPerformanceCards();
  };

  cards.slice(3).forEach((card) => {
    card.style.display = 'none';
  });
};

const clearNotifications = async (userId) => {
  console.log(`clearNotifications(${userId})`);
  clearNotificationsLocal();
};

const clearNotificationsLocal = () => {
  const target = $('notificationsList');
  if (target) {
    renderEmpty(target, 'No notifications.');
  }
};

const registerWorker = async (data) => {
  console.log('registerWorker', data);
  showMessage('Worker registration stub called.');
};

const registerAdmin = async (data) => {
  console.log('registerAdmin', data);
  showMessage('Admin registration stub called.');
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

const formatDate = (iso) => {
  if (!iso) return '-';
  const date = new Date(iso);
  return date.toLocaleDateString();
};

const tagClass = (status) => {
  if (status === 'Approved' || status === 'Accepted') return 'tag';
  if (status === 'Declined' || status === 'Rejected') return 'tag danger';
  if (status === 'Pending') return 'tag warn';
  return 'tag';
};

const jobStatusClass = (status) => {
  if (status === 'Accepted') return 'tag';
  if (status === 'Declined') return 'tag danger';
  return 'tag warn';
};

/* --- Data Visualizations via Canvas --- */
const showChartTooltip = (event, canvas, items, type) => {
  const tooltip = $('chartTooltip');
  if (!tooltip || !canvas) return;

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  let content = '';
  if (type === 'bar') {
    const match = items.find((item) => x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height);
    if (!match) {
      tooltip.hidden = true;
      return;
    }
    content = `<strong>${match.label}</strong><br>${match.value}`;
  } else if (type === 'donut') {
    const match = items.find((item) => {
      const dx = x - item.cx;
      const dy = y - item.cy;
      const distance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const normalized = angle < 0 ? angle + Math.PI * 2 : angle;
      const start = item.startAngle;
      const end = item.endAngle;
      const inSweep = end > start ? normalized >= start && normalized <= end : normalized >= start || normalized <= end;
      return inSweep && distance >= item.innerRadius && distance <= item.radius;
    });
    if (!match) {
      tooltip.hidden = true;
      return;
    }
    content = `<strong>${match.label}</strong><br>${match.count} users (${match.percentage}%)`;
  }

  tooltip.innerHTML = content;
  tooltip.hidden = false;
  tooltip.style.left = `${event.clientX + 14}px`;
  tooltip.style.top = `${event.clientY}px`;
};

const hideChartTooltip = () => {
  const tooltip = $('chartTooltip');
  if (tooltip) {
    tooltip.hidden = true;
  }
};

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

  const tooltipItems = [];
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

    tooltipItems.push({
      x: padding + 80,
      y,
      width: barWidth,
      height: barHeight,
      label: status,
      value: val,
    });
  });

  canvas.dataset.tooltipType = 'bar';
  canvas.dataset.tooltipItems = JSON.stringify(tooltipItems);
  canvas.style.cursor = 'pointer';
  canvas.onmousemove = (event) => showChartTooltip(event, canvas, tooltipItems, 'bar');
  canvas.onmouseleave = hideChartTooltip;
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

  const tooltipItems = [];
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

    const itemStartAngle = startAngle;
    const itemEndAngle = startAngle + sliceAngle;
    tooltipItems.push({
      cx,
      cy,
      radius,
      innerRadius,
      startAngle: itemStartAngle,
      endAngle: itemEndAngle,
      label: item.role,
      count: item.count,
      percentage: ((item.count / total) * 100).toFixed(1),
    });

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

  canvas.dataset.tooltipType = 'donut';
  canvas.dataset.tooltipItems = JSON.stringify(tooltipItems);
  canvas.style.cursor = 'pointer';
  canvas.onmousemove = (event) => showChartTooltip(event, canvas, tooltipItems, 'donut');
  canvas.onmouseleave = hideChartTooltip;
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

  const tooltipItems = [];
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

    tooltipItems.push({
      x,
      y,
      width: barWidth,
      height: barHeight,
      label: item.worker.name,
      value: `₹${item.salary_preview.estimated_amount.toFixed(0)}`,
    });
  });

  canvas.dataset.tooltipType = 'bar';
  canvas.dataset.tooltipItems = JSON.stringify(tooltipItems);
  canvas.style.cursor = 'pointer';
  canvas.onmousemove = (event) => showChartTooltip(event, canvas, tooltipItems, 'bar');
  canvas.onmouseleave = hideChartTooltip;
};

const loadAdminLeaveRequests = async () => {
  const target = $('adminLeaveRequestsContainer');
  const requests = getSharedLeaveRequests();
  if (!requests.length) {
    renderEmpty(target, 'No leave requests available.');
    return;
  }
  const tableRows = requests
    .map((request) => {
      return `
      <tr>
        <td>${request.worker_name}</td>
        <td>${formatDate(request.from_date)}</td>
        <td>${formatDate(request.to_date)}</td>
        <td>${request.remarks || 'No remarks'}</td>
        <td><span class="${tagClass(request.status)}">${request.status}</span></td>
        <td>
          <button class="primary" data-approve-leave="${request.request_id}">Approve</button>
          <button class="danger" data-reject-leave="${request.request_id}">Reject</button>
        </td>
      </tr>`;
    })
    .join('');

  target.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Worker Name</th>
            <th>From</th>
            <th>To</th>
            <th>Remarks</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>`;
};

const approveLeave = async (requestId) => {
  console.log(`approveLeave(${requestId})`);
  const requests = getSharedLeaveRequests().map((request) => {
    if (request.request_id === requestId) {
      return { ...request, status: 'Approved' };
    }
    return request;
  });
  saveSharedLeaveRequests(requests);
  await loadAdminLeaveRequests();
  showMessage('Leave request approved locally.');
};

const rejectLeave = async (requestId) => {
  console.log(`rejectLeave(${requestId})`);
  const requests = getSharedLeaveRequests().map((request) => {
    if (request.request_id === requestId) {
      return { ...request, status: 'Rejected' };
    }
    return request;
  });
  saveSharedLeaveRequests(requests);
  await loadAdminLeaveRequests();
  showMessage('Leave request rejected locally.');
};

const renderAnalyticsCharts = () => {
  if (!state.adminOverviewData) return;
  drawBookingsChart(state.adminOverviewData.booking_counts || []);
  drawUsersChart(state.adminOverviewData.users_by_role || []);
  drawPerformanceChart(state.adminOverviewData.staff_performance || []);
};

const openAnalyticsPanel = () => {
  const panel = $('analyticsPanel');
  const adminView = $('adminView');
  if (!panel || !adminView) return;
  panel.classList.remove('collapsed');
  adminView.classList.add('analytics-active');
  state.analyticsActive = true;
  if (!state.chartsRendered) {
    renderAnalyticsCharts();
    state.chartsRendered = true;
  }
};

const closeAnalyticsPanel = () => {
  const panel = $('analyticsPanel');
  const adminView = $('adminView');
  if (!panel || !adminView) return;
  panel.classList.add('collapsed');
  adminView.classList.remove('analytics-active');
  state.analyticsActive = false;
  hideChartTooltip();
};

const addPdfPageNumber = (doc, pageNumber, totalPages) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
};

const downloadFullAnalyticsReportPdf = async () => {
  if (!state.adminOverviewData) return;

  const button = $('downloadFullAnalyticsButton');
  if (button) {
    button.textContent = 'Generating PDF...';
    button.disabled = true;
  }

  try {
    openAnalyticsPanel();

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const generatedAt = new Date().toLocaleString();

    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('Cleanzy — Analytics Report', margin, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${generatedAt}`, margin, 26);

    const summaryRows = [
      ['Bookings Overview', 'Status counts', (state.adminOverviewData.booking_counts || []).map((item) => `${item.status}: ${item.count}`).join(', ')],
      ['System Users', 'Role counts', (state.adminOverviewData.users_by_role || []).map((item) => `${item.role}: ${item.count}`).join(', ')],
      ['Attendance Total', 'Records', state.adminOverviewData.attendance_count || 0],
      ['Operational Support', 'Complaints / Holiday requests', `${state.adminOverviewData.complaints?.length || 0} complaints · ${state.adminOverviewData.holiday_requests?.length || 0} holiday requests`],
    ];

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Statistics Summary', margin, 36);
    doc.autoTable({
      startY: 40,
      head: [['Section', 'Metric', 'Value']],
      body: summaryRows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 118, 110], textColor: 255 },
      margin: { left: margin, right: margin },
    });

    const staffRows = (state.adminOverviewData.staff_performance || []).map((item) => [
      item.worker?.name || '',
      item.skill_type || '',
      (item.rating || 0).toFixed(1),
      item.confirmed_bookings || 0,
      item.attendance_days || 0,
      `INR ${Number(item.salary_preview?.estimated_amount || 0).toFixed(2)}`,
    ]);
    const recentBookingRows = (state.adminOverviewData.recent_bookings || []).map((item) => [
      item.service?.service_name || '',
      item.status || '',
      new Date(item.scheduled_time).toLocaleString(),
    ]);

    let y = doc.lastAutoTable.finalY + 8;
    if (y > pageHeight - 80) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Staff Performance Details', margin, y);
    doc.autoTable({
      startY: y + 4,
      head: [['Name', 'Skill', 'Rating', 'Confirmed jobs', 'Attendance count', 'Earnings (INR)']],
      body: staffRows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 118, 110], textColor: 255 },
      margin: { left: margin, right: margin },
    });

    y = doc.lastAutoTable.finalY + 8;
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Recent Booking Log', margin, y);
    doc.autoTable({
      startY: y + 4,
      head: [['Service', 'Status', 'DateTime']],
      body: recentBookingRows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 118, 110], textColor: 255 },
      margin: { left: margin, right: margin },
    });

    addPdfPageNumber(doc, 1, 2);

    doc.addPage();
    let chartY = 18;
    const chartElements = [
      { title: 'Booking Status Distribution', element: $('bookingsChart') },
      { title: 'Users by Role', element: $('usersChart') },
      { title: 'Staff Performance & Earnings', element: $('performanceChart') },
    ];

    for (const chart of chartElements) {
      if (chartY > pageHeight - 60) {
        doc.addPage();
        chartY = 18;
      }

      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(chart.title, margin, chartY);
      chartY += 6;

      if (!chart.element) {
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('Chart unavailable', margin, chartY + 10);
        chartY += 24;
        continue;
      }

      try {
        const canvas = await window.html2canvas(chart.element, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false,
          useCORS: true,
        });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - margin * 2;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const maxHeight = pageHeight - chartY - 20;
        const scale = Math.min(1, maxHeight / imgHeight);
        const finalWidth = imgWidth * scale;
        const finalHeight = imgHeight * scale;

        if (finalHeight > 0) {
          doc.addImage(imgData, 'PNG', margin, chartY + 3, finalWidth, finalHeight);
          chartY += finalHeight + 12;
        } else {
          doc.setFontSize(10);
          doc.setTextColor(100);
          doc.text('Chart unavailable', margin, chartY + 10);
          chartY += 24;
        }
      } catch (error) {
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('Chart unavailable', margin, chartY + 10);
        chartY += 24;
      }
    }

    addPdfPageNumber(doc, 2, 2);
    doc.save(`cleanzy-analytics-${Date.now()}.pdf`);
  } finally {
    if (button) {
      button.textContent = 'Download Full Analytics Report (PDF)';
      button.disabled = false;
    }
  }
};

const loadAdminOverview = async () => {
  const data = await api('/api/admin/overview');
  const overview = data.data;
  state.adminOverviewData = overview;

  const bookingMetrics = overview.booking_counts
    .map((item) => `<span class="tag">${item.status}: ${item.count}</span>`)
    .join('');
  const roleMetrics = overview.users_by_role
    .map((item) => `<span class="tag">${item.role}: ${item.count}</span>`)
    .join('');
  const visibleStaffCards = (overview.staff_performance || []).slice(0, 3).map((staff) => renderStaffPerformanceCard(staff)).join('');
  const hiddenStaffCards = (overview.staff_performance || []).slice(3).map((staff) => renderStaffPerformanceCard(staff, true)).join('');
  const staffToggleButton = (overview.staff_performance || []).length > 3 ? '<button id="toggleStaffPerformanceButton" class="secondary" type="button" style="margin-top: 8px;">Show More</button>' : '';
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
      <div class="result-list">${visibleStaffCards || '<p>No staff records.</p>'}${staffToggleButton}${hiddenStaffCards}</div>
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

  setupStaffPerformanceToggle();
};

const processWorkerPayment = (workerId, amount) => {
  // TODO: Razorpay route/payout API.
  console.log(`processWorkerPayment: workerId=${workerId}, amount=${amount}`);
  showMessage(`Mock Payment of INR ${amount.toFixed(2)} processed for worker: ${workerId}`);
  closePayWorkerModal();
};

const openPayWorkerModal = (workerId, workerName, amount) => {
  const modal = $('payWorkerModal');
  const confirmBtn = $('confirmPayWorkerModal');
  const nameEl = $('payWorkerName');
  const amountEl = $('payWorkerAmount');
  if (!modal || !confirmBtn || !nameEl || !amountEl) return;

  nameEl.textContent = workerName;
  amountEl.textContent = money(amount);

  confirmBtn.dataset.workerId = workerId;
  confirmBtn.dataset.amount = amount;

  modal.classList.add('active');
};

const closePayWorkerModal = () => {
  const modal = $('payWorkerModal');
  if (modal) {
    modal.classList.remove('active');
  }
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
  $('downloadFullAnalyticsButton').addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    downloadFullAnalyticsReportPdf().catch((error) => showMessage(error.message, true));
  });
  $('clearNotificationsButton').addEventListener('click', async () => {
    await api('/api/notifications/clear', { method: 'POST', body: { user_id: state.user.user_id } }).catch(() => {});
    await clearNotifications(state.user.user_id);
  });
  $('loadAdminLeaveRequestsButton').addEventListener('click', () => loadAdminLeaveRequests().catch((error) => showMessage(error.message, true)));
  $('toggleAnalyticsButton').addEventListener('click', openAnalyticsPanel);
  $('backToOverviewButton').addEventListener('click', closeAnalyticsPanel);
  $('collapseAnalyticsButton').addEventListener('click', closeAnalyticsPanel);

  $('closePayWorkerModal').addEventListener('click', closePayWorkerModal);
  $('cancelPayWorkerModal').addEventListener('click', closePayWorkerModal);
  $('confirmPayWorkerModal').addEventListener('click', (e) => {
    const workerId = e.target.dataset.workerId;
    const amount = parseFloat(e.target.dataset.amount);
    processWorkerPayment(workerId, amount);
  });

  document.body.addEventListener('click', (event) => {
    const readId = event.target.dataset.read;
    const payWorkerId = event.target.dataset.payWorker;
    const approveId = event.target.dataset.approveLeave;
    const rejectId = event.target.dataset.rejectLeave;
    if (readId) readNotification(readId).catch((error) => showMessage(error.message, true));
    if (payWorkerId) {
      const name = event.target.dataset.workerName;
      const amount = parseFloat(event.target.dataset.amount);
      openPayWorkerModal(payWorkerId, name, amount);
    }
    if (approveId) approveLeave(approveId).catch((error) => showMessage(error.message, true));
    if (rejectId) rejectLeave(rejectId).catch((error) => showMessage(error.message, true));
  });

  $('registerWorkerTab').addEventListener('click', () => {
    $('registerWorkerTab').classList.add('active');
    $('registerAdminTab').classList.remove('active');
    $('registerWorkerForm').style.display = 'block';
    $('registerAdminForm').style.display = 'none';
  });
  $('registerAdminTab').addEventListener('click', () => {
    $('registerAdminTab').classList.add('active');
    $('registerWorkerTab').classList.remove('active');
    $('registerWorkerForm').style.display = 'none';
    $('registerAdminForm').style.display = 'block';
  });
  $('registerWorkerButton').addEventListener('click', async () => {
    const data = {
      name: $('registerWorkerName').value,
      email: $('registerWorkerEmail').value,
      password: $('registerWorkerPassword').value,
      phone: $('registerWorkerPhone').value,
      address: $('registerWorkerAddress').value,
      skill_type: $('registerWorkerSkill').value,
      location_coords: $('registerWorkerCoords').value,
    };
    await registerWorker(data);
  });
  $('registerAdminButton').addEventListener('click', async () => {
    const data = {
      name: $('registerAdminName').value,
      email: $('registerAdminEmail').value,
      password: $('registerAdminPassword').value,
      phone: $('registerAdminPhone').value,
      address: $('registerAdminAddress').value,
    };
    await registerAdmin(data);
  });
};

const init = async () => {
  renderSession();
  drawOpsCanvas();
  wireEvents();
  await loadAdminOverview().catch((error) => showMessage(error.message, true));
  await loadAdminLeaveRequests().catch((error) => showMessage(error.message, true));
  await loadNotifications().catch(() => undefined);
};

init();
