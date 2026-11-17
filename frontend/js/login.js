(function () {
  const emailInput = document.getElementById('universityEmail');
  const passInput = document.getElementById('password');
  const emailErrEl = document.getElementById('email-error');
  const passErrEl = document.getElementById('password-error');

  document.addEventListener('click', (e) => {
    const demoBtn = e.target.closest('[data-demo-email]');
    if (demoBtn && emailInput && passInput) {
      emailInput.value = demoBtn.getAttribute('data-demo-email');
      passInput.value = 'StrongPassword123!';
    }
  });

  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailErr = window.Validators.validateUniversityEmail(emailInput.value);
    const passErr = window.Validators.validatePassword(passInput.value);

    if (emailErr) {
      emailErrEl.textContent = emailErr;
      emailErrEl.className = 'mt-1.5 text-xs text-red-600 font-medium';
      return;
    }
    if (passErr) {
      passErrEl.textContent = passErr;
      passErrEl.classList.remove('hidden');
      return;
    }

    await window.AuthService.login({
      universityEmail: emailInput.value.trim(),
      password: passInput.value,
    });
    window.location.href = 'index.html';
  });
})();