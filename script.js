// ========== Данные о треках ==========
const tracks = [
    // Поп
    {
        id: 1,
        title: "Летний день",
        artist: "The Sunnyboys",
        genre: "pop",
        duration: 213,
        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        album: "Альбом 1",
        cover: "https://via.placeholder.com/200/FF69B4/FFFFFF?text=Pop"
    },
    {
        id: 2,
        title: "Танцующая ночь",
        artist: "DJ Sparkle",
        genre: "pop",
        duration: 195,
        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
        album: "Альбом 1",
        cover: "https://via.placeholder.com/200/FF69B4/FFFFFF?text=Pop"
    },
    // Рок
    {
        id: 3,
        title: "Каменная дорога",
        artist: "Rock Legends",
        genre: "rock",
        duration: 245,
        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
        album: "Альбом 2",
        cover: "https://via.placeholder.com/200/FF6347/FFFFFF?text=Rock"
    },
    {
        id: 4,
        title: "Электрический удар",
        artist: "Thunder Road",
        genre: "rock",
        duration: 267,
        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
        album: "Альбом 2",
        cover: "https://via.placeholder.com/200/FF6347/FFFFFF?text=Rock"
    },
    // Электроника
    {
        id: 5,
        title: "Синтезатор света",
        artist: "Neon Pulse",
        genre: "electronic",
        duration: 198,
        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
        album: "Альбом 3",
        cover: "https://via.placeholder.com/200/00CED1/FFFFFF?text=Electronic"
    },
    {
        id: 6,
        title: "Битовая метаморфоза",
        artist: "Beat Master",
        genre: "electronic",
        duration: 224,
        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
        album: "Альбом 3",
        cover: "https://via.placeholder.com/200/00CED1/FFFFFF?text=Electronic"
    },
    // Джаз
    {
        id: 7,
        title: "Ночной саксофон",
        artist: "Jazz Cafe",
        genre: "jazz",
        duration: 289,
        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        album: "Альбом 4",
        cover: "https://via.placeholder.com/200/FFD700/000000?text=Jazz"
    },
    {
        id: 8,
        title: "Импровизация в синем",
        artist: "Blue Notes",
        genre: "jazz",
        duration: 267,
        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
        album: "Альбом 4",
        cover: "https://via.placeholder.com/200/FFD700/000000?text=Jazz"
    },
    // Хип-Хоп
    {
        id: 9,
        title: "Уличный ритм",
        artist: "Hip Hop Kings",
        genre: "hip-hop",
        duration: 206,
        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
        album: "Альбом 5",
        cover: "https://via.placeholder.com/200/00FF00/000000?text=Hip-Hop"
    },
    {
        id: 10,
        title: "Микрофонный огонь",
        artist: "Rap Phoenix",
        genre: "hip-hop",
        duration: 213,
        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
        album: "Альбом 5",
        cover: "https://via.placeholder.com/200/00FF00/000000?text=Hip-Hop"
    },
    // Акустика
    {
        id: 11,
        title: "Гитарные струны",
        artist: "Acoustic Hearts",
        genre: "acoustic",
        duration: 245,
        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
        album: "Альбом 6",
        cover: "https://via.placeholder.com/200/8B4513/FFFFFF?text=Acoustic"
    },
    {
        id: 12,
        title: "Деревенская мелодия",
        artist: "Folk Harmony",
        genre: "acoustic",
        duration: 198,
        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
        album: "Альбом 6",
        cover: "https://via.placeholder.com/200/8B4513/FFFFFF?text=Acoustic"
    }
];

// ========== Переменные плеера ==========
let currentTrackIndex = 0;
let isPlaying = false;
let currentGenre = null;
let playlist = [...tracks];

const audioPlayer = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const progressInput = document.getElementById('progressInput');
const volumeControl = document.getElementById('volumeControl');

// ========== Инициализация ==========
function init() {
    loadTrack(0);
    setupEventListeners();
    renderPlaylist();
}

// ========== Установка слушателей событий ==========
function setupEventListeners() {
    audioPlayer.addEventListener('loadedmetadata', updateDuration);
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('ended', nextTrack);
    
    progressInput.addEventListener('input', (e) => {
        audioPlayer.currentTime = (e.target.value / 100) * audioPlayer.duration;
    });

    volumeControl.addEventListener('input', (e) => {
        audioPlayer.volume = e.target.value / 100;
    });

    // Навигация
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
}

// ========== Загрузка трека ==========
function loadTrack(index) {
    if (playlist.length === 0) return;
    
    currentTrackIndex = index;
    const track = playlist[index];
    
    audioPlayer.src = track.src;
    document.getElementById('trackTitle').textContent = track.title;
    document.getElementById('trackArtist').textContent = track.artist;
    document.getElementById('trackGenre').textContent = track.genre.toUpperCase();
    document.getElementById('albumImage').src = track.cover;
    
    updatePlaylistUI();
}

// ========== Воспроизведение/Пауза ==========
function togglePlay() {
    if (isPlaying) {
        audioPlayer.pause();
        playBtn.textContent = '▶️';
        isPlaying = false;
    } else {
        audioPlayer.play().catch(err => {
            console.error('Ошибка при воспроизведении:', err);
        });
        playBtn.textContent = '⏸️';
        isPlaying = true;
    }
}

// ========== Следующий трек ==========
function nextTrack() {
    if (currentTrackIndex < playlist.length - 1) {
        loadTrack(currentTrackIndex + 1);
        if (isPlaying) {
            audioPlayer.play();
        }
    } else {
        // Циклический плей
        loadTrack(0);
        if (isPlaying) {
            audioPlayer.play();
        }
    }
}

// ========== Предыдущий трек ==========
function previousTrack() {
    if (currentTrackIndex > 0) {
        loadTrack(currentTrackIndex - 1);
        if (isPlaying) {
            audioPlayer.play();
        }
    } else {
        loadTrack(playlist.length - 1);
        if (isPlaying) {
            audioPlayer.play();
        }
    }
}

// ========== Обновление прогресса ==========
function updateProgress() {
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressInput.value = progress;
    document.getElementById('progress').style.width = progress + '%';
    
    document.getElementById('currentTime').textContent = formatTime(audioPlayer.currentTime);
}

// ========== Обновление длительности ==========
function updateDuration() {
    document.getElementById('duration').textContent = formatTime(audioPlayer.duration);
    progressInput.max = 100;
}

// ========== Форматирование времени ==========
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ========== Фильтрация по жанру ==========
function filterByGenre(genre) {
    currentGenre = genre;
    if (genre === 'all') {
        playlist = [...tracks];
    } else {
        playlist = tracks.filter(track => track.genre === genre);
    }
    
    if (playlist.length > 0) {
        loadTrack(0);
        renderPlaylist();
    }
}

// ========== Воспроизведение альбома ==========
function playAlbum(albumId) {
    // Фильтруем треки по альбому
    const albumTracks = tracks.filter(track => track.album === `Альбом ${albumId}`);
    if (albumTracks.length > 0) {
        playlist = albumTracks;
        loadTrack(0);
        audioPlayer.play();
        playBtn.textContent = '⏸️';
        isPlaying = true;
        renderPlaylist();
    }
}

// ========== Отрисовка плейлиста ==========
function renderPlaylist() {
    const playlistContainer = document.getElementById('playlistTracks');
    playlistContainer.innerHTML = '';
    
    playlist.forEach((track, index) => {
        const trackElement = document.createElement('div');
        trackElement.className = 'track-item';
        if (index === currentTrackIndex) {
            trackElement.classList.add('active');
        }
        
        trackElement.innerHTML = `
            <div class="track-item-info">
                <div class="track-item-title">${track.title}</div>
                <div class="track-item-meta">${track.artist} • ${track.genre}</div>
            </div>
            <div class="track-item-duration">${formatTime(track.duration)}</div>
        `;
        
        trackElement.addEventListener('click', () => {
            const absoluteIndex = tracks.indexOf(track);
            loadTrack(absoluteIndex);
            audioPlayer.play();
            playBtn.textContent = '⏸️';
            isPlaying = true;
        });
        
        playlistContainer.appendChild(trackElement);
    });
}

// ========== Обновление UI плейлиста ==========
function updatePlaylistUI() {
    document.querySelectorAll('.track-item').forEach((item, index) => {
        item.classList.remove('active');
        if (index === currentTrackIndex) {
            item.classList.add('active');
        }
    });
}

// ========== Запуск при загрузке страницы ==========
document.addEventListener('DOMContentLoaded', init);
