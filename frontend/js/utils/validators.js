const ALMAAREFA_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@mcst\.edu\.sa$/i;

window.Validators = {
  validateUniversityEmail(email) {
    const trimmed = (email || '').trim();
    if (!trimmed) return 'University email is required.';
    if (!ALMAAREFA_EMAIL_REGEX.test(trimmed)) {
      return 'Email must belong to the official @mcst.edu.sa domain.';
    }
    return null;
  },

  validatePassword(password) {
    if (!password) return 'Password is required.';
    if (password.length < 8) return 'Password must be at least 8 characters long.';
    return null;
  },

  validateStudentId(studentId) {
    const trimmed = (studentId || '').trim();
    if (!trimmed) return 'Student ID is required.';
    if (!/^\d{7,10}$/.test(trimmed)) {
      return 'Student ID must be 7 to 10 digits (e.g., 202110234).';
    }
    return null;
  },

  getInitials(fullName) {
    return (fullName || '')
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  },

  pluralize(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
  },

  formatShortDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  formatEventDate(iso) {
    return new Date(iso).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  },

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },
};