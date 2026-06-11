document.addEventListener('DOMContentLoaded', () => {
    const totalGamesEl = document.getElementById('totalGames');
    const winCountEl = document.getElementById('winCount');
    const lossCountEl = document.getElementById('lossCount');
    const winRateEl = document.getElementById('winRate');
    const gameTypeTableBody = document.querySelector('#gameTypeTable tbody');
    const opponentStrategyTableBody = document.querySelector('#opponentStrategyTable tbody');
    const monthlyTableBody = document.querySelector('#monthlyTable tbody');

    async function loadAnalysis() {
        try {
            const response = await fetch('/api/kifu');
            if (!response.ok) {
                throw new Error('棋譜データの取得に失敗しました');
            }
            const data = await response.json();
            renderAnalysis(data);
        } catch (error) {
            console.error(error);
            totalGamesEl.textContent = '0';
            winCountEl.textContent = '0';
            lossCountEl.textContent = '0';
            winRateEl.textContent = '0%';
        }
    }

    function renderAnalysis(data) {
        const total = data.length;
        const wins = data.filter(item => item.result === '勝ち').length;
        const losses = data.filter(item => item.result === '負け').length;
        const rate = total > 0 ? Math.round((wins / total) * 100) : 0;

        totalGamesEl.textContent = total;
        winCountEl.textContent = wins;
        lossCountEl.textContent = losses;
        winRateEl.textContent = `${rate}%`;

        renderCategoryTable(data, 'gameType', gameTypeTableBody);
        renderCategoryTable(data, 'opponentStrategy', opponentStrategyTableBody);
        renderMonthlyTable(data, monthlyTableBody);
    }

    function renderMonthlyTable(data, tbody) {
        const grouped = data.reduce((acc, item) => {
            const month = getMonthKey(item.matchDate);
            if (!acc[month]) {
                acc[month] = { count: 0, win: 0 };
            }
            acc[month].count += 1;
            if (item.result === '勝ち') {
                acc[month].win += 1;
            }
            return acc;
        }, {});

        const rows = Object.entries(grouped)
            .map(([month, stats]) => ({
                month,
                count: stats.count,
                winRate: stats.count > 0 ? Math.round((stats.win / stats.count) * 100) : 0
            }))
            .sort((a, b) => (a.month < b.month ? 1 : -1));

        tbody.innerHTML = '';
        if (rows.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="3" style="text-align:center; color:#d0c3a5;">登録された対局データがありません。</td>';
            tbody.appendChild(tr);
            return;
        }

        rows.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHtml(row.month)}</td>
                <td>${row.count}</td>
                <td>${row.winRate}%</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function getMonthKey(value) {
        if (!value) {
            return '未設定';
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return '未設定';
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}年${month}月`;
    }

    function renderCategoryTable(data, key, tbody) {
        const grouped = data.reduce((acc, item) => {
            const category = item[key] || '未設定';
            if (!acc[category]) {
                acc[category] = { count: 0, win: 0 };
            }
            acc[category].count += 1;
            if (item.result === '勝ち') {
                acc[category].win += 1;
            }
            return acc;
        }, {});

        const rows = Object.entries(grouped)
            .map(([category, stats]) => ({
                category,
                count: stats.count,
                winRate: stats.count > 0 ? Math.round((stats.win / stats.count) * 100) : 0
            }))
            .sort((a, b) => b.count - a.count);

        tbody.innerHTML = '';
        if (rows.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="3" style="text-align:center; color:#d0c3a5;">登録された対局データがありません。</td>';
            tbody.appendChild(tr);
            return;
        }

        rows.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHtml(row.category)}</td>
                <td>${row.count}</td>
                <td>${row.winRate}%</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function escapeHtml(text) {
        if (typeof text !== 'string') return text;
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    loadAnalysis();
});
