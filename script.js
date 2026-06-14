// 1. НАШ СПИСОК ТРЕКОВ
const playlist = [
    'Picotiny - Шторм.mp3',
    'Picotiny - Елки-ежики.mp3',
    'Picotiny - Портал.mp3',
    'Picotiny - Встреча.mp3',
    'Picotiny - Звезды в руках.mp3',
    'Picotiny - Кэп.mp3'
];
// Твой поток радио из AzuraCast
const radioStreamUrl = 'https://176.94.74.177:8000/radio.mp3';

let currentTrackIndex = 0; 
let isPlaying = false;
let isRadioMode = false; // По умолчанию режим плеера файлов

// Автоматически экранируем спецсимволы в путях файлов (пробелы, кириллицу)
let audioPath = `playlist/${encodeURIComponent(playlist[currentTrackIndex])}`;
let audio = new Audio(audioPath);

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

// Вспомогательная функция: правильно читает текст из байтов ID3 (обрабатывает Unicode)
function readID3String(view, offset, size) {
    if (size <= 1) return "";
    const encoding = view.getUint8(offset);
    let start = offset + 1;
    let length = size - 1;

    if (encoding === 1 || encoding === 2) { 
        if (length >= 2 && ((view.getUint8(start) === 0xFF && view.getUint8(start+1) === 0xFE) || (view.getUint8(start) === 0xFE && view.getUint8(start+1) === 0xFF))) {
            start += 2;
            length -= 2;
        }
        const utf16Data = new Uint16Array(length / 2);
        for (let i = 0; i < utf16Data.length; i++) {
            utf16Data[i] = view.getUint16(start + i * 2, true); 
        }
        let str = String.fromCharCode.apply(null, utf16Data);
        return str.replace(/\0+$/, '').trim();
    } else { 
        let strData = [];
        for (let i = 0; i < length; i++) {
            const charCode = view.getUint8(start + i);
            if (charCode === 0) break;
            strData.push(charCode);
        }
        try {
            return new TextDecoder('utf-8').decode(new Uint8Array(strData)).trim();
        } catch(e) {
            return String.fromCharCode.apply(null, strData).trim();
        }
    }
}

// 2. ФУНКЦИЯ ЗАГРУЗКИ ТРЕКА И ЕГО МЕТАДАННЫХ
async function loadTrack(index) {
    audio.pause();
    
    if (coverImg.src && coverImg.src.startsWith('blob:')) {
        URL.revokeObjectURL(coverImg.src);
    }
    coverImg.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'></svg>";
    
    currentTrackIndex = index;
    audioPath = `playlist/${encodeURIComponent(playlist[currentTrackIndex])}`;
    
    audio = new Audio(audioPath);
    initAudioListeners();

    progressBar.style.width = '0%';
    currentTimeText.innerText = '0:00';
    durationTimeText.innerText = '0:00';

    if (isPlaying) {
        audio.play().catch(e => console.log("Ждем клика..."));
    }
    
    const cleanName = playlist[currentTrackIndex].replace('.mp3', '');
    let fallbackArtist = cleanName.includes(' - ') ? cleanName.split(' - ')[0] : "Picotiny";
    let fallbackTitle = cleanName.includes(' - ') ? cleanName.split(' - ')[1] : cleanName;

    try {
        const response = await fetch(audioPath);
        const buffer = await response.arrayBuffer();
        const view = new DataView(buffer);

        if (view.getUint8(0) === 0x49 && view.getUint8(1) === 0x44 && view.getUint8(2) === 0x33) {
            const bufferLength = buffer.byteLength;
            let offset = 10;

            let extractedTitle = "";
            let extractedArtist = "";
            let hasPicture = false;

            while (offset < bufferLength - 10) {
                const frameId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset+1), view.getUint8(offset+2), view.getUint8(offset+3));
                const frameSize = view.getUint32(offset + 4, false);

                if (frameSize <= 0 || (offset + 10 + frameSize) > bufferLength) break;

                if (frameId === 'TIT2') {
                    extractedTitle = readID3String(view, offset + 10, frameSize);
                }
                else if (frameId === 'TPE1') {
                    extractedArtist = readID3String(view, offset + 10, frameSize);
                }
                else if (frameId === 'APIC') {
                    let imgOffset = offset + 10;
                    const textEncoding = view.getUint8(imgOffset);
                    imgOffset++;

                    let mimeTypeString = "";
                    while (view.getUint8(imgOffset) !== 0) {
                        mimeTypeString += String.fromCharCode(view.getUint8(imgOffset));
                        imgOffset++;
                    }
                    imgOffset++;

                    const pictureType = view.getUint8(imgOffset);
                    imgOffset++;

                    while (view.getUint8(imgOffset) !== 0) imgOffset++;
                    imgOffset++;

                    const imgData = buffer.slice(imgOffset, offset + 10 + frameSize);
                    const finalMime = mimeTypeString || 'image/jpeg';
                    const blob = new Blob([imgData], { type: finalMime });
                    
                    coverImg.src = URL.createObjectURL(blob);
                    hasPicture = true;
                }

                offset += 10 + frameSize;
            }

            titleText.innerText = extractedTitle || fallbackTitle;
            artistText.innerText = extractedArtist || fallbackArtist;
            if (hasPicture) return; 
        }
    } catch (e) {
        console.log("Ошибка чтения внутренних тегов:", e);
    }

    titleText.innerText = fallbackTitle;
    artistText.innerText = fallbackArtist;
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

        titleText.innerText = "Прямой Эфир";
        artistText.innerText = "Flow Synapse"
        coverImg.src = "images/flowsynapse.jpg";

        audio.src = radioStreamUrl;
        
        currentTimeText.innerText = "LIVE";
        durationTimeText.innerText = "••:••";
        progressBar.style.width = "100%"; 

        if (isPlaying) {
            audio.play().catch(e => console.log("Стрим ожидает запуска..."));
        }
    } else {
        // --- ВОЗВРАЩАЕМ ПЛЕЕР ФАЙЛОВ ---
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
    if (isRadioMode) {
        audio.src = radioStreamUrl; 
    }
    audio.play().catch(e => console.log("Ошибка воспроизведения:", e));
    playBtn.innerText = '⏸';
}

// Изменено: Стрелочная функция заменена на полноценную декларацию, чтобы не было конфликтов объявлений
function pauseTrack() {
    isPlaying = false;
    audio.pause();
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
