/**
 * 音声入力SOAPノート - アプリケーションロジック (app.js)
 * 
 * 1. Web Speech APIによるリアルタイム音声認識
 * 2. 認識結果のリアルタイム表示とテキスト編集
 * 3. キーワードベースのSOAP自動振り分けロジック
 * 4. クリップボードコピー・カテゴリ変更・例文挿入機能
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. 定数・キーワード定義
  // ==========================================
  const SOAP_KEYWORDS = {
    s: [
      '痛い', 'つらい', 'しびれる', 'だるい', '動かしにくい',
      '不安', '眠れない', '訴え', '違和感', '息苦しい', 'めまい',
      '重い', '張る', 'こわばる', '痛む', '疲れる'
    ],
    o: [
      'ROM', 'MMT', '度', 'cm', 'kg', 'mmHg', '回', '秒',
      '歩行', '握力', 'バイタル', '腫脹', '熱感', '発赤',
      '血圧', '体温', '脈拍', 'SpO2', '徒手筋力', '可動域',
      'TUG', '10m', '下肢', '上肢', '左側', '右側', '浮腫'
    ],
    a: [
      '考えられる', '原因', '問題', '改善', '低下', '制限',
      'リスク', '評価', '要因', '困難', '良好', '不十分',
      '影響', '可能性', '維持', '向上', '疲労', '代償'
    ],
    p: [
      'プログラム', '目標', '実施', '継続', '指導', '週',
      '回', 'セット', '退院', '自主トレ', 'ストレッチ', '訓練',
      '計画', '介入', '見守り', '介助', '処方', '調整', '予定'
    ]
  };

  // サンプルデータ（医療・リハビリ現場を想定した実践的な例文）
  const SAMPLE_TEXT = `患者は「朝起きると右膝が痛いし、階段の上り下りが動かしにくい」と訴えている。
夜間も鈍痛のため眠れない日があるとのこと。
右膝関節屈曲可動域ROMは110度、伸展-10度で制限あり。
大腿四頭筋MMTは右3、左4であり、腫脹と軽度の熱感を認める。
10m歩行時間は12秒であり、歩行時の疼痛回避性跛行が見られる。
膝関節周囲筋の筋力低下および可動域制限が、歩行時痛と動作困難の主な原因と考えられる。
転倒リスクが高く、継続的な関節保護と筋力向上のアプローチが必要と評価する。
大腿四頭筋セッティングおよびSLR運動を10回3セット実施するプログラムを立案。
来週までに歩行安定性を高めることを目標とし、週3回の個別リハビリを継続する。
自宅での自主トレ方法とアイシング指導を実施した。
本日はご家族も同席された。`;

  // ==========================================
  // 2. DOM要素の取得
  // ==========================================
  const btnRecord = document.getElementById('btnRecord');
  const btnRecordText = document.getElementById('btnRecordText');
  const btnStop = document.getElementById('btnStop');
  const btnConvert = document.getElementById('btnConvert');
  const btnSample = document.getElementById('btnSample');
  const btnClear = document.getElementById('btnClear');
  const btnCopyAll = document.getElementById('btnCopyAll');

  const recognizedTextEl = document.getElementById('recognizedText');
  const liveSpeechBar = document.getElementById('liveSpeechBar');
  const liveSpeechText = document.getElementById('liveSpeechText');
  const recordTimer = document.getElementById('recordTimer');
  const timerText = document.getElementById('timerText');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const supportNotice = document.getElementById('supportNotice');
  const supportNoticeText = document.getElementById('supportNoticeText');
  const textCharCount = document.getElementById('textCharCount');
  const toast = document.getElementById('toast');

  // SOAPカード要素
  const soapContainers = {
    s: document.getElementById('contentS'),
    o: document.getElementById('contentO'),
    a: document.getElementById('contentA'),
    p: document.getElementById('contentP'),
    unclassified: document.getElementById('contentUnclassified')
  };

  const soapCounts = {
    s: document.getElementById('countS'),
    o: document.getElementById('countO'),
    a: document.getElementById('countA'),
    p: document.getElementById('countP'),
    unclassified: document.getElementById('countUnclassified')
  };

  // ==========================================
  // 3. 状態管理
  // ==========================================
  let isRecording = false;
  let recognition = null;
  let finalTranscript = '';
  let timerInterval = null;
  let timerSeconds = 0;

  // 分類済みデータの保存
  let currentSoapData = {
    s: [],
    o: [],
    a: [],
    p: [],
    unclassified: []
  };

  // ==========================================
  // 4. Web Speech API 初期化
  // ==========================================
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    // 音声認識開始イベント
    recognition.onstart = () => {
      isRecording = true;
      updateUIStatus('recording');
      startTimer();
    };

    // リアルタイム認識結果処理
    recognition.onresult = (event) => {
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          // 句点を自動補完（日本語の文章として整える）
          const trimmed = transcript.trim();
          const endsWithPunctuation = /[。！？!?]$/.test(trimmed);
          const formatted = endsWithPunctuation ? trimmed : trimmed + '。';
          
          if (finalTranscript.length > 0 && !finalTranscript.endsWith('\n') && !finalTranscript.endsWith('。')) {
            finalTranscript += ' ' + formatted;
          } else {
            finalTranscript += formatted;
          }
        } else {
          interimTranscript += transcript;
        }
      }

      // リアルタイム表示バーの更新
      if (interimTranscript.trim().length > 0) {
        liveSpeechBar.style.display = 'flex';
        liveSpeechText.textContent = interimTranscript;
      } else {
        liveSpeechBar.style.display = 'none';
      }

      // テキストエリアに反映
      const fullText = finalTranscript + (interimTranscript ? (finalTranscript ? '\n' : '') + interimTranscript : '');
      recognizedTextEl.value = fullText;
      updateCharCount();
      autoScrollTextarea();
    };

    // 音声認識エラー処理
    recognition.onerror = (event) => {
      console.warn('SpeechRecognition Error:', event.error);
      let errorMsg = '音声認識エラーが発生しました: ' + event.error;
      
      if (event.error === 'not-allowed') {
        errorMsg = 'マイクへのアクセスが許可されていません。ブラウザのアドレスバーにある鍵アイコン等からマイク権限を許可してください。';
      } else if (event.error === 'no-speech') {
        errorMsg = '音声が検出されませんでした。マイクに向かって話してください。';
        return; // no-speechは一時的なものなので継続
      } else if (event.error === 'network') {
        errorMsg = '音声認識サービスへのネットワーク接続に問題があります。インターネット接続をご確認ください。';
      }

      showNotice(errorMsg);
      showToast(errorMsg);
    };

    // 音声認識終了イベント
    recognition.onend = () => {
      // ユーザーが手動で停止していないのにブラウザ側で終了した場合は自動再開
      if (isRecording) {
        try {
          recognition.start();
          return;
        } catch (e) {
          console.log('再開試行スキップ:', e);
        }
      }
      
      stopRecordingUI();
    };

  } else {
    // Web Speech API 非対応ブラウザ
    showNotice('お使いのブラウザはWeb Speech API（音声認識）に対応していません。Google Chrome、Microsoft Edge、またはSafariをご利用いただくか、直接テキストを入力してSOAP変換をお試しください。');
    btnRecord.disabled = true;
    btnRecord.title = '音声認識非対応のブラウザです';
  }

  // ==========================================
  // 5. 録音の開始・停止制御
  // ==========================================
  function startRecording() {
    if (!recognition) {
      showToast('お使いのブラウザは音声認識をサポートしていません');
      return;
    }

    try {
      hideNotice();
      finalTranscript = recognizedTextEl.value; // 既存テキストがあれば引き継ぐ
      recognition.start();
    } catch (e) {
      console.error('録音開始エラー:', e);
      showNotice('マイクの初期化に失敗しました。再度お試しください。');
    }
  }

  function stopRecording() {
    isRecording = false;
    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {
        console.error('録音停止エラー:', e);
      }
    }
    stopRecordingUI();
    showToast('録音を停止しました。全体のテキストが確定されました。');
  }

  function stopRecordingUI() {
    isRecording = false;
    updateUIStatus('idle');
    stopTimer();
    liveSpeechBar.style.display = 'none';
    btnRecord.classList.remove('recording');
    btnRecord.disabled = false;
    btnRecordText.textContent = '録音開始';
    btnStop.disabled = true;
    updateCharCount();
  }

  function updateUIStatus(status) {
    if (status === 'recording') {
      statusIndicator.className = 'status-badge status-recording';
      statusText.textContent = '録音中...';
      btnRecord.classList.add('recording');
      btnRecordText.textContent = '認識中...';
      btnStop.disabled = false;
      recordTimer.style.display = 'flex';
    } else {
      statusIndicator.className = 'status-badge status-idle';
      statusText.textContent = '待機中';
      btnRecord.classList.remove('recording');
      btnRecordText.textContent = '録音開始';
      btnStop.disabled = true;
      recordTimer.style.display = 'none';
    }
  }

  // タイマー管理
  function startTimer() {
    timerSeconds = 0;
    updateTimerDisplay();
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timerSeconds++;
      updateTimerDisplay();
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
  }

  function updateTimerDisplay() {
    const mins = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
    const secs = String(timerSeconds % 60).padStart(2, '0');
    timerText.textContent = `${mins}:${secs}`;
  }

  function updateCharCount() {
    textCharCount.textContent = recognizedTextEl.value.length;
  }

  function autoScrollTextarea() {
    recognizedTextEl.scrollTop = recognizedTextEl.scrollHeight;
  }

  // ==========================================
  // 6. SOAP自動振り分けロジック
  // ==========================================
  /**
   * テキストを文に分割する
   */
  function splitIntoSentences(text) {
    if (!text || !text.trim()) return [];
    
    // 改行でまず分割
    const lines = text.split(/\r?\n/);
    const sentences = [];

    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      // 句点「。」「！」「？」「!」「?」で分割しつつ末尾の約物を保持
      const matches = trimmedLine.match(/[^。！？!?]+([。！？!?]|$)/g);
      if (matches) {
        matches.forEach(m => {
          const s = m.trim();
          if (s) sentences.push(s);
        });
      } else {
        sentences.push(trimmedLine);
      }
    });

    return sentences;
  }

  /**
   * 文に対してSOAP各カテゴリのキーワードマッチとスコアを判定
   */
  function classifySentence(sentence) {
    const matched = {
      s: [],
      o: [],
      a: [],
      p: []
    };

    // 各カテゴリのキーワード一致をチェック
    for (const [category, keywords] of Object.entries(SOAP_KEYWORDS)) {
      keywords.forEach(kw => {
        // 大文字小文字を区別せず検索（ROM, MMTなど）
        const regex = new RegExp(kw, 'i');
        if (regex.test(sentence)) {
          matched[category].push(kw);
        }
      });
    }

    // 重複キーワード（例:「回」）の調整とスコアリング
    // S: 自覚症状キーワード
    // O: 測定・検査キーワード
    // A: 評価・判断キーワード
    // P: 計画・治療キーワード
    let scoreS = matched.s.length;
    let scoreO = matched.o.length;
    let scoreA = matched.a.length;
    let scoreP = matched.p.length;

    // 「回」の重複解消ルール：
    // 「セット」「自主トレ」「プログラム」「週」などがある場合はPへ加点
    if (sentence.includes('セット') || sentence.includes('自主トレ') || sentence.includes('プログラム') || sentence.includes('目標') || sentence.includes('指導')) {
      scoreP += 2;
    }
    // 「ROM」「MMT」「度」「cm」「kg」「mmHg」「歩行」「バイタル」などがある場合はOへ加点
    if (/ROM|MMT|度|cm|kg|mmHg|歩行|バイタル|腫脹|熱感|発赤/i.test(sentence)) {
      scoreO += 2;
    }
    // 自覚症状（「痛い」「つらい」「しびれる」「訴え」）がある場合はSへ加点
    if (/痛い|つらい|しびれる|だるい|動かしにくい|不安|眠れない|訴え/.test(sentence)) {
      scoreS += 2;
    }
    // 評価（「考えられる」「原因」「問題」「リスク」「評価」）がある場合はAへ加点
    if (/考えられる|原因|問題|改善|低下|制限|リスク|評価/.test(sentence)) {
      scoreA += 2;
    }

    const scores = [
      { category: 's', score: scoreS, count: matched.s.length, keywords: matched.s },
      { category: 'o', score: scoreO, count: matched.o.length, keywords: matched.o },
      { category: 'a', score: scoreA, count: matched.a.length, keywords: matched.a },
      { category: 'p', score: scoreP, count: matched.p.length, keywords: matched.p }
    ];

    // スコア順にソート
    scores.sort((a, b) => b.score - a.score);

    // いずれのキーワードも含まれない場合は未分類
    if (scores[0].score === 0 || scores[0].keywords.length === 0) {
      return {
        category: 'unclassified',
        keywords: []
      };
    }

    return {
      category: scores[0].category,
      keywords: scores[0].keywords
    };
  }

  /**
   * テキスト全体のSOAP変換を実行
   */
  function convertToSOAP() {
    const rawText = recognizedTextEl.value;
    if (!rawText.trim()) {
      showToast('テキストが入力されていません。音声を録音するかテキストを入力してください。');
      return;
    }

    // 録音中であれば停止
    if (isRecording) {
      stopRecording();
    }

    const sentences = splitIntoSentences(rawText);
    
    // データ初期化
    currentSoapData = {
      s: [],
      o: [],
      a: [],
      p: [],
      unclassified: []
    };

    sentences.forEach((sentence, index) => {
      const result = classifySentence(sentence);
      currentSoapData[result.category].push({
        id: `item-${Date.now()}-${index}`,
        text: sentence,
        keywords: result.keywords
      });
    });

    renderSOAPCards();
    showToast('SOAP形式への振り分けが完了しました！');
  }

  // ==========================================
  // 7. SOAPカードの描画
  // ==========================================
  function renderSOAPCards() {
    const categories = ['s', 'o', 'a', 'p', 'unclassified'];

    categories.forEach(cat => {
      const container = soapContainers[cat];
      const countEl = soapCounts[cat];
      const items = currentSoapData[cat];

      countEl.textContent = `${items.length}件`;
      container.innerHTML = '';

      if (items.length === 0) {
        const emptyMsg = cat === 'unclassified' ? '未分類の文はありません' : '該当する文がありません';
        container.innerHTML = `<p class="empty-state">${emptyMsg}</p>`;
        return;
      }

      items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'soap-item';
        itemEl.id = item.id;

        // キーワードチップHTML
        let chipsHtml = '';
        if (item.keywords && item.keywords.length > 0) {
          const uniqueKeywords = [...new Set(item.keywords)];
          chipsHtml = `<div class="keyword-chips">
            ${uniqueKeywords.map(kw => `<span class="keyword-chip">${escapeHtml(kw)}</span>`).join('')}
          </div>`;
        }

        // 移動用セレクトボタン
        const selectOptions = [
          { val: 's', label: 'Sへ' },
          { val: 'o', label: 'Oへ' },
          { val: 'a', label: 'Aへ' },
          { val: 'p', label: 'Pへ' },
          { val: 'unclassified', label: '未分類へ' }
        ].filter(opt => opt.val !== cat);

        itemEl.innerHTML = `
          <div class="soap-item-text">${escapeHtml(item.text)}</div>
          <div class="soap-item-meta">
            ${chipsHtml}
            <div class="item-actions">
              <select class="btn-move" data-id="${item.id}" data-current="${cat}" title="カテゴリを変更">
                <option value="" disabled selected>移動...</option>
                ${selectOptions.map(opt => `<option value="${opt.val}">${opt.label}</option>`).join('')}
              </select>
              <button type="button" class="btn-delete-item" data-id="${item.id}" data-cat="${cat}" title="削除">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        `;

        container.appendChild(itemEl);
      });
    });

    // 移動セレクトボックスと削除ボタンのイベントリスナー設定
    attachItemEventListeners();
  }

  function attachItemEventListeners() {
    // カテゴリ移動イベント
    document.querySelectorAll('.btn-move').forEach(select => {
      select.addEventListener('change', (e) => {
        const itemId = e.target.getAttribute('data-id');
        const currentCat = e.target.getAttribute('data-current');
        const targetCat = e.target.value;

        if (!targetCat) return;

        const itemIndex = currentSoapData[currentCat].findIndex(i => i.id === itemId);
        if (itemIndex > -1) {
          const [movedItem] = currentSoapData[currentCat].splice(itemIndex, 1);
          currentSoapData[targetCat].push(movedItem);
          renderSOAPCards();
          showToast(`文を ${targetCat.toUpperCase()} に移動しました`);
        }
      });
    });

    // 削除イベント
    document.querySelectorAll('.btn-delete-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const btnEl = e.currentTarget;
        const itemId = btnEl.getAttribute('data-id');
        const cat = btnEl.getAttribute('data-cat');

        const itemIndex = currentSoapData[cat].findIndex(i => i.id === itemId);
        if (itemIndex > -1) {
          currentSoapData[cat].splice(itemIndex, 1);
          renderSOAPCards();
          showToast('項目を削除しました');
        }
      });
    });
  }

  // ==========================================
  // 8. コピー機能
  // ==========================================
  /**
   * 特定カテゴリの文をコピー
   */
  function copyCategory(category) {
    const items = currentSoapData[category];
    if (!items || items.length === 0) {
      showToast('コピーする項目がありません');
      return;
    }

    const catNames = {
      s: '【S（主観的情報）】',
      o: '【O（客観的情報）】',
      a: '【A（評価・分析）】',
      p: '【P（治療計画）】',
      unclassified: '【未分類】'
    };

    const textToCopy = `${catNames[category]}\n` + items.map(item => `・${item.text}`).join('\n');
    copyToClipboard(textToCopy, `${category.toUpperCase()} の内容をコピーしました`);
  }

  /**
   * 全体のSOAP形式テキストをコピー
   */
  function copyAllSOAP() {
    const hasAnyItem = Object.values(currentSoapData).some(list => list.length > 0);
    if (!hasAnyItem) {
      showToast('コピーするSOAPノートがありません。先に「SOAP変換」を実行してください。');
      return;
    }

    let output = `# SOAPノート\n\n`;

    output += `【S（Subjective：主観的情報）】\n`;
    if (currentSoapData.s.length > 0) {
      output += currentSoapData.s.map(i => `・${i.text}`).join('\n') + '\n\n';
    } else {
      output += `（特記事項なし）\n\n`;
    }

    output += `【O（Objective：客観的情報）】\n`;
    if (currentSoapData.o.length > 0) {
      output += currentSoapData.o.map(i => `・${i.text}`).join('\n') + '\n\n';
    } else {
      output += `（特記事項なし）\n\n`;
    }

    output += `【A（Assessment：評価）】\n`;
    if (currentSoapData.a.length > 0) {
      output += currentSoapData.a.map(i => `・${i.text}`).join('\n') + '\n\n';
    } else {
      output += `（特記事項なし）\n\n`;
    }

    output += `【P（Plan：計画）】\n`;
    if (currentSoapData.p.length > 0) {
      output += currentSoapData.p.map(i => `・${i.text}`).join('\n') + '\n\n';
    } else {
      output += `（特記事項なし）\n\n`;
    }

    if (currentSoapData.unclassified.length > 0) {
      output += `【その他・未分類】\n`;
      output += currentSoapData.unclassified.map(i => `・${i.text}`).join('\n') + '\n';
    }

    copyToClipboard(output.trim(), 'SOAPノート全体をクリップボードにコピーしました！');
  }

  function copyToClipboard(text, successMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg);
      }).catch(err => {
        console.error('クリップボードコピー失敗:', err);
        fallbackCopy(text, successMsg);
      });
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    const tempInput = document.createElement('textarea');
    tempInput.value = text;
    tempInput.style.position = 'fixed';
    tempInput.style.opacity = '0';
    document.body.appendChild(tempInput);
    tempInput.focus();
    tempInput.select();
    try {
      document.execCommand('copy');
      showToast(successMsg);
    } catch (err) {
      showToast('コピーに失敗しました。手動で選択してコピーしてください。');
    }
    document.body.removeChild(tempInput);
  }

  // ==========================================
  // 9. ユーティリティ・UI通知
  // ==========================================
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  function showNotice(message) {
    supportNoticeText.textContent = message;
    supportNotice.style.display = 'flex';
  }

  function hideNotice() {
    supportNotice.style.display = 'none';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================
  // 10. イベントリスナー登録
  // ==========================================
  // 録音開始ボタン
  btnRecord.addEventListener('click', () => {
    if (isRecording) return;
    startRecording();
  });

  // 録音停止ボタン
  btnStop.addEventListener('click', () => {
    if (!isRecording) return;
    stopRecording();
  });

  // SOAP変換ボタン
  btnConvert.addEventListener('click', () => {
    convertToSOAP();
  });

  // サンプル文挿入
  btnSample.addEventListener('click', () => {
    recognizedTextEl.value = SAMPLE_TEXT;
    finalTranscript = SAMPLE_TEXT;
    updateCharCount();
    showToast('臨床・リハビリのサンプル例文を挿入しました');
  });

  // クリアボタン
  btnClear.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    }
    recognizedTextEl.value = '';
    finalTranscript = '';
    liveSpeechText.textContent = '';
    liveSpeechBar.style.display = 'none';
    updateCharCount();

    // SOAPカードもリセット
    currentSoapData = { s: [], o: [], a: [], p: [], unclassified: [] };
    renderSOAPCards();
    showToast('テキストとSOAP結果をクリアしました');
  });

  // テキストエリア入力監視
  recognizedTextEl.addEventListener('input', () => {
    finalTranscript = recognizedTextEl.value;
    updateCharCount();
  });

  // 全体コピー
  btnCopyAll.addEventListener('click', () => {
    copyAllSOAP();
  });

  // 各カードコピーボタン
  document.querySelectorAll('.btn-card-copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget.getAttribute('data-target');
      copyCategory(target);
    });
  });

  // 初期文字カウント
  updateCharCount();
});
