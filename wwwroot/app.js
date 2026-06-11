document.addEventListener('DOMContentLoaded', () => {
    const kifuForm = document.getElementById('kifuForm');
    const kifuList = document.getElementById('kifuList');
    const kifuCount = document.getElementById('kifuCount');
    const searchFilter = document.getElementById('searchFilter');

    // フォーム入力要素
    const fields = [
        'gameType', 'opponent', 'accountName', 'result', 'turn', 
        'myStrategy', 'opponentStrategy', 'endReason', 
        'moves', 'badMoveRate', 'questionableMoveRate', 'comment', 'matchDate'
    ];
    const requiredFields = [
        'gameType', 'opponent', 'accountName', 'result', 'turn',
        'myStrategy', 'opponentStrategy', 'endReason', 'moves', 'matchDate'
    ];

    const kifuIdInput = document.getElementById('kifuId');
    const accountNameInput = document.getElementById('accountName');
    const matchDateInput = document.getElementById('matchDate');
    const fileInput = document.getElementById('kifFile');
    const currentKifFile = document.getElementById('currentKifFile');

    let allKifuData = [];

    fileInput.addEventListener('change', handleKifFileSelect);

    // 初期データロード
    loadKifuData().then(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.has('edit')) {
            const id = params.get('edit');
            const k = allKifuData.find(x => String(x.id) === String(id));
            if (k) populateFormForEdit(k);
            history.replaceState({}, '', window.location.pathname);
        }
    });
    matchDateInput.value = new Date().toISOString().slice(0, 10);

    // フォーム送信イベント
    kifuForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
            if (validateForm()) {
                const formData = new FormData(kifuForm);
 
             try {
                 const editId = kifuIdInput.value && kifuIdInput.value.trim() !== '' ? kifuIdInput.value.trim() : null;
                 const url = editId ? `/api/kifu/${editId}` : '/api/kifu';
                 const method = editId ? 'PUT' : 'POST';
 
                 const response = await fetch(url, {
                     method,
                     body: formData
                });

                if (response.ok) {
                    showToast(editId ? '棋譜を更新しました' : '棋譜を正常に記録しました', 'success');
                    kifuForm.reset();
                    clearErrors();
                    kifuIdInput.value = '';
                    loadKifuData();
                } else {
                    const errorText = await response.text();
                    showToast(`エラー: ${errorText}`, 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('サーバーとの通信に失敗しました', 'error');
            }
        }
    });

    // 検索入力イベント
    searchFilter.addEventListener('input', () => {
        renderKifuList(searchFilter.value);
    });

    // バリデーション処理
    function validateForm() {
        let isValid = true;
        clearErrors();

        requiredFields.forEach(field => {
            const element = document.getElementById(field);
            const errorElement = document.getElementById(`${field}Error`);
            
                if (!element.value || element.value.trim() === '') {
                    errorElement.textContent = 'この項目は必須です。';
                    isValid = false;
            } else if (element.type === 'number') {
                const val = parseFloat(element.value);
                if (isNaN(val)) {
                    errorElement.textContent = '数値を入力してください。';
                    isValid = false;
                } else if (field === 'moves' && val <= 0) {
                    errorElement.textContent = '手数は1手以上を指定してください。';
                    isValid = false;
                } else if ((field === 'badMoveRate' || field === 'questionableMoveRate') && (val < 0 || val > 100)) {
                    errorElement.textContent = '0から100の間で指定してください。';
                    isValid = false;
                }
            }
        });

        if (!matchDateInput.value) {
            document.getElementById('matchDateError').textContent = '対局日を入力してください。';
            isValid = false;
        }

if (fileInput.files.length > 0) {
            const filename = fileInput.files[0].name.toLowerCase();
            if (!filename.endsWith('.kif')) {
                document.getElementById('kifFileError').textContent = '拡張子 .kif のファイルを選択してください。';
                isValid = false;
            }
        }
 
        return isValid;
     }
 
     // エラー表示クリア
     function clearErrors() {
        fields.forEach(field => {
             document.getElementById(`${field}Error`).textContent = '';
         });
        document.getElementById('matchDateError').textContent = '';
         document.getElementById('kifFileError').textContent = '';
    }

    // APIからデータ取得
    async function loadKifuData() {
        try {
            const response = await fetch('/api/kifu');
            if (response.ok) {
                allKifuData = await response.json();
                renderKifuList();
            } else {
                console.error('Failed to load kifu data');
            }
        } catch (err) {
            console.error('Error connecting to API:', err);
        }
    }

    // 棋譜一覧のレンダリング
    function renderKifuList(filterText = '') {
        kifuList.innerHTML = '';
        
        const filtered = allKifuData.filter(kifu => {
            return kifu.opponent.toLowerCase().includes(filterText.toLowerCase());
        });

        kifuCount.textContent = filtered.length;

        if (filtered.length === 0) {
            kifuList.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-hourglass-empty empty-icon"></i>
                    <p>${filterText ? '該当する棋譜が見つかりません。' : '登録された棋譜はありません。新しい対局を記録してください。'}</p>
                </div>
            `;
            return;
        }

        // 最新のものを上にするために逆順にする
        const displayData = [...filtered].reverse();

        displayData.forEach(kifu => {
            const card = document.createElement('div');
            card.className = 'kifu-card';
            
            // 勝敗に応じたクラス名判定
            let statusClass = 'draw';
            if (kifu.result === '勝ち') statusClass = 'win';
            if (kifu.result === '負け') statusClass = 'loss';

            // 悪手率・疑問手率の評価クラス判定
            const badRateClass = getRateClass(kifu.badMoveRate);
            const questRateClass = getRateClass(kifu.questionableMoveRate);

            card.innerHTML = `
                <div class="kifu-card-top">
                    <div class="kifu-meta">
                        <span class="kifu-type">${escapeHtml(kifu.gameType)}</span>
                        <span class="kifu-turn">${escapeHtml(kifu.turn)}</span>
                    </div>
                    <span class="status-badge ${statusClass}">${escapeHtml(kifu.result)}</span>
                </div>
                <div class="kifu-versus">
                    <span>VS ${escapeHtml(kifu.opponent)}</span>
                </div>
                <div class="kifu-details">
                    <div class="detail-item">
                        <span class="detail-label">自戦型</span>
                        <span class="detail-value">${escapeHtml(kifu.myStrategy)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">対戦型</span>
                        <span class="detail-value">${escapeHtml(kifu.opponentStrategy)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">手数</span>
                        <span class="detail-value">${kifu.moves}手</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">終局理由</span>
                        <span class="detail-value">${escapeHtml(kifu.endReason)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">悪手率</span>
                        <span class="detail-value ${badRateClass}">${kifu.badMoveRate}%</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">疑問手率</span>
                        <span class="detail-value ${questRateClass}">${kifu.questionableMoveRate}%</span>
                    </div>
                    <div class="detail-item" style="grid-column: span 3; margin-top:0.5rem;">
                        <span class="detail-label">振り返りコメント</span>
                        <span class="detail-value">${escapeHtml(kifu.comment || '')}</span>
                    </div>
                </div>
                <div style="display:flex; gap:0.5rem; margin-top:0.75rem;">
                    <button class="edit-btn" data-id="${kifu.id}">編集</button>
                    <button class="delete-btn" data-id="${kifu.id}">削除</button>
                </div>
            `;
            kifuList.appendChild(card);
        });

        // イベントリスナー: 編集・削除
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const k = allKifuData.find(x => String(x.id) === String(id));
                if (k) populateFormForEdit(k);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (!confirm('この棋譜を削除してよろしいですか？')) return;
                try {
                    const resp = await fetch(`/api/kifu/${id}`, { method: 'DELETE' });
                    if (resp.ok) {
                        showToast('棋譜を削除しました', 'success');
                        loadKifuData();
                    } else {
                        showToast('削除に失敗しました', 'error');
                    }
                } catch (e) {
                    console.error(e);
                    showToast('サーバーとの通信に失敗しました', 'error');
                }
            });
        });
    }

    function populateFormForEdit(kifu) {
        document.getElementById('gameType').value = kifu.gameType || '';
        document.getElementById('opponent').value = kifu.opponent || '';
        document.getElementById('result').value = kifu.result || '';
        document.getElementById('turn').value = kifu.turn || '';
        document.getElementById('myStrategy').value = kifu.myStrategy || '';
        document.getElementById('opponentStrategy').value = kifu.opponentStrategy || '';
        document.getElementById('endReason').value = kifu.endReason || '';
        document.getElementById('moves').value = kifu.moves || '';
        document.getElementById('matchDate').value = kifu.matchDate || '';
        document.getElementById('badMoveRate').value = kifu.badMoveRate || '';
        document.getElementById('questionableMoveRate').value = kifu.questionableMoveRate || '';
        document.getElementById('comment').value = kifu.comment || '';
        document.getElementById('accountName').value = kifu.accountName || 'Dok46';
        kifuIdInput.value = kifu.id || '';
        fileInput.value = '';
        currentKifFile.textContent = kifu.kifFilePath ? `現在のアップロード: ${kifu.kifFilePath}` : 'アップロード済みのKIFファイルはありません。';
    }

    async function handleKifFileSelect() {
        clearErrors();
        const file = fileInput.files[0];
        if (!file) {
            currentKifFile.textContent = 'KIFファイルを選択してください。';
            return;
        }

        const filename = file.name.toLowerCase();
        if (!filename.endsWith('.kif')) {
            document.getElementById('kifFileError').textContent = '拡張子 .kif のファイルを選択してください。';
            return;
        }

        try {
            const buffer = await file.arrayBuffer();
            let text = '';
            try {
                text = new TextDecoder('shift_jis').decode(new Uint8Array(buffer));
            } catch (error) {
                text = new TextDecoder('utf-8').decode(new Uint8Array(buffer));
            }
            const metadata = parseKifText(text);
            applyKifMetadata(metadata);
            currentKifFile.textContent = `読み込み済み: ${file.name}`;
        } catch (error) {
            console.error(error);
            document.getElementById('kifFileError').textContent = 'KIFファイルの読み込みに失敗しました。';
        }
    }

    function parseKifText(text) {
        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
        const metadata = {
            sente: '',
            gote: '',
            time: '',
            event: '',
            handicap: '',
            resultLine: '',
            endReason: '',
            result: '',
            moves: 0,
            matchDate: ''
        };

        for (const rawLine of lines) {
            const line = rawLine.replace(/\u3000/g, '');
            if (line.startsWith('先手：') || line.startsWith('先手:')) {
                metadata.sente = line.split(/[:：]/)[1].trim();
            } else if (line.startsWith('後手：') || line.startsWith('後手:')) {
                metadata.gote = line.split(/[:：]/)[1].trim();
            } else if (line.startsWith('持ち時間：') || line.startsWith('持ち時間:')) {
                metadata.time = line.split(/[:：]/)[1].trim();
            } else if (line.startsWith('棋戦：') || line.startsWith('棋戦:')) {
                metadata.event = line.split(/[:：]/)[1].trim();
            } else if (line.startsWith('手合割：') || line.startsWith('手合割:')) {
                metadata.handicap = line.split(/[:：]/)[1].trim();
            } else if (line.startsWith('開始日時：') || line.startsWith('開始日時:') || line.startsWith('対局日：') || line.startsWith('対局日:')) {
                const value = line.split(/[:：]/)[1].trim();
                metadata.matchDate = parseDateString(value);
            }
            if (!metadata.result && /まで\d+手で/.test(line) && /(先手の勝ち|後手の勝ち|先手勝ち|後手勝ち)/.test(line)) {
                const winner = /(先手の勝ち|先手勝ち)/.test(line) ? '先手' : '後手';
                metadata.resultLine = line;
                metadata.result = winner;
            }
            if (!metadata.endReason) {
                if (/投了/.test(line)) metadata.endReason = '投了';
                else if (/時間切れ/.test(line)) metadata.endReason = '時間切れ';
                else if (/千日手/.test(line)) metadata.endReason = '千日手/持将棋';
                else if (/持将棋/.test(line)) metadata.endReason = '千日手/持将棋';
                else if (/反則/.test(line)) metadata.endReason = '反則負け';
                else if (/入玉宣言/.test(line)) metadata.endReason = '入玉宣言';
            }
            const moveMatch = line.match(/^(\d+)(?=\s|　|$)/);
            if (moveMatch) {
                const moveCount = parseInt(moveMatch[1], 10);
                if (!Number.isNaN(moveCount) && moveCount > metadata.moves) {
                    metadata.moves = moveCount;
                }
            }
        }
        return metadata;
    }

    function applyKifMetadata(metadata) {
        const currentAccount = accountNameInput.value.trim() || 'Dok46';
        let accountName = currentAccount;
        let turn = '';
        let opponent = '';

        if (metadata.sente && metadata.gote) {
            if (metadata.sente === currentAccount || currentAccount === '' || currentAccount === 'Dok46') {
                accountName = metadata.sente;
                turn = '先手';
                opponent = metadata.gote;
            }
            if (metadata.gote === currentAccount) {
                accountName = metadata.gote;
                turn = '後手';
                opponent = metadata.sente;
            }
            if (!turn && currentAccount === '') {
                accountName = metadata.sente;
                turn = '先手';
                opponent = metadata.gote;
            }
        }

        if (metadata.time) {
            const timeLower = metadata.time.toLowerCase();
            if (timeLower.includes('10分')) accountNameInput.value = accountName;
            if (timeLower.includes('10分')) document.getElementById('gameType').value = '10分切れ負け';
            else if (timeLower.includes('3分')) document.getElementById('gameType').value = '3分切れ負け';
            else if (timeLower.includes('30秒')) document.getElementById('gameType').value = '秒読み（30秒）';
            else if (timeLower.includes('5分')) document.getElementById('gameType').value = '早指し';
        }
        if (metadata.handicap && !document.getElementById('gameType').value) {
            document.getElementById('gameType').value = metadata.handicap === '平手' ? 'その他' : 'その他';
        }
        if (opponent) {
            document.getElementById('opponent').value = opponent;
        }
        if (turn) {
            document.getElementById('turn').value = turn;
        }
        if (metadata.endReason) {
            document.getElementById('endReason').value = metadata.endReason;
        }
        if (metadata.result) {
            if (metadata.sente && metadata.gote) {
                const name = accountNameInput.value.trim() || accountName;
                const winnerSide = metadata.result;
                if ((winnerSide === '先手' && metadata.sente === name) || (winnerSide === '後手' && metadata.gote === name)) {
                    document.getElementById('result').value = '勝ち';
                } else {
                    document.getElementById('result').value = '負け';
                }
            }
        }

        if (metadata.moves && metadata.moves > 0) {
            document.getElementById('moves').value = metadata.moves;
        }
        if (metadata.matchDate) {
            document.getElementById('matchDate').value = metadata.matchDate;
        }

        if (!accountNameInput.value.trim()) {
            accountNameInput.value = accountName;
        }
    }

    function parseDateString(value) {
        const normalized = value.replace(/\u3000/g, ' ').trim();
        let match = normalized.match(/^(\d{4})[年\/\-](\d{1,2})[月\/\-](\d{1,2})/);
        if (match) {
            return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        }
        match = normalized.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (match) {
            return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
        }
        match = normalized.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/);
        if (match) {
            return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        }
        return '';
    }

    function escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // 簡易トースト通知
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.padding = '1rem 1.5rem';
        toast.style.borderRadius = '8px';
        toast.style.color = '#fff';
        toast.style.fontWeight = 'bold';
        toast.style.zIndex = '1000';
        toast.style.transition = 'all 0.5s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
        
        if (type === 'success') {
            toast.style.background = 'rgba(16, 185, 129, 0.9)';
            toast.style.borderLeft = '4px solid #059669';
        } else {
            toast.style.background = 'rgba(239, 68, 68, 0.9)';
            toast.style.borderLeft = '4px solid #dc2626';
        }
        
        toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}" style="margin-right: 8px;"></i> ${message}`;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 50);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => {
                toast.remove();
            }, 500);
        }, 3000);
    }
});
