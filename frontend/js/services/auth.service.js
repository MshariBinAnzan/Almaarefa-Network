const TOKEN_STORAGE_KEYS = {
  ACCESS_TOKEN: 'almaarefa_access_token',
  REFRESH_TOKEN: 'almaarefa_refresh_token',
  USER: 'almaarefa_user',
};

window.AuthService = {
  TOKEN_STORAGE_KEYS,

  getCurrentUser() {
    try {
      const storedUser = localStorage.getItem(TOKEN_STORAGE_KEYS.USER);
      const token = localStorage.getItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
      if (storedUser && token) {
        return JSON.parse(storedUser);
      }
      // Default to Verified Student in Mock Mode on first visit
      const defaultUser = window.AlmaarefaData.MOCK_USERS.studentVerified;
      localStorage.setItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN, 'mock-jwt-access-token-' + Date.now());
      localStorage.setItem(TOKEN_STORAGE_KEYS.USER, JSON.stringify(defaultUser));
      return defaultUser;
    } catch {
      return window.AlmaarefaData.MOCK_USERS.studentVerified;
    }
  },

  async login({ universityEmail, password }) {
    await new Promise((r) => setTimeout(r, 350));
    const emailErr = window.Validators.validateUniversityEmail(universityEmail);
    if (emailErr) {
      throw {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid university email format or credentials.',
          details: [{ field: 'universityEmail', issue: emailErr }],
        },
      };
    }

    const emailLower = universityEmail.trim().toLowerCase();
    const users = window.AlmaarefaData.MOCK_USERS;
    let matchedUser = users.studentVerified;

    if (emailLower.includes('admin')) {
      matchedUser = users.admin;
    } else if (emailLower.includes('leader')) {
      matchedUser = users.clubLeader;
    } else if (emailLower.includes('new')) {
      matchedUser = users.studentUnverified;
    } else {
      matchedUser = { ...users.studentVerified, universityEmail: emailLower };
    }

    localStorage.setItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN, 'mock-jwt-access-token-' + Date.now());
    localStorage.setItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN, 'mock-jwt-refresh-token-' + Date.now());
    localStorage.setItem(TOKEN_STORAGE_KEYS.USER, JSON.stringify(matchedUser));
    return matchedUser;
  },

  async register(payload) {
    await new Promise((r) => setTimeout(r, 400));
    const dept = window.AlmaarefaData.MOCK_DEPARTMENTS.find(
      (d) => d.departmentId === payload.departmentId
    );
    const username = payload.universityEmail.split('@')[0].toLowerCase();

    const newAuthUser = {
      userId: 'new-user-' + Date.now(),
      universityEmail: payload.universityEmail.trim().toLowerCase(),
      role: 'STUDENT',
      emailVerified: false,
      isVerified: false,
      profile: {
        fullName: payload.fullName.trim(),
        studentId: payload.studentId.trim(),
        username,
        departmentId: payload.departmentId,
        departmentName: dept ? dept.name : 'Computer Science',
        avatarUrl: null,
      },
    };

    localStorage.setItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN, 'mock-jwt-access-token-' + Date.now());
    localStorage.setItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN, 'mock-jwt-refresh-token-' + Date.now());
    localStorage.setItem(TOKEN_STORAGE_KEYS.USER, JSON.stringify(newAuthUser));
    return newAuthUser;
  },

  switchMockPersona(personaKey) {
    const selected = window.AlmaarefaData.MOCK_USERS[personaKey];
    if (!selected) return null;
    localStorage.setItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN, 'mock-jwt-access-token-' + Date.now());
    localStorage.setItem(TOKEN_STORAGE_KEYS.USER, JSON.stringify(selected));
    return selected;
  },

  logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(TOKEN_STORAGE_KEYS.USER);
    window.location.href = 'login.html';
  },
};