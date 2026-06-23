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

const setSession = (token, user) => {
  state.token = token;
  state.user = user;
  localStorage.setItem('cleanzy_token', token);
  localStorage.setItem('cleanzy_user', JSON.stringify(user));
  // Set cookie for backend route guarding
  document.cookie = `cleanzy_token=${token}; path=/; max-age=86400; SameSite=Strict`;
  renderSession();
};

const updateRegisterVisibility = (role) => {
  const details = $('registerDetails');
  if (!details) return;
  details.style.display = role === 'User' ? 'block' : 'none';
  if (role !== 'User') {
    details.removeAttribute('open');
  }
};

const renderSession = () => {
  const signedIn = Boolean(state.token && state.user);
  if (signedIn) {
    // Redirect based on role immediately
    const role = state.user.role;
    if (role === 'User') {
      window.location.href = '/customer/dashboard';
    } else if (role === 'Worker') {
      window.location.href = '/worker/dashboard';
    } else if (role === 'Administrator') {
      window.location.href = '/admin/dashboard';
    }
  }
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
      updateRegisterVisibility(role);
    });
  });

  const loginButton = $('loginButton');
  if (loginButton) {
    loginButton.addEventListener('click', async () => {
      try {
        const data = await api('/api/auth/login', {
          method: 'POST',
          body: { email: $('emailInput').value, password: $('passwordInput').value },
        });
        setSession(data.token, data.data);
      } catch (error) {
        showMessage(error.message, true);
      }
    });
  }

  const registerButton = $('registerButton');
  if (registerButton) {
    registerButton.addEventListener('click', async () => {
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
  }
};

const init = () => {
  renderSession();
  updateRegisterVisibility($('registerRole').value);
  wireEvents();
};

init();
