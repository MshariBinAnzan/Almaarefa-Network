(function () {
  const deptSelect = document.getElementById('departmentId');
  const errBox = document.getElementById('reg-error');

  if (deptSelect) {
    deptSelect.innerHTML = window.AlmaarefaData.MOCK_DEPARTMENTS.map(
      (d) => `<option value="${d.departmentId}">${d.name} (${d.code})</option>`
    ).join('');
  }

  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('fullName').value.trim();
    const studentId = document.getElementById('studentId').value.trim();
    const departmentId = deptSelect.value;
    const universityEmail = document.getElementById('universityEmail').value.trim();
    const password = document.getElementById('password').value;

    const err =
      (!fullName ? 'Full name is required.' : null) ||
      window.Validators.validateStudentId(studentId) ||
      window.Validators.validateUniversityEmail(universityEmail) ||
      window.Validators.validatePassword(password);

    if (err) {
      errBox.textContent = err;
      errBox.classList.remove('hidden');
      return;
    }

    await window.AuthService.register({
      fullName,
      studentId,
      departmentId,
      universityEmail,
      password,
    });
    window.location.href = 'index.html';
  });
})();