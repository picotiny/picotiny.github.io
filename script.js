// 1. НАШ СПИСОК ТРЕКОВ
const playlist = [
    'Picotiny - Шторм.mp3',
    'Picotiny - Елки-ежики.mp3',
    'Picotiny - Портал.mp3',
    'Picotiny - Встреча.mp3',
    'Picotiny - Звезды в руках.mp3',
    'Picotiny - Кэп.mp3'
];

//поток радио
const radioStreamUrl = 'http://176.94.74.177:8000/radio.mp3';

// Переменные для Web Audio API (инициализируем позже при клике)
let audioCtx = null;
let analyser = null;
let source = null;
let dataArray = null;
let radioTimer = null;

let currentTrackIndex = 0; 
let isPlaying = false;
let isRadioMode = false; // По умолчанию режим плеера файлов

// Автоматически экранируем спецсимволы в путях файлов (пробелы, кириллицу)
let audioPath = `playlist/${encodeURIComponent(playlist[currentTrackIndex])}`;
let audio = new Audio(audioPath);
audio.crossOrigin = "anonymous"; // Нужно для корректной работы визуализатора с внешними потоками

// Находим элементы интерфейса плеера
const playBtn = document.getElementById('play');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const coverImg = document.getElementById('cover');
const titleText = document.getElementById('title');
const artistText = document.getElementById('artist');

const progressBarContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress');
const currentTimeText = document.getElementById('current-time');
const durationTimeText = document.getElementById('duration');

// Элементы управления бортовой панели радио-тумблера
const radioToggleBtn = document.getElementById('radio-toggle');
const deckDisplay = document.getElementById('deck-display');

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Вспомогательная функция: правильно читает текст из байтов ID3 (обрабатывает Unicode и кодировки)
function readID3String(view, offset, size) {
    if (size <= 1) return "";
    const encoding = view.getUint8(offset);
    let start = offset + 1;
    let length = size - 1;

    // ISO-8859-1 или UTF-8 без BOM
    if (encoding === 0 || encoding === 3) {
        let strData = [];
        for (let i = 0; i < length; i++) {
            const charCode = view.getUint8(start + i);
            if (charCode === 0) break; // Конец строки
            strData.push(charCode);
        }
        try {
            const decoder = new TextDecoder(encoding === 3 ? 'utf-8' : 'windows-1251');
            return decoder.decode(new Uint8Array(strData)).trim();
        } catch(e) {
            return String.fromCharCode.apply(null, strData).trim();
        }
    } 
    // UTF-16 с BOM маркером (0xFF 0xFE или 0xFE 0xFF)
    else if (encoding === 1 || encoding === 2) { 
        if (length >= 2) {
            const b1 = view.getUint8(start);
            const b2 = view.getUint8(start + 1);
            if ((b1 === 0xFF && b2 === 0xFE) || (b1 === 0xFE && b2 === 0xFF)) {
                start += 2;
                length -= 2;
            }
        }
        const utf16Data = new Uint16Array(Math.floor(length / 2));
        for (let i = 0; i < utf16Data.length; i++) {
            utf16Data[i] = view.getUint16(start + i * 2, true); 
        }
        let str = String.fromCharCode.apply(null, utf16Data);
        return str.replace(/\0+$/, '').trim();
    }
    return "";
}

// Вспомогательная функция для чтения размера заголовка ID3v2 и фреймов ID3v2.4 (Synchsafe)
function readSynchsafeInt(view, offset) {
    return (view.getUint8(offset) << 21) |
           (view.getUint8(offset + 1) << 14) |
           (view.getUint8(offset + 2) << 7) |
           view.getUint8(offset + 3);
}


async function updateRadioMetadata() {
    // Стучимся напрямую в Icecast на открытый порт 8000
    const apiUrl = radioStreamUrl.replace('/radio.mp3', '/status-json.xsl');

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("Icecast не отвечает");
        
        const data = await response.json();
        
        // Проверяем наличие данных стрима в полученном JSON
        if (data && data.icestats && data.icestats.source) {
            let source = data.icestats.source;
            
            if (Array.isArray(source)) {
                source = source[0];
            }
            
            // Вытаскиваем артиста и название трека из твоих полей
            const currentArtist = source.artist || "FLOW SYNAPSE";
            const currentTitle = source.title || "ПРЯМОЙ ЭФИР";
            
            // Если мы всё ещё в режиме радио, обновляем интерфейс капсом
            if (isRadioMode) {
                titleText.innerText = currentTitle.toUpperCase();
                artistText.innerText = currentArtist.toUpperCase();
            }
        }
    } catch (e) {
        console.warn("Сбой получения метаданных с порта 8000:", e.message);
        // Мягкий фоллбек, чтобы интерфейс кабины не пустовал при сбое сети
        if (isRadioMode) {
            titleText.innerText = "ПРЯМОЙ ЭФИР";
            artistText.innerText = "FLOW SYNAPSE";
        }
    }
}

async function loadTrack(index) {
    audio.pause();
    
    if (coverImg.src && coverImg.src.startsWith('blob:')) {
        URL.revokeObjectURL(coverImg.src);
    }
    coverImg.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'></svg>";
    
    currentTrackIndex = index;
    audioPath = `playlist/${encodeURIComponent(playlist[currentTrackIndex])}`;
    audio.src = audioPath;

    progressBar.style.width = '0%';
    currentTimeText.innerText = '0:00';
    durationTimeText.innerText = '0:00';

    if (isPlaying) {
        audio.play().catch(e => console.log("Ждем клика..."));
    }

    // 1. СРАЗУ готовим красивое имя из файла на случай, если fetch заблокирован безопасностью браузера
    const cleanName = playlist[currentTrackIndex].replace('.mp3', '');
    let fallbackArtist = "Picotiny";
    let fallbackTitle = cleanName;

    if (cleanName.includes(' - ')) {
        const parts = cleanName.split(' - ');
        fallbackArtist = parts[0].trim();
        fallbackTitle = parts[1].trim();
    }

    // Временно выводим имя файла, чтобы табло кабины ожило
    titleText.innerText = fallbackTitle;
    artistText.innerText = fallbackArtist;

    // 2. Безопасно пробуем прочесть ID3-теги
    try {
        const response = await fetch(audioPath);
        // Если браузер заблокировал fetch (file:/// или CORS), мы просто уходим в блок catch,
        // но интерфейс НЕ ломается и имя из плейлиста остается на экране!
        if (!response.ok) throw new Error("Локальное ограничение доступа к файлу");
        
        const buffer = await response.arrayBuffer();
        const view = new DataView(buffer);

        if (buffer.byteLength > 10 && view.getUint8(0) === 0x49 && view.getUint8(1) === 0x44 && view.getUint8(2) === 0x33) {
            const majorVersion = view.getUint8(3);
            const id3Size = readSynchsafeInt(view, 6);
            const endOfTags = Math.min(id3Size + 10, buffer.byteLength);
            
            let offset = 10;
            let extractedTitle = "";
            let extractedArtist = "";

            while (offset < endOfTags - 10) {
                if (view.getUint8(offset) === 0) break;

                const frameId = String.fromCharCode(
                    view.getUint8(offset), 
                    view.getUint8(offset+1), 
                    view.getUint8(offset+2), 
                    view.getUint8(offset+3)
                );

                let frameSize = 0;
                if (majorVersion === 4) {
                    frameSize = readSynchsafeInt(view, offset + 4);
                } else {
                    frameSize = view.getUint32(offset + 4, false);
                }

                if (frameSize <= 0 || (offset + 10 + frameSize) > buffer.byteLength) break;

                const headerSize = 10;
                const dataOffset = offset + headerSize;

                if (frameId === 'TIT2') {
                    extractedTitle = readID3String(view, dataOffset, frameSize);
                }
                else if (frameId === 'TPE1') {
                    extractedArtist = readID3String(view, dataOffset, frameSize);
                }
                else if (frameId === 'APIC') {
                    let imgOffset = dataOffset;
                    imgOffset++; // encoding

                    let mimeTypeString = "";
                    while (view.getUint8(imgOffset) !== 0 && imgOffset < dataOffset + frameSize) {
                        mimeTypeString += String.fromCharCode(view.getUint8(imgOffset));
                        imgOffset++;
                    }
                    imgOffset++; // skip null

                    imgOffset++; // picture type
                    while (view.getUint8(imgOffset) !== 0 && imgOffset < dataOffset + frameSize) imgOffset++;
                    imgOffset++; // skip description null

                    const imgData = buffer.slice(imgOffset, dataOffset + frameSize);
                    const finalMime = mimeTypeString || 'image/jpeg';
                    const blob = new Blob([imgData], { type: finalMime });
                    
                    coverImg.src = URL.createObjectURL(blob);
                }

                offset += headerSize + frameSize;
            }

            // Если парсер нашел внутри mp3 настоящие теги — перезаписываем имя файла на них
            if (extractedTitle.trim()) titleText.innerText = extractedTitle.trim();
            if (extractedArtist.trim()) artistText.innerText = extractedArtist.trim();
        }
    } catch (e) {
        // Логируем ошибку для отладки, но песня продолжает играть и имя показывается
        console.warn("ID3 теги недоступны напрямую, используется имя файла:", e.message);
    }
}

// 3. НАСТРОЙКА СЛУШАТЕЛЕЙ
function initAudioListeners() {
    audio.addEventListener('timeupdate', () => {
        if (isRadioMode) return;
        const currentTime = audio.currentTime;
        const duration = audio.duration;
        if (duration) {
            const progressPercent = (currentTime / duration) * 100;
            progressBar.style.width = `${progressPercent}%`;
            currentTimeText.innerText = formatTime(currentTime);
        }
    });

    audio.addEventListener('loadedmetadata', () => {
        if (isRadioMode) return;
        durationTimeText.innerText = formatTime(audio.duration);
    });

    audio.addEventListener('ended', () => {
        if (!isRadioMode) nextTrack();
    });
}

// 4. ЛОГИКА ТУМБЛЕРА «РАДИО / ПЛЕЕР»
function toggleRadioMode() {
    isRadioMode = !isRadioMode;

    if (isRadioMode) {
        // --- ВКЛЮЧАЕМ РАДИО ---
        audio.pause();
        radioToggleBtn.classList.add('radio-active');
        deckDisplay.innerText = "RADIO";
        deckDisplay.style.color = "#ff3366"; 
        deckDisplay.style.textShadow = "0 0 8px #ff3366";

        nextBtn.classList.add('btn-disabled');
        prevBtn.classList.add('btn-disabled');
        progressBarContainer.style.opacity = '0.3';
        progressBarContainer.style.pointerEvents = 'none';

        // Ставим локальную киберпанк-обложку по умолчанию
        coverImg.src = "images/flowsynapse.jpg";

        audio.src = radioStreamUrl;
        
        currentTimeText.innerText = "LIVE";
        durationTimeText.innerText = "••:••";
        progressBar.style.width = "100%"; 

        // Сразу запрашиваем свежие метаданные с сервера, не дожидаясь таймера
        updateRadioMetadata();

        // Запускаем регулярный опрос каждые 10 секунд, если радио активно играет
        if (radioTimer) clearInterval(radioTimer);
        if (isPlaying) {
            radioTimer = setInterval(updateRadioMetadata, 10000);
        }
        
        if (isPlaying) {
            audio.play().catch(e => console.log("Стрим ожидает запуска..."));
        }
    } else {
        // --- ВОЗВРАЩАЕМ ПЛЕЕР ФАЙЛОВ ---
        // Обязательно тушим таймер опроса порта 8000, чтобы не грузить сеть
        if (radioTimer) {
            clearInterval(radioTimer);
            radioTimer = null;
        }

        radioToggleBtn.classList.remove('radio-active');
        deckDisplay.innerText = "HI-FI";
        deckDisplay.style.color = "#00ffcc";
        deckDisplay.style.textShadow = "0 0 8px #00ffcc";

        nextBtn.classList.remove('btn-disabled');
        prevBtn.classList.remove('btn-disabled');
        progressBarContainer.style.opacity = '1';
        progressBarContainer.style.pointerEvents = 'auto';

        loadTrack(currentTrackIndex);
    }
}

radioToggleBtn.addEventListener('click', toggleRadioMode);

// 5. УПРАВЛЕНИЕ
function playTrack() {
    isPlaying = true;
    
    // Инициализируем аудиоконтекст при первом запуске (нужно для обхода политик браузера)
    if (!audioCtx) {
        initVisualizerContext();
    }

    if (isRadioMode && !audio.src.includes(radioStreamUrl)) {
        audio.src = radioStreamUrl; 
    }
    
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    if (isRadioMode && !radioTimer) {
    radioTimer = setInterval(updateRadioMetadata, 10000);
}

    audio.play().catch(e => console.log("Ошибка воспроизведения:", e));
    playBtn.innerText = '⏸';
}

function pauseTrack() {
    isPlaying = false;
    audio.pause();

    if (radioTimer) {
        clearInterval(radioTimer);
        radioTimer = null;
    }

    if (isRadioMode) {
        audio.src = ""; 
    }
    playBtn.innerText = '▶';
}

function nextTrack() {
    let nextIndex = currentTrackIndex + 1;
    if (nextIndex >= playlist.length) nextIndex = 0;
    loadTrack(nextIndex);
}

function prevTrack() {
    let prevIndex = currentTrackIndex - 1;
    if (prevIndex < 0) prevIndex = playlist.length - 1;
    loadTrack(prevIndex);
}

// Создание аудио-контекста после взаимодействия пользователя
function initVisualizerContext() {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        
        source = audioCtx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        updateGlow();
    } catch (e) {
        console.log("Не удалось запустить Web Audio API нода:", e);
    }
}

function updateGlow() {
    if (!analyser) return;
    analyser.getByteFrequencyData(dataArray);

    // Берем средние значения для частотных диапазонов
    let r = dataArray[10] / 255;   // Низкие (Bass)
    let g = dataArray[50] / 255;   // Средние (Mid)
    let b = dataArray[100] / 255;  // Высокие (Treble)

    document.documentElement.style.setProperty('--red-intensity', r || 0);
    document.documentElement.style.setProperty('--green-intensity', g || 0);
    document.documentElement.style.setProperty('--blue-intensity', b || 0);

    requestAnimationFrame(updateGlow);
}

playBtn.addEventListener('click', () => {
    if (isPlaying) pauseTrack(); else playTrack();
});

nextBtn.addEventListener('click', () => {
    if (!isRadioMode) nextTrack();
});
prevBtn.addEventListener('click', () => {
    if (!isRadioMode) prevTrack();
});

progressBarContainer.addEventListener('click', (e) => {
    if (isRadioMode) return; 
    const width = progressBarContainer.clientWidth;
    const clickX = e.offsetX;
    const duration = audio.duration;
    if (duration) {
        audio.currentTime = (clickX / width) * duration;
    }
});

// Старт
initAudioListeners();
loadTrack(currentTrackIndex);
