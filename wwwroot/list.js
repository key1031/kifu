document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('kifuTableBody');
    const noDataMessage = document.getElementById('noDataMessage');
    const kifuTable = document.getElementById('kifuTable');
    
    // 検索入力フィールド
    const filterOpponent = document.getElementById('filterOpponent');
    const filterMyStrategy = document.getElementById('filterMyStrategy');
    const filterOpponentStrategy = document.getElementById('filterOpponentStrategy');

    let allKifuData = [];
    let currentSortColumn = '';
    let isAscending = true;

    // 初期データ取得
    loadKifuData();

    const unanalyzedFilter = document.getElementById('unanalyzedFilter');

    // フィルターのイベントリスナー
    [filterOpponent, filterMyStrategy, filterOpponentStrategy].forEach(input => {
        input.addEventListener('input', () => {
            renderTable();
        });
    });
    unanalyzedFilter.addEventListener('change', renderTable);

    // ソートヘッダーのクリックイベント
    kifuTable.querySelectorAll('thead th').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-sort');
            if (currentSortColumn === column) {
                isAscending = !isAscending;
            } else {
                currentSortColumn = column;
                isAscending = true;
            }

            // ヘッダークラスの付け替え
            kifuTable.querySelectorAll('thead th').forEach(h => {
                h.classList.remove('sorted-asc', 'sorted-desc');
                const icon = h.querySelector('i');
                if (icon) icon.className = 'fa-solid fa-sort';
            });

            th.classList.add(isAscending ? 'sorted-asc' : 'sorted-desc');
            const currentIcon = th.querySelector('i');
            if (currentIcon) {
                currentIcon.className = isAscending ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
            }

            sortData(column, isAscending);
            renderTable();
        });
    });

    // データ読み込み
    async function loadKifuData() {
        try {
            const response = await fetch('/api/kifu');
            if (response.ok) {
                allKifuData = await response.json();
                renderTable();
            } else {
                console.error('Failed to fetch kifu data');
            }
        } catch (err) {
            console.error('Error connecting to API:', err);
        }
    }

    // データのソート
    function sortData(column, asc) {
        allKifuData.sort((a, b) => {
            let valA = a[column];
            let valB = b[column];

            // 日付カラムは日付として比較（YYYY-MM-DD など）
            if (column === 'matchDate') {
                valA = valA ? Date.parse(valA) || 0 : 0;
                valB = valB ? Date.parse(valB) || 0 : 0;
            // 数値変換チェック
            } else if (column === 'moves' || column === 'badMoveRate' || column === 'questionableMoveRate') {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            } else {
                valA = (valA || '').toString().toLowerCase();
                valB = (valB || '').toString().toLowerCase();
            }

            if (valA < valB) return asc ? -1 : 1;
            if (valA > valB) return asc ? 1 : -1;
            return 0;
        });
    }

    // テーブルの描画
    function renderTable() {
        tableBody.innerHTML = '';

        const oppVal = filterOpponent.value.trim().toLowerCase();
        const myStratVal = filterMyStrategy.value.trim().toLowerCase();
        const oppStratVal = filterOpponentStrategy.value.trim().toLowerCase();

        const unanalyzedOnly = unanalyzedFilter.checked;

        const filtered = allKifuData.filter(kifu => {
            const matchOpp = (kifu.opponent || '').toLowerCase().includes(oppVal);
            const matchMyStrat = (kifu.myStrategy || '').toLowerCase().includes(myStratVal);
            const matchOppStrat = (kifu.opponentStrategy || '').toLowerCase().includes(oppStratVal);
            const matchUnanalyzed = !unanalyzedOnly || !(kifu.comment && kifu.comment.trim());
            return matchOpp && matchMyStrat && matchOppStrat && matchUnanalyzed;
        });

        if (filtered.length === 0) {
            noDataMessage.style.display = 'block';
            kifuTable.style.display = 'none';
            return;
        }

        noDataMessage.style.display = 'none';
        kifuTable.style.display = 'table';

        filtered.forEach(kifu => {
            const tr = document.createElement('tr');
            
            // 勝敗に応じたクラス名判定
            let statusClass = 'draw';
            if (kifu.result === '勝ち') statusClass = 'win';
            if (kifu.result === '負け') statusClass = 'loss';

            const badRateClass = getRateClass(kifu.badMoveRate);
            const questRateClass = getRateClass(kifu.questionableMoveRate);

            tr.innerHTML = `
                <td><span class="kifu-type">${escapeHtml(kifu.gameType)}</span></td>
                <td><strong>${escapeHtml(kifu.opponent)}</strong></td>
                <td>${escapeHtml(kifu.accountName || '')}</td>
                <td><span class="status-badge ${statusClass}">${escapeHtml(kifu.result)}</span></td>
                <td><span class="kifu-turn">${escapeHtml(kifu.turn)}</span></td>
                <td>${escapeHtml(kifu.myStrategy)}</td>
                <td>${escapeHtml(kifu.opponentStrategy)}</td>
                <td>${escapeHtml(kifu.endReason)}</td>
                    <td>${kifu.moves}手</td>
                    <td>${escapeHtml(kifu.matchDate || '')}</td>
                <td><span class="${badRateClass}">${kifu.badMoveRate}%</span></td>
                <td><span class="${questRateClass}">${kifu.questionableMoveRate}%</span></td>
                <td>${escapeHtml(kifu.comment || '')}</td>
                <td>
                    ${kifu.kifFilePath ? `<button class="table-download" data-id="${kifu.id}" title="KIFファイルをダウンロード"><i class="fa-solid fa-download"></i></button>` : '<span class="no-kif-icon" title="KIFファイルなし">—</span>'}
                    <button class="table-edit" data-id="${kifu.id}">編集</button>
                    <button class="table-delete" data-id="${kifu.id}">削除</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // ダウンロードボタン
        document.querySelectorAll('.table-download').forEach(btn => {
            btn.addEventListener('click', () => {
                window.location.href = `/api/kifu/${btn.getAttribute('data-id')}/download`;
            });
        });

        // テーブルの編集・削除ボタン
        document.querySelectorAll('.table-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                // index.html に編集クエリで遷移
                window.location.href = `index.html?edit=${id}`;
            });
        });

        document.querySelectorAll('.table-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (!confirm('この棋譜を削除してよろしいですか？')) return;
                try {
                    const resp = await fetch(`/api/kifu/${id}`, { method: 'DELETE' });
                    if (resp.ok) {
                        // 再読み込み
                        loadKifuData();
                    } else {
                        console.error('Failed to delete');
                    }
                } catch (e) {
                    console.error(e);
                }
            });
        });
    }

    function getRateClass(rate) {
        if (rate >= 15) return 'rate-danger';
        if (rate >= 7) return 'rate-warning';
        return 'rate-good';
    }

    function escapeHtml(str) {
        if (typeof str !== 'string') return str;
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
});
