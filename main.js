// アプリケーションのグローバル状態
const appState = {
    videoStreamNoCorrection: null,
    videoStreamDefault: null,
    currentStream: null, // 現在表示中のストリーム
    imageDataNoCorrection: null,
    imageDataDefault: null,
    currentConstraints: {
        video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'environment'
        }
    },
    devices: []
};

// DOM要素
const elements = {
    cameraPreview: document.getElementById('cameraPreview'),
    canvasNoCorrection: document.getElementById('canvasNoCorrection'),
    canvasDefault: document.getElementById('canvasDefault'),
    compareCanvasNoCorrection: document.getElementById('compareCanvasNoCorrection'),
    compareCanvasDefault: document.getElementById('compareCanvasDefault'),
    shutterBtn: document.getElementById('shutterBtn'),
    downloadNoCorrection: document.getElementById('downloadNoCorrection'),
    downloadDefault: document.getElementById('downloadDefault'),
    clearBtn: document.getElementById('clearBtn'),
    compareBtn: document.getElementById('compareBtn'),
    status: document.getElementById('status'),
    noCorrectionStatus: document.getElementById('noCorrectionStatus'),
    defaultStatus: document.getElementById('defaultStatus'),
    compareModal: document.getElementById('compareModal'),
    modalClose: document.querySelector('.modal-close'),
    deviceSelect: document.getElementById('deviceSelect'),
    resolutionSelect: document.getElementById('resolutionSelect'),
    colorAnalysisTable: document.getElementById('colorAnalysisTable')
};

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('アプリ初期化開始...');
    try {
        // カメラデバイスの列挙
        await enumerateDevices();
        
        // カメラアクセス要求
        await requestCameraAccess();
        
        // グローバル設定
        setupEventListeners();
        
        elements.status.textContent = 'カメラ準備完了';
        elements.shutterBtn.disabled = false;
    } catch (error) {
        console.error('初期化エラー:', error);
        elements.status.textContent = 'エラー: ' + error.message;
    }
    
    // PWA登録
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js').catch(err => console.log('SW登録失敗:', err));
    }
});

// カメラデバイスの列挙
async function enumerateDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        appState.devices = videoDevices;
        
        // デバイスセレクタを更新
        elements.deviceSelect.innerHTML = '';
        videoDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `カメラ ${index + 1}`;
            elements.deviceSelect.appendChild(option);
        });
    } catch (error) {
        console.error('デバイス列挙エラー:', error);
    }
}

// カメラアクセス要求
async function requestCameraAccess() {
    try {
        // 補正ありのストリーム（デフォルト）
        const constraintsDefault = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'environment'
            }
        };

        // 補正なしのストリーム
        const constraintsNoCorrection = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'environment',
                // 補正をオフにする設定
                advanced: [
                    {
                        whiteBalanceMode: 'manual',
                        colorTemperature: 6500,  // 昼光の色温度
                        exposureMode: 'manual',
                        exposureCompensation: 0,
                        exposureTime: 33333,
                        focusMode: 'continuous',
                        zoom: 1.0
                    }
                ]
            }
        };

        // デバイスが選択されている場合は使用
        if (elements.deviceSelect.value) {
            constraintsDefault.video.deviceId = { exact: elements.deviceSelect.value };
            constraintsNoCorrection.video.deviceId = { exact: elements.deviceSelect.value };
        }

        // 両方のストリームを取得
        try {
            // 補正なしストリームを取得
            appState.videoStreamNoCorrection = await navigator.mediaDevices.getUserMedia(constraintsNoCorrection);
            console.log('補正なしストリーム取得成功');
        } catch (e) {
            console.warn('補正なし設定が利用不可、デフォルト設定で取得:', e);
            // フォールバック
            appState.videoStreamNoCorrection = await navigator.mediaDevices.getUserMedia(constraintsDefault);
        }

        try {
            // デフォルト補正ストリームを取得
            appState.videoStreamDefault = await navigator.mediaDevices.getUserMedia(constraintsDefault);
            console.log('デフォルト補正ストリーム取得成功');
        } catch (e) {
            console.warn('デフォルト補正ストリーム取得失敗:', e);
            // 補正なしストリームをコピー
            appState.videoStreamDefault = appState.videoStreamNoCorrection;
        }

        // 初期表示ストリームを設定（常にデフォルト補正）
        appState.currentStream = appState.videoStreamDefault;
        elements.cameraPreview.srcObject = appState.currentStream;

        // デバイス選択変更時の処理
        elements.deviceSelect.addEventListener('change', async () => {
            await changeDevice();
        });

    } catch (error) {
        throw new Error('カメラアクセス拒否: ' + error.message);
    }
}

// デバイス変更
async function changeDevice() {
    try {
        // 現在のストリームを停止
        if (appState.videoStreamNoCorrection) {
            appState.videoStreamNoCorrection.getTracks().forEach(track => track.stop());
        }
        if (appState.videoStreamDefault) {
            appState.videoStreamDefault.getTracks().forEach(track => track.stop());
        }

        // 新しいデバイスで再度要求
        await requestCameraAccess();
        elements.status.textContent = 'カメラ変更完了';
    } catch (error) {
        console.error('デバイス変更エラー:', error);
        elements.status.textContent = 'デバイス変更エラー';
    }
}

// 解像度変更
elements.resolutionSelect.addEventListener('change', async (e) => {
    const [width, height] = e.target.value.split('x').map(Number);
    appState.currentConstraints.video.width = { ideal: width };
    appState.currentConstraints.video.height = { ideal: height };
    await changeDevice();
});

// イベントリスナー設定
function setupEventListeners() {
    elements.shutterBtn.addEventListener('click', capturePhoto);
    elements.downloadNoCorrection.addEventListener('click', () => downloadImage('補正なし'));
    elements.downloadDefault.addEventListener('click', () => downloadImage('デフォルト'));
    elements.clearBtn.addEventListener('click', clearResults);
    elements.compareBtn.addEventListener('click', showComparison);
    elements.modalClose.addEventListener('click', closeModal);
    elements.compareModal.addEventListener('click', (e) => {
        if (e.target === elements.compareModal) closeModal();
    });
}

// 写真キャプチャ
async function capturePhoto() {
    try {
        elements.shutterBtn.disabled = true;
        elements.status.textContent = '撮影処理中...';

        // 補正なしの写真（補正なしストリームから）
        await captureToCanvasFromStream(appState.videoStreamNoCorrection, elements.canvasNoCorrection, elements.noCorrectionStatus);
        appState.imageDataNoCorrection = elements.canvasNoCorrection.toDataURL('image/jpeg', 0.95);

        // デフォルト補正の写真（デフォルトストリームから）
        await captureToCanvasFromStream(appState.videoStreamDefault, elements.canvasDefault, elements.defaultStatus);
        appState.imageDataDefault = elements.canvasDefault.toDataURL('image/jpeg', 0.95);

        elements.status.textContent = '撮影完了!';
        elements.downloadNoCorrection.disabled = false;
        elements.downloadDefault.disabled = false;
        elements.clearBtn.disabled = false;
        elements.compareBtn.disabled = false;

    } catch (error) {
        console.error('キャプチャエラー:', error);
        elements.status.textContent = 'キャプチャエラー';
    } finally {
        elements.shutterBtn.disabled = false;
    }
}

// キャンバスへのキャプチャ（特定のストリームから）
function captureToCanvasFromStream(stream, canvas, statusElement) {
    return new Promise((resolve) => {
        // 一時的なビデオ要素を作成
        const tempVideo = document.createElement('video');
        tempVideo.srcObject = stream;
        tempVideo.muted = true;
        tempVideo.playsInline = true;

        tempVideo.onloadedmetadata = () => {
            tempVideo.play().then(() => {
                canvas.width = tempVideo.videoWidth;
                canvas.height = tempVideo.videoHeight;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);

                statusElement.textContent = `${canvas.width}x${canvas.height}`;

                // ストリームを停止
                tempVideo.srcObject = null;
                resolve();
            });
        };
    });
}

// キャンバスへのキャプチャ（現在のプレビューから）
function captureToCanvas(canvas, statusElement) {
    return new Promise((resolve) => {
        const video = elements.cameraPreview;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        statusElement.textContent = `${canvas.width}x${canvas.height}`;
        resolve();
    });
}

// 画像ダウンロード
function downloadImage(label) {
    const imageData = label === '補正なし' ? appState.imageDataNoCorrection : appState.imageDataDefault;
    
    if (!imageData) {
        alert('画像がありません');
        return;
    }
    
    const link = document.createElement('a');
    link.href = imageData;
    link.download = `camera-${label}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.jpg`;
    link.click();
}

// 結果クリア
function clearResults() {
    appState.imageDataNoCorrection = null;
    appState.imageDataDefault = null;
    
    elements.canvasNoCorrection.width = 0;
    elements.canvasDefault.width = 0;
    
    elements.noCorrectionStatus.textContent = '撮影待機中';
    elements.defaultStatus.textContent = '撮影待機中';
    
    elements.downloadNoCorrection.disabled = true;
    elements.downloadDefault.disabled = true;
    elements.clearBtn.disabled = true;
    elements.compareBtn.disabled = true;
    
    elements.status.textContent = 'クリア完了';
}

// 詳細比較表示
function showComparison() {
    if (!appState.imageDataNoCorrection || !appState.imageDataDefault) {
        alert('両方の画像が必要です');
        return;
    }
    
    // 詳細比較用キャンバスに描画
    drawToCanvas(elements.compareCanvasNoCorrection, appState.imageDataNoCorrection);
    drawToCanvas(elements.compareCanvasDefault, appState.imageDataDefault);
    
    // 色情報分析
    analyzeColors();
    
    // モーダル表示
    elements.compareModal.classList.remove('hidden');
}

// キャンバスに画像を描画
function drawToCanvas(canvas, imageData) {
    const img = new Image();
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
    };
    img.src = imageData;
}

// 色情報分析
function analyzeColors() {
    // 補正なしの色情報
    const noCtx = elements.compareCanvasNoCorrection.getContext('2d');
    const noCorrectionImageData = noCtx.getImageData(0, 0, elements.compareCanvasNoCorrection.width, elements.compareCanvasNoCorrection.height);
    const noColorStats = getColorStats(noCorrectionImageData.data);
    
    // デフォルト補正の色情報
    const defaultCtx = elements.compareCanvasDefault.getContext('2d');
    const defaultImageData = defaultCtx.getImageData(0, 0, elements.compareCanvasDefault.width, elements.compareCanvasDefault.height);
    const defaultColorStats = getColorStats(defaultImageData.data);
    
    // テーブルに結果を表示
    updateColorAnalysisTable(noColorStats, defaultColorStats);
}

// 色統計を計算
function getColorStats(pixelData) {
    let r = 0, g = 0, b = 0, count = 0;
    
    for (let i = 0; i < pixelData.length; i += 4) {
        r += pixelData[i];
        g += pixelData[i + 1];
        b += pixelData[i + 2];
        count++;
    }
    
    return {
        r: Math.round(r / count),
        g: Math.round(g / count),
        b: Math.round(b / count),
        brightness: Math.round((r + g + b) / (3 * count))
    };
}

// 色分析テーブル更新
function updateColorAnalysisTable(noStats, defaultStats) {
    const tbody = elements.colorAnalysisTable.querySelector('tbody') || elements.colorAnalysisTable;
    
    // 既存の行を削除（ヘッダーを除く）
    const rows = tbody.querySelectorAll('tr');
    for (let i = 1; i < rows.length; i++) {
        rows[i].remove();
    }
    
    // 新しい行を追加
    const analyses = [
        { label: '赤値 (R)', no: noStats.r, def: defaultStats.r },
        { label: '緑値 (G)', no: noStats.g, def: defaultStats.g },
        { label: '青値 (B)', no: noStats.b, def: defaultStats.b },
        { label: '明るさ', no: noStats.brightness, def: defaultStats.brightness }
    ];
    
    analyses.forEach(analysis => {
        const row = tbody.insertRow();
        const diff = analysis.def - analysis.no;
        const diffPercent = ((diff / analysis.no) * 100).toFixed(1);
        
        row.innerHTML = `
            <td><strong>${analysis.label}</strong></td>
            <td>${analysis.no}</td>
            <td>${analysis.def} (${diff > 0 ? '+' : ''}${diffPercent}%)</td>
        `;
    });
}

// モーダルクローズ
function closeModal() {
    elements.compareModal.classList.add('hidden');
}

// ページアンロード時のクリーンアップ
window.addEventListener('beforeunload', () => {
    if (appState.videoStreamNoCorrection) {
        appState.videoStreamNoCorrection.getTracks().forEach(track => track.stop());
    }
    if (appState.videoStreamDefault) {
        appState.videoStreamDefault.getTracks().forEach(track => track.stop());
    }
});
