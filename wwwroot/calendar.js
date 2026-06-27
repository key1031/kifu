document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'kifuHub_practice';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let viewYear = today.getFullYear();
    let viewMonth = today.getMonth();

    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    const todayBtn = document.getElementById('todayBtn');
    const currentMonthLabel = document.getElementById('currentMonthLabel');
    const calendarGrid = document.getElementById('calendarGrid');

    const totalTsumeEl = document.getElementById('totalTsume');
    const totalNextMoveEl = document.getElementById('totalNextMove');
    const recordDaysEl = document.getElementById('recordDays');
    const avgTotalEl = document.getElementById('avgTotal');

    const modal = document.getElementById('practiceModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalTsumeInput = document.getElementById('modalTsume');
    const modalNextMoveInput = document.getElementById('modalNextMove');
    const modalSaveBtn = document.getElementById('modalSave');
    const modalCancelBtn = document.getElementById('modalCancel');
    const modalDeleteBtn = document.getElementById('modalDelete');
    const modalCloseBtn = document.getElementById('modalClose');

    let selectedDateKey = null;

    // ─── データ操作 ───────────────────────────────────────────────
    function getData() {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    }

    function setData(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function toDateKey(year, month, day) {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    function todayKey() {
        return toDateKey(today.getFullYear(), today.getMonth(), today.getDate());
    }

    // ─── レンダリング ─────────────────────────────────────────────
    function render() {
        currentMonthLabel.textContent = `${viewYear}年${viewMonth + 1}月`;
        const isCurrent = viewYear === today.getFullYear() && viewMonth === today.getMonth();
        todayBtn.style.visibility = isCurrent ? 'hidden' : 'visible';
        renderCalendar();
        renderSummary();
    }

    function renderSummary() {
        const data = getData();
        const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-`;
        let totalTsume = 0, totalNextMove = 0, recordDays = 0;

        Object.entries(data).forEach(([key, val]) => {
            if (!key.startsWith(prefix)) return;
            const t = val.tsume || 0;
            const n = val.nextMove || 0;
            if (t > 0 || n > 0) {
                recordDays++;
                totalTsume += t;
                totalNextMove += n;
            }
        });

        totalTsumeEl.textContent = totalTsume;
        totalNextMoveEl.textContent = totalNextMove;
        recordDaysEl.textContent = recordDays;
        const avgTotal = recordDays > 0 ? ((totalTsume + totalNextMove) / recordDays).toFixed(1) : '0.0';
        avgTotalEl.textContent = avgTotal;
    }

    function renderCalendar() {
        const data = getData();
        calendarGrid.innerHTML = '';

        const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

        // 前月の埋め草
        for (let i = firstWeekday - 1; i >= 0; i--) {
            calendarGrid.appendChild(makeCell(viewYear, viewMonth - 1, prevMonthDays - i, true, data));
        }

        // 当月
        for (let d = 1; d <= daysInMonth; d++) {
            calendarGrid.appendChild(makeCell(viewYear, viewMonth, d, false, data));
        }

        // 翌月の埋め草
        const total = calendarGrid.children.length;
        const trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
        for (let d = 1; d <= trailing; d++) {
            calendarGrid.appendChild(makeCell(viewYear, viewMonth + 1, d, true, data));
        }
    }

    function makeCell(year, month, day, isOther, data) {
        const date = new Date(year, month, day);
        const y = date.getFullYear();
        const m = date.getMonth();
        const d = date.getDate();
        const key = toDateKey(y, m, d);
        const isToday = key === todayKey();
        const rec = data[key];
        const hasRecord = rec && (rec.tsume > 0 || rec.nextMove > 0);

        const weekday = date.getDay();
        const isSun = weekday === 0;
        const isSat = weekday === 6;

        const cell = document.createElement('div');
        cell.className = [
            'cal-day',
            isOther ? 'other-month' : '',
            isToday ? 'today' : '',
            hasRecord ? 'has-record' : '',
        ].filter(Boolean).join(' ');

        cell.innerHTML = `
            <span class="day-num ${isSun ? 'sun' : isSat ? 'sat' : ''}">${d}</span>
            ${hasRecord
                ? `<div class="day-record">
                       <span class="rec-tsume"><i class="fa-solid fa-chess-king rec-icon"></i>${rec.tsume || 0}</span>
                       <span class="rec-next"><i class="fa-solid fa-chess-pawn rec-icon"></i>${rec.nextMove || 0}</span>
                   </div>`
                : `<div class="day-empty">${isOther ? '' : '<i class="fa-solid fa-plus day-add-icon"></i>'}</div>`
            }
        `;

        if (!isOther) {
            cell.addEventListener('click', () => openModal(key, y, m, d));
        }

        return cell;
    }

    // ─── モーダル ─────────────────────────────────────────────────
    function openModal(key, year, month, day) {
        const rec = getData()[key] || { tsume: 0, nextMove: 0 };
        selectedDateKey = key;
        modalTitle.textContent = `${year}年${month + 1}月${day}日`;
        modalTsumeInput.value = rec.tsume || 0;
        modalNextMoveInput.value = rec.nextMove || 0;
        modalDeleteBtn.style.display = (rec.tsume > 0 || rec.nextMove > 0) ? '' : 'none';
        modal.classList.add('open');
        modalTsumeInput.focus();
        modalTsumeInput.select();
    }

    function closeModal() {
        modal.classList.remove('open');
        selectedDateKey = null;
    }

    modalSaveBtn.addEventListener('click', () => {
        if (!selectedDateKey) return;
        const tsume = Math.max(0, parseInt(modalTsumeInput.value) || 0);
        const nextMove = Math.max(0, parseInt(modalNextMoveInput.value) || 0);
        const data = getData();
        data[selectedDateKey] = { tsume, nextMove };
        setData(data);
        closeModal();
        render();
    });

    modalDeleteBtn.addEventListener('click', () => {
        if (!selectedDateKey || !confirm('この日の記録を削除しますか？')) return;
        const data = getData();
        delete data[selectedDateKey];
        setData(data);
        closeModal();
        render();
    });

    [modalCancelBtn, modalCloseBtn].forEach(el => el.addEventListener('click', closeModal));

    modal.addEventListener('click', e => {
        if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', e => {
        if (!modal.classList.contains('open')) return;
        if (e.key === 'Escape') closeModal();
        if (e.key === 'Enter' && document.activeElement !== modalDeleteBtn) modalSaveBtn.click();
    });

    // ステッパーボタン（＋ / −）
    document.querySelectorAll('.stepper-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.target);
            const delta = parseInt(btn.dataset.delta);
            input.value = Math.max(0, (parseInt(input.value) || 0) + delta);
        });
    });

    // ─── ナビゲーション ───────────────────────────────────────────
    prevMonthBtn.addEventListener('click', () => {
        viewMonth--;
        if (viewMonth < 0) { viewMonth = 11; viewYear--; }
        render();
    });

    nextMonthBtn.addEventListener('click', () => {
        viewMonth++;
        if (viewMonth > 11) { viewMonth = 0; viewYear++; }
        render();
    });

    todayBtn.addEventListener('click', () => {
        viewYear = today.getFullYear();
        viewMonth = today.getMonth();
        render();
    });

    render();
});
