document.addEventListener('DOMContentLoaded', () => {
    const totalGamesEl = document.getElementById('totalGames');
    const winCountEl = document.getElementById('winCount');
    const lossCountEl = document.getElementById('lossCount');
    const winRateEl = document.getElementById('winRate');
    const filterResultLabelEl = document.getElementById('filterResultLabel');

    const monthFilterEl = document.getElementById('monthFilter');
    const gameTypeFilterEl = document.getElementById('gameTypeFilter');
    const turnFilterEl = document.getElementById('turnFilter');
    const myStrategyFilterEl = document.getElementById('myStrategyFilter');
    const opponentStrategyFilterEl = document.getElementById('opponentStrategyFilter');

    const gameTypeSectionEl = document.getElementById('gameTypeSection');
    const myStrategySectionEl = document.getElementById('myStrategySection');
    const opponentStrategySectionEl = document.getElementById('opponentStrategySection');

    const gameTypeTableBody = document.querySelector('#gameTypeTable tbody');
    const myStrategyTableBody = document.querySelector('#myStrategyTable tbody');
    const opponentStrategyTableBody = document.querySelector('#opponentStrategyTable tbody');
    const endReasonTableBody = document.querySelector('#endReasonTable tbody');

    let allData = [];

    async function loadAnalysis() {
        try {
            const response = await fetch('/api/kifu');
            if (!response.ok) throw new Error('棋譜データの取得に失敗しました');
            allData = await response.json();
            populateFilters(allData);
            applyFilters();
        } catch (error) {
            console.error(error);
        }
    }

    [monthFilterEl, gameTypeFilterEl, turnFilterEl, myStrategyFilterEl, opponentStrategyFilterEl].forEach(el => {
        el.addEventListener('change', applyFilters);
    });

    function applyFilters() {
        const month = monthFilterEl.value;
        const gameType = gameTypeFilterEl.value;
        const turn = turnFilterEl.value;
        const myStrategy = myStrategyFilterEl.value;
        const opponentStrategy = opponentStrategyFilterEl.value;

        const filtered = allData.filter(item => {
            if (month && getMonthKey(item.matchDate) !== month) return false;
            if (gameType && item.gameType !== gameType) return false;
            if (turn && item.turn !== turn) return false;
            if (myStrategy && item.myStrategy !== myStrategy) return false;
            if (opponentStrategy && item.opponentStrategy !== opponentStrategy) return false;
            return true;
        });

        updateFilterLabel(filtered.length, allData.length);

        gameTypeSectionEl.style.display = gameType ? 'none' : '';
        myStrategySectionEl.style.display = myStrategy ? 'none' : '';
        opponentStrategySectionEl.style.display = opponentStrategy ? 'none' : '';

        renderAnalysis(filtered);
    }

    function updateFilterLabel(filteredCount, totalCount) {
        const activeFilters = [
            monthFilterEl, gameTypeFilterEl, turnFilterEl,
            myStrategyFilterEl, opponentStrategyFilterEl
        ].filter(el => el.value !== '').length;

        if (activeFilters === 0) {
            filterResultLabelEl.textContent = '';
        } else {
            filterResultLabelEl.textContent =
                `${activeFilters}件の絞り込み条件 ／ ${totalCount}局中 ${filteredCount}局が対象`;
        }
    }

    function populateFilters(data) {
        populateSelectFilter(monthFilterEl, '全期間',
            [...new Set(data.map(d => getMonthKey(d.matchDate)).filter(m => m !== '未設定'))]
                .sort((a, b) => b.localeCompare(a))
        );
        populateSelectFilter(gameTypeFilterEl, 'すべて',
            [...new Set(data.map(d => d.gameType).filter(Boolean))].sort()
        );
        populateSelectFilter(myStrategyFilterEl, 'すべて',
            [...new Set(data.map(d => d.myStrategy).filter(Boolean))].sort()
        );
        populateSelectFilter(opponentStrategyFilterEl, 'すべて',
            [...new Set(data.map(d => d.opponentStrategy).filter(Boolean))].sort()
        );
    }

    function populateSelectFilter(selectEl, defaultLabel, values) {
        const current = selectEl.value;
        selectEl.innerHTML = `<option value="">${defaultLabel}</option>`;
        values.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v;
            selectEl.appendChild(opt);
        });
        if (values.includes(current)) selectEl.value = current;
    }

    function renderAnalysis(data) {
        const total = data.length;
        const wins = data.filter(d => d.result === '勝ち').length;
        const losses = data.filter(d => d.result === '負け').length;
        const rate = total > 0 ? Math.round((wins / total) * 100) : 0;

        totalGamesEl.textContent = total;
        winCountEl.textContent = wins;
        lossCountEl.textContent = losses;
        winRateEl.textContent = `${rate}%`;

        renderCategoryTable(data, 'gameType', gameTypeTableBody);
        renderCategoryTable(data, 'myStrategy', myStrategyTableBody);
        renderCategoryTable(data, 'opponentStrategy', opponentStrategyTableBody);
        renderEndReasonTable(data, endReasonTableBody);
    }

    function renderCategoryTable(data, key, tbody) {
        const grouped = data.reduce((acc, item) => {
            const cat = item[key] || '未設定';
            if (!acc[cat]) acc[cat] = { count: 0, win: 0 };
            acc[cat].count++;
            if (item.result === '勝ち') acc[cat].win++;
            return acc;
        }, {});

        const rows = Object.entries(grouped)
            .map(([cat, s]) => ({
                cat,
                count: s.count,
                winRate: s.count > 0 ? Math.round((s.win / s.count) * 100) : 0
            }))
            .sort((a, b) => b.count - a.count);

        tbody.innerHTML = '';
        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#d0c3a5;">該当データがありません。</td></tr>';
            return;
        }
        rows.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHtml(row.cat)}</td>
                <td>${row.count}局</td>
                <td>${row.winRate}%</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderEndReasonTable(data, tbody) {
        const total = data.length;
        const grouped = data.reduce((acc, item) => {
            const reason = item.endReason || '未設定';
            acc[reason] = (acc[reason] || 0) + 1;
            return acc;
        }, {});

        const rows = Object.entries(grouped)
            .map(([reason, count]) => ({
                reason,
                count,
                percent: total > 0 ? Math.round((count / total) * 100) : 0
            }))
            .sort((a, b) => b.count - a.count);

        tbody.innerHTML = '';
        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#d0c3a5;">該当データがありません。</td></tr>';
            return;
        }
        rows.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHtml(row.reason)}</td>
                <td>${row.count}局</td>
                <td>
                    <div class="rate-bar-container">
                        <div class="rate-bar-track">
                            <div class="rate-bar" style="width:${row.percent}%"></div>
                        </div>
                        <span class="rate-bar-label">${row.percent}%</span>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function getMonthKey(value) {
        if (!value) return '未設定';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '未設定';
        return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月`;
    }

    function escapeHtml(text) {
        if (typeof text !== 'string') return text;
        return text
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    loadAnalysis();
});
