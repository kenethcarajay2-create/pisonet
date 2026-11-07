
const form = document.getElementById('exitForm');
const passwordInput = document.getElementById('password');
const exitButton = document.getElementById('exit');
const cancelButton = document.getElementById('cancel');
const message = document.getElementById('message');

form.addEventListener('submit', async event => {
  event.preventDefault();

  const password = passwordInput.value;

  if (!password) return;

  exitButton.disabled = true;
  cancelButton.disabled = true;
  message.textContent = 'Verifying password...';

  try {
    await window.pisonet.exit(password);
    message.textContent = 'Closing PisoNet Cloud...';
  } catch (error) {
    message.textContent =
      error.message || 'Password verification failed';

    passwordInput.value = '';
    passwordInput.focus();

    exitButton.disabled = false;
    cancelButton.disabled = false;
  }
});

cancelButton.addEventListener('click', async () => {
  try {
    await window.pisonet.cancelExit();
  } catch (error) {
    message.textContent = error.message;
  }
});
