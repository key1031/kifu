const STORAGE_KEY = 'kifuHub_accountName';
const DEFAULT_NAME = 'Dok46';

document.addEventListener('DOMContentLoaded', () => {
    const accountNameInput = document.getElementById('settingsAccountName');
    const saveBtn = document.getElementById('saveSettings');
    const statusEl = document.getElementById('settingsStatus');

    accountNameInput.value = localStorage.getItem(STORAGE_KEY) || DEFAULT_NAME;

    saveBtn.addEventListener('click', () => {
        const name = accountNameInput.value.trim();
        if (!name) {
            showStatus('アカウント名を入力してください', 'error');
            return;
        }
        localStorage.setItem(STORAGE_KEY, name);
        showStatus('保存しました', 'success');
    });

    accountNameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') saveBtn.click();
    });

    function showStatus(message, type) {
        statusEl.textContent = message;
        statusEl.className = `settings-status ${type}`;
        clearTimeout(statusEl._timer);
        statusEl._timer = setTimeout(() => {
            statusEl.textContent = '';
            statusEl.className = 'settings-status';
        }, 3000);
    }
});
