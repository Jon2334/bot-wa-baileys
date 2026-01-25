// index.js - VERSION WITH MONGODB AUTH
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Import Baileys
import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    downloadContentFromMessage,
    makeCacheableSignalKeyStore,
    Browsers,
    proto,
    getContentType
} from '@whiskeysockets/baileys';

import { Boom } from '@hapi/boom';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import sharp from 'sharp';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import Groq from 'groq-sdk';
import { fileURLToPath } from 'url';

// ✅ IMPORT MONGODB AUTH
import { useMongoAuthState } from './mongoAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execPromise = promisify(exec);
const NodeCache = require("node-cache");
const msgRetryCounterCache = new NodeCache();

// Konfigurasi
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

const BOT_NAME = 'Jonkris-Bot';
const OWNER_NUMBER = '6289509158681';
const OWNER_JID = '103066632216677@lid'; // ⭐ ID dari log

const SPAM_LIMIT = 5;
const SPAM_WINDOW = 10000;
const BLOCK_DURATION = 300000;

let currentQR = null;
const FORCE_NEW_SESSION = false;
const BOT_START_TIME = Date.now();

const bannedUsers = new Set();
const welcomeEnabled = new Map(); // Untuk menyimpan status welcome per grup

// State management
const messageStore = {};
const spamTracker = new Map();
const blockedUsers = new Map();
const tebakKataGames = new Map();
const tebakBenderaGames = new Map();
const kuisGames = new Map();
const viewOnceMessages = new Map();

// 🌟 ANTI VIEWONCE CONFIG
const ANTI_VIEWONCE_ENABLED = true;
const VIEWONCE_SAVE_FOLDER = './viewonce_saved';
if (ANTI_VIEWONCE_ENABLED && !fs.existsSync(VIEWONCE_SAVE_FOLDER)) {
    fs.mkdirSync(VIEWONCE_SAVE_FOLDER, { recursive: true });
}

const reactions = ['❤️', '👍', '🔥', '😂', '😮', '😢', '🙏', '👏', '🎉', '💯', '✨', '⚡', '💪', '🤝', '🌟'];

// Utility Functions
function getRandomReaction() {
    return reactions[Math.floor(Math.random() * reactions.length)];
}

function getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 11) return 'Selamat Pagi';
    if (hour >= 11 && hour < 15) return 'Selamat Siang';
    if (hour >= 15 && hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
}

function getFormattedDate() {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    const now = new Date();
    const day = days[now.getDay()];
    const date = now.getDate();
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    
    return {
        full: `${day}, ${date} ${month} ${year}`,
        time: time,
        day: day
    };
}

// 🎮 AI GAME GENERATION (TIDAK HARDCODE)
async function generateGameQuestion(gameType) {
    if (!groq) {
        // Fallback jika AI tidak tersedia
        const fallbackGames = {
            tebakkata: [
                { question: "Aku bisa menulis tapi tak punya tangan, bisa membaca tapi tak punya mata", answer: "komputer" },
                { question: "Semakin banyak kamu ambil, semakin besar aku menjadi", answer: "lubang" },
                { question: "Berjalan tanpa kaki, menangis tanpa mata", answer: "awan" }
            ],
            tebakbendera: [
                { country: "Indonesia", emoji: "🇮🇩", clue: "Merah putih" },
                { country: "Malaysia", emoji: "🇲🇾", clue: "Jalur gemilang" },
                { country: "Singapore", emoji: "🇸🇬", clue: "Bulan sabit dan bintang" }
            ],
            kuis: [
                { question: "Ibukota Indonesia?", answer: "jakarta", options: ["Jakarta", "Bandung", "Surabaya", "Medan"] },
                { question: "Planet terbesar di tata surya?", answer: "jupiter", options: ["Jupiter", "Saturnus", "Bumi", "Mars"] },
                { question: "Penemu bola lampu?", answer: "thomas edison", options: ["Thomas Edison", "Albert Einstein", "Nikola Tesla", "Alexander Graham Bell"] }
            ]
        };
        
        const games = fallbackGames[gameType] || fallbackGames.tebakkata;
        return games[Math.floor(Math.random() * games.length)];
    }
    
    try {
        let systemPrompt = '';
        let userPrompt = '';
        
        switch(gameType) {
            case 'tebakkata':
                systemPrompt = `Kamu adalah generator teka-teki (tebak kata). Buat TEKA-TEKI SINGKAT dalam bahasa Indonesia.
Contoh format: "Teka-teki: [PERTANYAAN]\nJawaban: [JAWABAN]"
Jawaban harus 1 kata saja.
Buat yang kreatif dan tidak umum.`;
                userPrompt = 'Buat sebuah teka-teki dalam bahasa Indonesia dengan jawaban 1 kata.';
                break;
                
            case 'tebakbendera':
                systemPrompt = `Kamu adalah generator game tebak bendera. Berikan informasi tentang sebuah negara.
Format: "Negara: [NAMA NEGARA]\nBendera: [EMOJI BENDERA]\nClue: [PETUNJUK TENTANG BENDERA/NEGARA]"
Gunakan emoji bendera yang benar.`;
                userPrompt = 'Berikan informasi tentang sebuah negara untuk game tebak bendera.';
                break;
                
            case 'kuis':
                systemPrompt = `Kamu adalah generator kuis. Buat pertanyaan kuis dengan 4 pilihan jawaban.
Format: "Pertanyaan: [PERTANYAAN]\nJawaban: [JAWABAN BENAR]\nPilihan: [1. PILIHAN A], [2. PILIHAN B], [3. PILIHAN C], [4. PILIHAN D]"
Jawaban harus sesuai dengan salah satu pilihan.`;
                userPrompt = 'Buat sebuah pertanyaan kuis dengan 4 pilihan jawaban.';
                break;
        }
        
        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            model: 'llama-3.3-70b-versatile',
            max_tokens: 200,
            temperature: 0.8
        });
        
        const response = completion.choices[0].message.content.trim();
        console.log(`🎮 AI Generated ${gameType}:`, response);
        
        // Parse response
        if (gameType === 'tebakkata') {
            const lines = response.split('\n');
            const question = lines.find(l => l.includes('Teka-teki:') || l.includes('teka-teki:') || l.includes('Pertanyaan:'));
            const answer = lines.find(l => l.includes('Jawaban:'));
            
            if (question && answer) {
                return {
                    question: question.replace(/.*:/, '').trim(),
                    answer: answer.replace(/.*:/, '').trim().toLowerCase()
                };
            }
        } else if (gameType === 'tebakbendera') {
            const lines = response.split('\n');
            const countryLine = lines.find(l => l.includes('Negara:'));
            const emojiLine = lines.find(l => l.includes('Bendera:'));
            const clueLine = lines.find(l => l.includes('Clue:'));
            
            if (countryLine) {
                return {
                    country: countryLine.replace(/.*:/, '').trim(),
                    emoji: emojiLine ? emojiLine.replace(/.*:/, '').trim() : "🏳️",
                    clue: clueLine ? clueLine.replace(/.*:/, '').trim() : "Tebak negara ini"
                };
            }
        } else if (gameType === 'kuis') {
            const lines = response.split('\n');
            const questionLine = lines.find(l => l.includes('Pertanyaan:'));
            const answerLine = lines.find(l => l.includes('Jawaban:'));
            const optionsLine = lines.find(l => l.includes('Pilihan:'));
            
            if (questionLine && answerLine) {
                const options = [];
                if (optionsLine) {
                    const optionsText = optionsLine.replace(/.*:/, '').trim();
                    const optionMatches = optionsText.match(/\[(.*?)\]/g);
                    if (optionMatches) {
                        options.push(...optionMatches.map(o => o.replace(/[\[\]]/g, '')));
                    }
                }
                
                // Jika options tidak lengkap, tambahkan dummy
                while (options.length < 4) {
                    options.push(`Pilihan ${options.length + 1}`);
                }
                
                return {
                    question: questionLine.replace(/.*:/, '').trim(),
                    answer: answerLine.replace(/.*:/, '').trim().toLowerCase(),
                    options: options.slice(0, 4)
                };
            }
        }
        
        throw new Error('Gagal parsing response AI');
        
    } catch (e) {
        console.error(`❌ AI Game Generation error:`, e.message);
        // Fallback ke database lokal
        return generateLocalGame(gameType);
    }
}

function generateLocalGame(gameType) {
    const localGames = {
        tebakkata: [
            { question: "Aku bisa menulis tapi tak punya tangan, bisa membaca tapi tak punya mata", answer: "komputer" },
            { question: "Semakin banyak kamu ambil, semakin besar aku menjadi", answer: "lubang" },
            { question: "Berjalan tanpa kaki, menangis tanpa mata", answer: "awan" },
            { question: "Benda apa yang kalau dibuka berat, ditutup ringan?", answer: "payung" },
            { question: "Aku punya kota tapi tak punya rumah, punya hutan tapi tak punya pohon", answer: "peta" }
        ],
        tebakbendera: [
            { country: "Indonesia", emoji: "🇮🇩", clue: "Merah putih" },
            { country: "Malaysia", emoji: "🇲🇾", clue: "Jalur gemilang" },
            { country: "Singapore", emoji: "🇸🇬", clue: "Bulan sabit dan bintang" },
            { country: "Japan", emoji: "🇯🇵", clue: "Matahari terbit" },
            { country: "USA", emoji: "🇺🇸", clue: "Stars and stripes" }
        ],
        kuis: [
            { question: "Ibukota Indonesia?", answer: "jakarta", options: ["Jakarta", "Bandung", "Surabaya", "Medan"] },
            { question: "Planet terbesar di tata surya?", answer: "jupiter", options: ["Jupiter", "Saturnus", "Bumi", "Mars"] },
            { question: "Warna campuran merah dan biru?", answer: "ungu", options: ["Ungu", "Hijau", "Kuning", "Orange"] },
            { question: "Hewan tercepat di dunia?", answer: "cheetah", options: ["Cheetah", "Singa", "Elang", "Ikan Layar"] },
            { question: "Penemu bola lampu?", answer: "thomas edison", options: ["Thomas Edison", "Albert Einstein", "Nikola Tesla", "Alexander Graham Bell"] }
        ]
    };
    
    const games = localGames[gameType] || localGames.tebakkata;
    return games[Math.floor(Math.random() * games.length)];
}

async function getAICodingMotivation() {
    if (!groq) {
        return 'Code is poetry. Setiap baris adalah karya seni! 💻✨';
    }
    
    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { 
                    role: 'system', 
                    content: 'You are a creative motivational speaker for programmers and developers. Create ONE short, inspiring quote about coding, programming, software development, or technology. Use Indonesian language. Maximum 15 words. Must be unique, creative, and motivating. Add relevant emoji at the end. Do NOT use common cliches. Be creative and original.' 
                },
                { role: 'user', content: 'Generate a unique coding motivation quote in Indonesian' }
            ],
            model: 'llama-3.3-70b-versatile',
            max_tokens: 100,
            temperature: 1.2
        });
        
        const motivation = completion.choices[0].message.content.trim();
        console.log('✅ AI Generated Motivation:', motivation);
        return motivation;
    } catch (e) {
        console.error('❌ AI Motivation error:', e.message);
        return 'Setiap bug adalah pelajaran. Tetap coding! 🚀';
    }
}

// 📥 DOWNLOADER FUNCTIONS (FIXED & WORKING)
async function downloadMedia(url, options = {}) {
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer',
            timeout: 60000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://www.youtube.com/',
                ...options.headers
            },
            ...options
        });
        
        return Buffer.from(response.data);
    } catch (error) {
        console.error('Download error:', error.message);
        throw error;
    }
}

// YouTube Downloader menggunakan API yang bekerja
async function downloadYouTube(url, type = 'mp3') {
    try {
        console.log(`📥 Downloading YouTube ${type}: ${url}`);
        
        // API 1: y2mate API terbaru
        const api1 = `https://api.y2mate.guru/api/convert`;
        
        const response1 = await axios.post(api1, {
            url: url,
            format: type === 'mp3' ? 'mp3' : 'mp4'
        }, {
            timeout: 90000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Content-Type': 'application/json'
            }
        });
        
        if (response1.data && (response1.data.url || response1.data.downloadUrl || response1.data.videoUrl)) {
            const downloadUrl = response1.data.url || response1.data.downloadUrl || response1.data.videoUrl;
            return {
                url: downloadUrl,
                title: response1.data.title || 'YouTube Media',
                duration: response1.data.duration || '0:00'
            };
        }
        
        // API 2: API alternatif
        const api2 = `https://youtube-api.deta.dev/info?url=${encodeURIComponent(url)}`;
        const response2 = await axios.get(api2, { timeout: 30000 });
        
        if (response2.data && response2.data.formats) {
            let bestFormat = null;
            if (type === 'mp3') {
                // Cari format audio terbaik
                bestFormat = response2.data.formats.find(f => f.hasAudio && !f.hasVideo) || 
                            response2.data.formats.find(f => f.hasAudio);
            } else {
                // Cari format video terbaik
                bestFormat = response2.data.formats.find(f => f.hasVideo && f.quality === '720p') ||
                            response2.data.formats.find(f => f.hasVideo);
            }
            
            if (bestFormat && bestFormat.url) {
                return {
                    url: bestFormat.url,
                    title: response2.data.title || 'YouTube Media',
                    duration: response2.data.duration || '0:00'
                };
            }
        }
        
        throw new Error('Tidak dapat mendapatkan link download');
    } catch (error) {
        console.error('YouTube download error:', error.message);
        
        // Fallback API 3: Menggunakan ytdl-core alternative
        try {
            const fallbackApi = `https://yt-downloader-api.vercel.app/info?url=${encodeURIComponent(url)}`;
            const fallbackResponse = await axios.get(fallbackApi, { timeout: 30000 });
            
            if (fallbackResponse.data && fallbackResponse.data.formats) {
                const formats = fallbackResponse.data.formats;
                let downloadUrl = null;
                
                if (type === 'mp3') {
                    const audioFormat = formats.find(f => f.mimeType && f.mimeType.includes('audio'));
                    if (audioFormat && audioFormat.url) {
                        downloadUrl = audioFormat.url;
                    }
                } else {
                    const videoFormat = formats.find(f => f.qualityLabel === '720p') || 
                                      formats.find(f => f.hasVideo);
                    if (videoFormat && videoFormat.url) {
                        downloadUrl = videoFormat.url;
                    }
                }
                
                if (downloadUrl) {
                    return {
                        url: downloadUrl,
                        title: fallbackResponse.data.title || 'YouTube Media',
                        duration: fallbackResponse.data.duration || '0:00'
                    };
                }
            }
        } catch (fallbackError) {
            console.error('Fallback YouTube error:', fallbackError.message);
        }
        
        // Fallback terakhir: menggunakan savefrom.net
        try {
            const saveFromUrl = `https://savefrom.net/@api/button/mp3/${encodeURIComponent(url)}`;
            if (type === 'mp3') {
                return {
                    url: saveFromUrl,
                    title: 'YouTube Audio',
                    duration: 'N/A'
                };
            } else {
                const saveFromVideo = `https://savefrom.net/@api/button/video/${encodeURIComponent(url)}`;
                return {
                    url: saveFromVideo,
                    title: 'YouTube Video',
                    duration: 'N/A'
                };
            }
        } catch (e) {
            console.error('SaveFrom error:', e.message);
        }
        
        throw new Error(`Gagal download YouTube ${type}`);
    }
}

// TikTok Downloader
async function downloadTikTok(url) {
    try {
        console.log(`📥 Downloading TikTok: ${url}`);
        
        // API 1: tiktok downloader API
        const api1 = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
        const response1 = await axios.get(api1, { 
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response1.data && response1.data.data) {
            const data = response1.data.data;
            return {
                url: data.play || data.hdplay || data.wmplay || data.nowm,
                title: data.title || 'TikTok Video',
                author: data.author?.nickname || 'Unknown',
                duration: data.duration || 0
            };
        }
        
        // API 2: API alternatif
        const api2 = `https://tikdown.org/api?url=${encodeURIComponent(url)}`;
        const response2 = await axios.get(api2, { timeout: 30000 });
        
        if (response2.data && response2.data.video) {
            return {
                url: response2.data.video,
                title: 'TikTok Video',
                author: 'TikTok User',
                duration: 0
            };
        }
        
        throw new Error('Tidak dapat mendapatkan link download');
    } catch (error) {
        console.error('TikTok download error:', error.message);
        
        // Fallback API
        try {
            const fallbackApi = `https://api.tikmate.app/api/lookup?url=${encodeURIComponent(url)}`;
            const fallbackResponse = await axios.get(fallbackApi, { 
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (fallbackResponse.data && fallbackResponse.data.video_url) {
                return {
                    url: fallbackResponse.data.video_url,
                    title: fallbackResponse.data.description || 'TikTok Video',
                    author: fallbackResponse.data.author_name || 'Unknown',
                    duration: fallbackResponse.data.duration || 0
                };
            }
        } catch (fallbackError) {
            console.error('Fallback TikTok error:', fallbackError.message);
        }
        
        throw new Error('Gagal download TikTok');
    }
}

// Instagram Downloader
async function downloadInstagram(url) {
    try {
        console.log(`📥 Downloading Instagram: ${url}`);
        
        // API 1: API instagram downloader
        const api1 = `https://instagram-downloader-download-instagram-videos-stories.p.rapidapi.com/index`;
        
        const response1 = await axios.get(api1, {
            params: {
                url: url
            },
            headers: {
                'X-RapidAPI-Key': 'd2d1a5d2c3msh9b4c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4',
                'X-RapidAPI-Host': 'instagram-downloader-download-instagram-videos-stories.p.rapidapi.com'
            },
            timeout: 30000
        });
        
        if (response1.data && (response1.data.media || response1.data.video || response1.data.image)) {
            const media = response1.data.media || response1.data.video || response1.data.image;
            return {
                url: Array.isArray(media) ? media[0] : media,
                type: response1.data.type || 'video',
                title: response1.data.title || 'Instagram Media',
                thumbnail: response1.data.thumbnail || null
            };
        }
        
        // API 2: API alternatif tanpa key
        const api2 = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`;
        const response2 = await axios.get(api2, { timeout: 30000 });
        
        if (response2.data && response2.data.thumbnail_url) {
            return {
                url: response2.data.thumbnail_url,
                type: 'image',
                title: response2.data.title || 'Instagram Photo'
            };
        }
        
        throw new Error('Tidak dapat mendapatkan link download');
    } catch (error) {
        console.error('Instagram download error:', error.message);
        
        // Fallback API: menggunakan saveig
        try {
            const fallbackApi = `https://saveig.app/api/ajaxSearch`;
            const formData = new URLSearchParams();
            formData.append('url', url);
            
            const fallbackResponse = await axios.post(fallbackApi, formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 30000
            });
            
            if (fallbackResponse.data && fallbackResponse.data.data) {
                const data = fallbackResponse.data.data;
                if (data.videos && data.videos.length > 0) {
                    return {
                        url: data.videos[0].url || data.videos[0],
                        type: 'video',
                        title: 'Instagram Video',
                        thumbnail: data.thumbnail || null
                    };
                } else if (data.images && data.images.length > 0) {
                    return {
                        url: data.images[0].url || data.images[0],
                        type: 'image',
                        title: 'Instagram Photo'
                    };
                }
            }
        } catch (fallbackError) {
            console.error('Fallback Instagram error:', fallbackError.message);
        }
        
        throw new Error('Gagal download Instagram');
    }
}

// Shortlink
async function createShortlink(url) {
    try {
        const response = await axios.post('https://shortlinkapi.vercel.app/api/shorten', {
            url: url
        }, {
            timeout: 10000
        });
        
        return response.data.shortUrl || response.data.url || url;
    } catch (error) {
        console.error('Shortlink error:', error.message);
        // Fallback menggunakan tinyurl
        try {
            const tinyurl = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`;
            const response = await axios.get(tinyurl, { timeout: 5000 });
            return response.data;
        } catch {
            return url;
        }
    }
}

function saveMessage(m) {
    try {
        if (!m || !m.key) return;
        const jid = m.key.remoteJid;
        const id = m.key.id;
        if (!messageStore[jid]) messageStore[jid] = {};
        messageStore[jid][id] = {
            fullMessage: m,
            timestamp: Date.now(),
            pushName: m.pushName || 'Unknown'
        };
        const keys = Object.keys(messageStore[jid]);
        if (keys.length > 50) delete messageStore[jid][keys[0]];
    } catch (e) {
        console.error('saveMessage error:', e.message);
    }
}

function getMessage(jid, id) {
    if (messageStore[jid] && messageStore[jid][id]) {
        return messageStore[jid][id];
    }
    return null;
}

function checkSpam(userId) {
    const now = Date.now();
    
    if (blockedUsers.has(userId)) {
        const blockEnd = blockedUsers.get(userId);
        if (now < blockEnd) {
            return { isBlocked: true, timeLeft: Math.ceil((blockEnd - now) / 1000) };
        } else {
            blockedUsers.delete(userId);
            spamTracker.delete(userId);
        }
    }
    
    if (!spamTracker.has(userId)) {
        spamTracker.set(userId, []);
    }
    
    const userMessages = spamTracker.get(userId);
    const recentMessages = userMessages.filter(time => now - time < SPAM_WINDOW);
    
    recentMessages.push(now);
    spamTracker.set(userId, recentMessages);
    
    if (recentMessages.length > SPAM_LIMIT) {
        const blockUntil = now + BLOCK_DURATION;
        blockedUsers.set(userId, blockUntil);
        return { isSpam: true, blockUntil };
    }
    
    return { isOk: true };
}

function formatRuntime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    
    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m `;
    if (seconds > 0) result += `${seconds}s`;
    
    return result.trim() || '0s';
}

async function downloadMediaMessage(message, mediaType) {
    try {
        const stream = await downloadContentFromMessage(message, mediaType);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        return Buffer.concat(chunks);
    } catch (error) {
        console.error('Download error:', error.message);
        throw error;
    }
}

async function createSticker(buffer, isVideo) {
    try {
        const tempDir = './temp';
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        
        const timestamp = Date.now();
        
        if (isVideo) {
            const inputPath = path.join(tempDir, `input_${timestamp}.mp4`);
            const outputPath = path.join(tempDir, `sticker_${timestamp}.webp`);
            
            fs.writeFileSync(inputPath, buffer);
            
            await execPromise(`ffmpeg -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba" -c:v libwebp -lossless 0 -q:v 80 -compression_level 6 -preset default -loop 0 -an -t 7 "${outputPath}"`);
            
            const stickerBuffer = fs.readFileSync(outputPath);
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
            
            return stickerBuffer;
        } else {
            const stickerBuffer = await sharp(buffer)
                .resize(512, 512, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .webp({ quality: 95 })
                .toBuffer();
            
            return stickerBuffer;
        }
    } catch (error) {
        console.error('Sticker error:', error.message);
        throw error;
    }
}

async function convertStickerToImage(stickerBuffer) {
    try {
        const tempDir = './temp';
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        
        const timestamp = Date.now();
        const inputPath = path.join(tempDir, `sticker_${timestamp}.webp`);
        const outputPath = path.join(tempDir, `image_${timestamp}.png`);
        
        fs.writeFileSync(inputPath, stickerBuffer);
        
        await sharp(inputPath)
            .png()
            .toFile(outputPath);
        
        const imageBuffer = fs.readFileSync(outputPath);
        
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        
        return imageBuffer;
    } catch (error) {
        console.error('Sticker to image error:', error.message);
        throw error;
    }
}

// 🌟 ANTI VIEWONCE FUNCTION - FIXED VERSION
async function saveViewOnceMedia(sock, m) {
    try {
        if (!m.message) return;
        
        const msg = m.message;
        const sender = m.key.remoteJid;
        const senderName = m.pushName || 'Unknown';
        const messageId = m.key.id;
        
        // Cek apakah ini view once message
        const isViewOnce = 
            msg.viewOnceMessageV2 || 
            msg.viewOnceMessageV2Extension || 
            msg.viewOnceMessage || 
            (m.key && m.key.isViewOnce);
        
        if (!isViewOnce) {
            // Cek juga di extendedTextMessage
            if (msg.extendedTextMessage?.contextInfo?.quotedMessage) {
                const quotedMsg = msg.extendedTextMessage.contextInfo.quotedMessage;
                const quotedIsViewOnce = 
                    quotedMsg.viewOnceMessageV2 || 
                    quotedMsg.viewOnceMessageV2Extension || 
                    quotedMsg.viewOnceMessage;
                
                if (!quotedIsViewOnce) return;
            } else {
                return;
            }
        }
        
        console.log(`🔍 View Once message detected from ${senderName}`);
        
        let mediaBuffer = null;
        let mediaType = null;
        let caption = '';
        
        // Extract view once content
        let viewOnceContent = null;
        
        if (msg.viewOnceMessageV2) {
            viewOnceContent = msg.viewOnceMessageV2.message;
        } else if (msg.viewOnceMessageV2Extension) {
            viewOnceContent = msg.viewOnceMessageV2Extension.message;
        } else if (msg.viewOnceMessage) {
            viewOnceContent = msg.viewOnceMessage.message;
        } else if (msg.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quotedMsg = msg.extendedTextMessage.contextInfo.quotedMessage;
            if (quotedMsg.viewOnceMessageV2) {
                viewOnceContent = quotedMsg.viewOnceMessageV2.message;
            } else if (quotedMsg.viewOnceMessageV2Extension) {
                viewOnceContent = quotedMsg.viewOnceMessageV2Extension.message;
            } else if (quotedMsg.viewOnceMessage) {
                viewOnceContent = quotedMsg.viewOnceMessage.message;
            }
        }
        
        if (viewOnceContent) {
            // Cek tipe media
            if (viewOnceContent.imageMessage) {
                mediaType = 'image';
                try {
                    mediaBuffer = await downloadMediaMessage(viewOnceContent.imageMessage, 'image');
                    caption = viewOnceContent.imageMessage.caption || '';
                    console.log(`✅ View Once image downloaded: ${mediaBuffer.length} bytes`);
                } catch (error) {
                    console.error('Error downloading view once image:', error.message);
                    return;
                }
            } else if (viewOnceContent.videoMessage) {
                mediaType = 'video';
                try {
                    mediaBuffer = await downloadMediaMessage(viewOnceContent.videoMessage, 'video');
                    caption = viewOnceContent.videoMessage.caption || '';
                    console.log(`✅ View Once video downloaded: ${mediaBuffer.length} bytes`);
                } catch (error) {
                    console.error('Error downloading view once video:', error.message);
                    return;
                }
            }
        }
        
        if (mediaBuffer && mediaType) {
            // Save to file
            const timestamp = Date.now();
            const safeName = senderName.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
            const fileName = `viewonce_${timestamp}_${safeName}.${mediaType === 'image' ? 'jpg' : 'mp4'}`;
            const filePath = path.join(VIEWONCE_SAVE_FOLDER, fileName);
            
            try {
                fs.writeFileSync(filePath, mediaBuffer);
                console.log(`✅ View Once ${mediaType} saved: ${fileName}`);
            } catch (error) {
                console.error('Error saving view once file:', error.message);
                return;
            }
            
            // Simpan ke map untuk diakses nanti
            viewOnceMessages.set(messageId, {
                sender,
                senderName,
                timestamp,
                mediaType,
                filePath,
                caption,
                saved: true
            });
            
            // Kirim notifikasi ke owner
            if (sender !== OWNER_JID) {
                const notif = 
                    `🚨 *VIEW ONCE DETECTED!*\n\n` +
                    `👤 From: ${senderName}\n` +
                    `📞 Number: ${sender.split('@')[0]}\n` +
                    `📁 Type: ${mediaType.toUpperCase()}\n` +
                    `⏰ Time: ${new Date().toLocaleTimeString('id-ID')}\n` +
                    (caption ? `📝 Caption: ${caption.substring(0, 50)}...\n` : '') +
                    `\n⚠️ Media telah disimpan secara otomatis.`;
                
                try {
                    await sock.sendMessage(OWNER_JID, { text: notif });
                } catch (error) {
                    console.error('Error sending notification to owner:', error.message);
                }
            }
            
            // Kirim kembali media ke pengirim (optional)
            try {
                const replyMsg = 
                    `⚠️ *VIEW ONCE DETECTED*\n\n` +
                    `Media view once telah disimpan oleh sistem.\n` +
                    `⏰ ${new Date().toLocaleTimeString('id-ID')}`;
                
                if (mediaType === 'image') {
                    await sock.sendMessage(sender, {
                        image: mediaBuffer,
                        caption: replyMsg
                    }, { quoted: m });
                } else if (mediaType === 'video') {
                    await sock.sendMessage(sender, {
                        video: mediaBuffer,
                        caption: replyMsg
                    }, { quoted: m });
                }
            } catch (error) {
                console.error('Error sending view once back to sender:', error.message);
            }
        } else {
            console.log('❌ View Once detected but no media found');
        }
    } catch (error) {
        console.error('❌ Anti View Once error:', error.message);
    }
}

// Express Server
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
    if (currentQR) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${BOT_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: 'Arial', sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        padding: 20px;
                    }
                    .container {
                        background: white;
                        padding: 40px;
                        border-radius: 20px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        text-align: center;
                        max-width: 500px;
                        width: 100%;
                    }
                    h1 {
                        color: #667eea;
                        margin-bottom: 20px;
                        font-size: 28px;
                    }
                    #qrcode {
                        margin: 20px auto;
                        padding: 20px;
                        background: white;
                        border-radius: 10px;
                        display: inline-block;
                        border: 3px solid #667eea;
                    }
                    .info {
                        color: #666;
                        margin-top: 20px;
                        font-size: 14px;
                    }
                    .features {
                        margin-top: 20px;
                        text-align: left;
                        background: #f8f9fa;
                        padding: 15px;
                        border-radius: 10px;
                    }
                    .features h3 {
                        color: #667eea;
                        margin-bottom: 10px;
                    }
                    .features ul {
                        list-style: none;
                        padding: 0;
                    }
                    .features li {
                        padding: 5px 0;
                        border-bottom: 1px solid #eee;
                    }
                    .features li:last-child {
                        border-bottom: none;
                    }
                    .status {
                        display: inline-block;
                        padding: 5px 15px;
                        background: #4CAF50;
                        color: white;
                        border-radius: 20px;
                        font-size: 12px;
                        margin-left: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🤖 ${BOT_NAME}</h1>
                    <p>Scan QR Code di bawah untuk menghubungkan bot WhatsApp</p>
                    <div id="qrcode"></div>
                    
                    <div class="features">
                        <h3>✨ Fitur yang Tersedia:</h3>
                        <ul>
                            <li>🎮 Games AI Generated <span class="status">ACTIVE</span></li>
                            <li>📥 Downloader (YT, TikTok, IG) <span class="status">UPDATED</span></li>
                            <li>👥 Group Management <span class="status">ACTIVE</span></li>
                            <li>🛠️ Tools & Utilities <span class="status">ACTIVE</span></li>
                            <li>😂 Fun & Entertainment <span class="status">ACTIVE</span></li>
                            <li>🎨 Sticker & Image Tools <span class="status">ACTIVE</span></li>
                            <li>🚨 Anti View Once <span class="status">FIXED</span></li>
                            <li>👋 Welcome & Leave Message <span class="status">ACTIVE</span></li>
                        </ul>
                    </div>
                    
                    <p class="info">Owner: ${OWNER_NUMBER}</p>
                    <p class="info">Database: MongoDB ✓</p>
                    <p class="info">Bot akan otomatis refresh setelah QR di-scan</p>
                </div>
                
                <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
                <script>
                    const qr = '${currentQR}';
                    QRCode.toCanvas(document.createElement('canvas'), qr, {
                        width: 256,
                        margin: 2,
                        color: {
                            dark: '#667eea',
                            light: '#ffffff'
                        }
                    }, function(error, canvas) {
                        if (error) {
                            document.getElementById('qrcode').innerHTML = 'Error generating QR';
                            return;
                        }
                        document.getElementById('qrcode').appendChild(canvas);
                    });
                    
                    setTimeout(() => {
                        location.reload();
                    }, 10000);
                </script>
            </body>
            </html>
        `);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${BOT_NAME}</title>
                <meta http-equiv="refresh" content="10">
                <style>
                    * { margin: 0; padding: 0; }
                    body {
                        font-family: Arial, sans-serif;
                        background: linear-gradient(135deg, #667eea, #764ba2);
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        padding: 20px;
                    }
                    .status-box {
                        background: white;
                        padding: 50px;
                        border-radius: 20px;
                        text-align: center;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                        max-width: 600px;
                        width: 100%;
                    }
                    h1 {
                        color: #667eea;
                        margin-bottom: 20px;
                        font-size: 32px;
                    }
                    .status {
                        padding: 15px 30px;
                        background: #4CAF50;
                        color: white;
                        border-radius: 25px;
                        font-weight: bold;
                        margin: 20px 0;
                        font-size: 18px;
                        display: inline-block;
                    }
                    .stats {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 15px;
                        margin: 20px 0;
                    }
                    .stat-item {
                        background: #f8f9fa;
                        padding: 15px;
                        border-radius: 10px;
                        text-align: center;
                    }
                    .stat-item h3 {
                        color: #667eea;
                        margin: 0 0 5px 0;
                        font-size: 14px;
                    }
                    .stat-item p {
                        font-size: 18px;
                        font-weight: bold;
                        margin: 0;
                        color: #333;
                    }
                    .owner {
                        color: #666;
                        margin-top: 20px;
                        font-size: 14px;
                    }
                </style>
            </head>
            <body>
                <div class="status-box">
                    <h1>🤖 ${BOT_NAME}</h1>
                    <div class="status">✅ ONLINE & CONNECTED</div>
                    <p>Bot sedang berjalan dengan normal</p>
                    
                    <div class="stats">
                        <div class="stat-item">
                            <h3>⏰ UPTIME</h3>
                            <p>${formatRuntime(Date.now() - BOT_START_TIME)}</p>
                        </div>
                        <div class="stat-item">
                            <h3>🎮 GAMES</h3>
                            <p>AI Generated</p>
                        </div>
                        <div class="stat-item">
                            <h3>📥 DOWNLOADER</h3>
                            <p>UPDATED</p>
                        </div>
                        <div class="stat-item">
                            <h3>🚨 ANTI VIEWONCE</h3>
                            <p>FIXED</p>
                        </div>
                        <div class="stat-item">
                            <h3>👋 WELCOME/LEAVE</h3>
                            <p>ACTIVE</p>
                        </div>
                        <div class="stat-item">
                            <h3>📊 MESSAGES</h3>
                            <p>${Object.keys(messageStore).length}</p>
                        </div>
                    </div>
                    
                    <div class="owner">👤 Owner: ${OWNER_NUMBER}</div>
                    <div class="owner">💾 Database: MongoDB ✓</div>
                    <div class="owner">🔄 Halaman ini akan refresh otomatis</div>
                </div>
            </body>
            </html>
        `);
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        bot: BOT_NAME,
        owner: OWNER_NUMBER,
        uptime: formatRuntime(Date.now() - BOT_START_TIME),
        viewonce_saved: Array.from(viewOnceMessages.values()).length,
        groups: welcomeEnabled.size,
        database: 'MongoDB',
        timestamp: new Date().toISOString()
    });
});

// Endpoint untuk melihat saved view once
app.get('/viewonce', (req, res) => {
    try {
        const files = fs.readdirSync(VIEWONCE_SAVE_FOLDER)
            .filter(f => f.startsWith('viewonce_'))
            .map(f => ({
                name: f,
                path: `/viewonce/files/${f}`,
                size: fs.statSync(path.join(VIEWONCE_SAVE_FOLDER, f)).size,
                time: fs.statSync(path.join(VIEWONCE_SAVE_FOLDER, f)).mtime
            }));
        
        res.json({
            total: files.length,
            files: files
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.use('/viewonce/files', express.static(VIEWONCE_SAVE_FOLDER));

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    console.log(`📁 View Once files: http://localhost:${PORT}/viewonce`);
    console.log(`🚨 Anti View Once: ${ANTI_VIEWONCE_ENABLED ? 'ENABLED' : 'DISABLED'}`);
    console.log(`💾 Database: MongoDB`);
});

// Main Bot Function
async function startBot() {
    try {
        console.log('🚀 Starting WhatsApp Bot...');
        
        // ✅ PAKAI MONGODB AUTH (GANTI DARI useMultiFileAuthState)
        const { state, saveCreds, clearData } = await useMongoAuthState();
        const { version } = await fetchLatestBaileysVersion();
        
        console.log(`📱 WhatsApp v${version.join('.')}`);
        console.log(`🤖 Bot: ${BOT_NAME}`);
        console.log(`👤 Owner: ${OWNER_NUMBER}`);
        console.log(`💾 Database: MongoDB`);

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            msgRetryCounterCache,
            browser: Browsers.macOS('Desktop'),
            getMessage: async (key) => {
                const msg = getMessage(key.remoteJid, key.id);
                return msg ? msg.fullMessage.message : null;
            },
            shouldIgnoreJid: (jid) => jid?.endsWith('@broadcast') || false,
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                currentQR = qr;
                console.log('\n╔══════════════════════╗');
                console.log('║  📱 SCAN QR CODE    ║');
                console.log('╚══════════════════════╝\n');
                qrcode.generate(qr, { small: true });
            }
            
            if (connection === 'close') {
                currentQR = null;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log('🔌 Connection closed:', lastDisconnect?.error?.message || 'Unknown reason');
                
                if (shouldReconnect) {
                    console.log('🔄 Reconnecting in 3 seconds...');
                    setTimeout(() => startBot(), 3000);
                } else {
                    console.log('❌ Logged out, please scan QR again');
                }
            } else if (connection === 'open') {
                currentQR = null;
                console.log('\n╔═════════════════════════════════╗');
                console.log('║  ✅ ' + BOT_NAME + ' ONLINE!       ║');
                console.log('║  🎮 AI Games Ready ✓            ║');
                console.log('║  📥 Downloader Updated ✓        ║');
                console.log('║  🚨 Anti View Once Fixed ✓      ║');
                console.log('║  👥 Group Tools Ready ✓         ║');
                console.log('║  👋 Welcome/Leave Active ✓      ║');
                console.log('║  💾 MongoDB Connected ✓         ║');
                console.log('╚═════════════════════════════════╝\n');
                
                try {
                    const dateInfo = getFormattedDate();
                    const runtime = formatRuntime(Date.now() - BOT_START_TIME);
                    
                    const statusMsg = 
                        '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                        '┃  🤖 *BOT ONLINE!*  ┃\n' +
                        '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                        '✅ ' + BOT_NAME + ' is now online!\n\n' +
                        '📅 ' + dateInfo.full + '\n' +
                        '⏰ ' + dateInfo.time + '\n' +
                        '⏱️ Uptime: ' + runtime + '\n\n' +
                        '━━━━━━━━━━━━━━━━━━━━\n' +
                        '🎮 Games: AI Generated ✓\n' +
                        '📥 Downloader: Updated ✓\n' +
                        '🚨 Anti View Once: Fixed ✓\n' +
                        '👥 Group Tools: Ready ✓\n' +
                        '👋 Welcome/Leave: Active ✓\n' +
                        '💾 Database: MongoDB ✓\n' +
                        '━━━━━━━━━━━━━━━━━━━━';
                    
                    await sock.sendMessage(OWNER_JID, { text: statusMsg });
                } catch (e) {
                    console.log('❌ Failed to send status to owner:', e.message);
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // Handle group participants update - FIXED VERSION
        sock.ev.on('group-participants.update', async (update) => {
            try {
                const { id, participants, action } = update;
                
                console.log(`📊 Group event: ${action} in ${id}`, participants);
                
                if (!id || !participants || !action) return;
                
                // Skip jika bukan grup
                if (!id.endsWith('@g.us')) return;
                
                // Tunggu sebentar untuk memastikan metadata grup sudah update
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                let groupMetadata;
                try {
                    groupMetadata = await sock.groupMetadata(id);
                } catch (error) {
                    console.error('Error getting group metadata:', error.message);
                    groupMetadata = { subject: 'Group', participants: [] };
                }
                
                const groupName = groupMetadata.subject || 'Group';
                const membersCount = groupMetadata.participants.length;
                
                for (const participant of participants) {
                    try {
                        // FIX: Handle participant object properly
                        let participantJid = participant;
                        let participantNumber = '';
                        
                        // Check if participant is a string (jid) or object
                        if (typeof participant === 'string') {
                            participantJid = participant;
                            participantNumber = participant.split('@')[0];
                        } else if (participant && participant.id) {
                            // If it's an object with id property
                            participantJid = participant.id;
                            participantNumber = participant.id.split('@')[0];
                        } else {
                            console.error('Invalid participant format:', participant);
                            continue;
                        }
                        
                        if (!participantNumber) {
                            console.error('Could not extract number from participant:', participant);
                            continue;
                        }
                        
                        console.log(`Processing ${action} for ${participantNumber} in group ${groupName}`);
                        
                        if (action === 'add') {
                            console.log(`🎉 Welcome to group: ${participantNumber}`);
                            
                            // Default enable welcome untuk grup baru
                            if (!welcomeEnabled.has(id)) {
                                welcomeEnabled.set(id, true);
                            }
                            
                            // Cek apakah welcome diaktifkan
                            if (welcomeEnabled.get(id) === false) {
                                console.log(`⚠️ Welcome disabled for ${id}, skipping...`);
                                continue;
                            }
                            
                            const welcomeMsg = 
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃  🎉 *WELCOME!* 🎉  ┃\n' +
                                '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                                `👋 Halo @${participantNumber}!\n\n` +
                                `💬 Selamat datang di grup *${groupName}*!\n` +
                                `Semoga betah dan aktif ya! 🚀\n\n` +
                                '━━━━━━━━━━━━━━━━━━━━\n' +
                                `📌 Grup: ${groupName}\n` +
                                `👥 Member: ${membersCount} orang\n` +
                                '━━━━━━━━━━━━━━━━━━━━\n\n' +
                                '📝 Ketik .menu untuk melihat fitur bot\n' +
                                `💻 _${BOT_NAME}_`;
                            
                            await sock.sendMessage(id, { 
                                text: welcomeMsg, 
                                mentions: [participantJid] 
                            });
                            
                            // Send reaction
                            try {
                                await sock.sendMessage(id, {
                                    react: {
                                        text: '🎉',
                                        key: { remoteJid: id, fromMe: true, id: 'welcome_' + Date.now() }
                                    }
                                });
                            } catch (e) {
                                // Ignore reaction errors
                                console.log('Reaction error:', e.message);
                            }
                            
                        } else if (action === 'remove') {
                            console.log(`👋 Leave from group: ${participantNumber}`);
                            
                            // Cek apakah yang leave adalah bot sendiri
                            const botJid = sock.user?.id;
                            if (participantJid === botJid) {
                                console.log('🤖 Bot removed from group');
                                continue;
                            }
                            
                            const leaveMsg = 
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃  👋 *GOODBYE!* 👋  ┃\n' +
                                '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                                `😢 @${participantNumber} telah meninggalkan grup\n\n` +
                                '💬 Semoga sukses di mana pun berada! 👋\n\n' +
                                '━━━━━━━━━━━━━━━━━━━━\n' +
                                `👥 Tersisa: ${membersCount} member\n` +
                                '━━━━━━━━━━━━━━━━━━━━\n\n' +
                                `💻 _${BOT_NAME}_`;
                            
                            await sock.sendMessage(id, { 
                                text: leaveMsg, 
                                mentions: [participantJid] 
                            });
                            
                            // Send reaction
                            try {
                                await sock.sendMessage(id, {
                                    react: {
                                        text: '😢',
                                        key: { remoteJid: id, fromMe: true, id: 'leave_' + Date.now() }
                                    }
                                });
                            } catch (e) {
                                // Ignore reaction errors
                                console.log('Reaction error:', e.message);
                            }
                        }
                        
                        // Delay antar pesan
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                    } catch (error) {
                        console.error(`Error processing ${action} for ${participant}:`, error.message);
                    }
                }
            } catch (error) {
                console.error('Group event error:', error.message);
            }
        });

        // Juga tambahkan handler untuk group updates
        sock.ev.on('groups.update', async (updates) => {
            for (const update of updates) {
                console.log(`📊 Group update: ${update.id} - ${update.announce || 'settings changed'}`);
            }
        });

        // Handle message updates (for anti-delete)
        sock.ev.on('messages.update', async (updates) => {
            for (const update of updates) {
                try {
                    if (update.update?.messageStubType === 1) {
                        const msgInfo = getMessage(update.key.remoteJid, update.key.id);
                        
                        if (msgInfo?.fullMessage?.message) {
                            const msg = msgInfo.fullMessage.message;
                            const deleter = update.key.participant || update.key.remoteJid;
                            const name = msgInfo.pushName;
                            
                            let content = '';
                            if (msg.conversation) content = msg.conversation;
                            else if (msg.extendedTextMessage?.text) content = msg.extendedTextMessage.text;
                            else if (msg.imageMessage?.caption) content = msg.imageMessage.caption;
                            
                            let notif = '🚫 *PESAN DIHAPUS!*\n\n';
                            notif += '👤 @' + deleter.split('@')[0] + '\n';
                            notif += '📝 ' + name + '\n';
                            notif += '⏰ ' + new Date().toLocaleTimeString('id-ID') + '\n';
                            if (content) notif += '\n💬 "' + content + '"';
                            
                            await sock.sendMessage(update.key.remoteJid, { 
                                text: notif, 
                                mentions: [deleter] 
                            });
                        }
                    }
                } catch (e) {
                    console.error('Anti-delete error:', e.message);
                }
            }
        });

        // Main message handler
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;
            
            for (const m of messages) {
                try {
                    if (!m.key || !m.key.remoteJid || m.key.remoteJid === 'status@broadcast') continue;
                    
                    saveMessage(m);
                    
                    const sender = m.key.remoteJid;
                    const pushName = m.pushName || 'User';
                    const isGroup = sender.endsWith('@g.us');
                    const userId = m.key.participant || sender;
                    const isOwner = userId === OWNER_JID;
                    
                    if (!m.message) continue;
                    
                    // 🚨 ANTI VIEWONCE HANDLER - DIPANGGIL SEBELUM LAINNYA
                    if (ANTI_VIEWONCE_ENABLED) {
                        await saveViewOnceMedia(sock, m);
                    }
                    
                    // Auto reaction
                    if (!m.key.fromMe && Math.random() < 0.3) {
                        try {
                            await sock.sendMessage(sender, {
                                react: {
                                    text: getRandomReaction(),
                                    key: m.key
                                }
                            });
                        } catch (e) {
                            console.error('Reaction error:', e.message);
                        }
                    }
                    
                    // Check if user is banned
                    if (bannedUsers.has(userId)) {
                        await sock.sendMessage(sender, { text: '⛔ *BANNED!*' });
                        continue;
                    }
                    
                    // Check for spam
                    const spamCheck = checkSpam(userId);
                    if (spamCheck.isBlocked) {
                        await sock.sendMessage(sender, { 
                            text: `⚠️ *SPAM!* ${spamCheck.timeLeft}s` 
                        });
                        continue;
                    }
                    
                    if (spamCheck.isSpam) {
                        await sock.sendMessage(sender, { text: '🚫 *SPAM!*' });
                        continue;
                    }
                    
                    // Extract message text
                    const msg = m.message;
                    let text = '';
                    
                    if (msg.conversation) text = msg.conversation;
                    else if (msg.extendedTextMessage?.text) text = msg.extendedTextMessage.text;
                    else if (msg.imageMessage?.caption) text = msg.imageMessage.caption;
                    else if (msg.videoMessage?.caption) text = msg.videoMessage.caption;
                    
                    if (text) {
                        console.log(`💬 ${pushName}: ${text.substring(0, 50)}`);
                    }
                    
                    if (!sender || sender.length < 10) continue;
                    
                    const command = text.toLowerCase().trim().split(' ')[0];
                    const args = text.trim().split(' ').slice(1);
                    
                    // ==================== MENU ====================
                    if (command === '.menu') {
                        console.log(`📋 Menu command from: ${pushName}`);
                        
                        try {
                            const greeting = getGreeting();
                            const dateInfo = getFormattedDate();
                            const runtime = formatRuntime(Date.now() - BOT_START_TIME);
                            
                            const loadingMsg = await sock.sendMessage(sender, { 
                                text: '⏳ _Generating AI motivation..._' 
                            });
                            
                            const motivation = await getAICodingMotivation();
                            
                            const menuText = 
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃  💻 *' + BOT_NAME.toUpperCase() + '* 💻  ┃\n' +
                                '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                                greeting + ', *' + pushName + '*! ✨\n\n' +
                                '📅 ' + dateInfo.full + '\n' +
                                '⏰ ' + dateInfo.time + ' WIB\n' +
                                '⏱️ Runtime: ' + runtime + '\n\n' +
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃ 💡 *AI Motivation*\n' +
                                '┗━━━━━━━━━━━━━━━━━━━━┛\n' +
                                '_' + motivation + '_\n\n' +
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃ 🎮 *GAMES (AI)*\n' +
                                '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                                '┃ .tebakkata (AI Generated)\n' +
                                '┃ .tebakbendera (AI Generated)\n' +
                                '┃ .kuis (AI Generated)\n' +
                                '┃ .truth .dare\n' +
                                '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃ 📥 *DOWNLOADER*\n' +
                                '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                                '┃ .ytmp3 [youtube_url]\n' +
                                '┃ .ytmp4 [youtube_url]\n' +
                                '┃ .tiktok [tiktok_url]\n' +
                                '┃ .ig [instagram_url]\n' +
                                '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃ 👥 *GROUP*\n' +
                                '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                                '┃ .hidetag [text]\n' +
                                '┃ .tagall\n' +
                                '┃ .kick @user\n' +
                                '┃ .add [nomor]\n' +
                                '┃ .promote @user\n' +
                                '┃ .demote @user\n' +
                                '┃ .linkgc .revoke\n' +
                                '┃ .enablewelcome\n' +
                                '┃ .disablewelcome\n' +
                                '┃ .welcomestatus\n' +
                                '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃ 🛠️ *TOOLS*\n' +
                                '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                                '┃ .ping .runtime\n' +
                                '┃ .shortlink [url]\n' +
                                '┃ .resetsession (owner)\n' +
                                '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃ 😂 *FUN*\n' +
                                '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                                '┃ .quotes .pantun\n' +
                                '┃ .rate [text]\n' +
                                '┃ .jodoh [nama]\n' +
                                '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃ 🎨 *IMAGE*\n' +
                                '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                                '┃ .s (sticker)\n' +
                                '┃ .toimg\n' +
                                '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃ 🚨 *SECURITY*\n' +
                                '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                                '┃ Anti View Once: ✅\n' +
                                '┃ Anti Delete: ✅\n' +
                                '┃ Anti Spam: ✅\n' +
                                '┃ Welcome/Leave: ✅\n' +
                                '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                                '━━━━━━━━━━━━━━━━━━━━\n' +
                                '👤 Owner: wa.me/' + OWNER_NUMBER + '\n' +
                                '💾 Database: MongoDB\n' +
                                '🤖 AI Powered Bot\n' +
                                '━━━━━━━━━━━━━━━━━━━━';
                            
                            try {
                                if (loadingMsg.key) {
                                    await sock.sendMessage(sender, { 
                                        delete: loadingMsg.key 
                                    });
                                }
                            } catch (e) {
                                console.log('Could not delete loading message:', e.message);
                            }
                            
                            await sock.sendMessage(sender, { text: menuText });
                            console.log(`✅ Menu sent to: ${pushName}`);
                        } catch (error) {
                            console.error('❌ Menu error:', error.message);
                            await sock.sendMessage(sender, { 
                                text: `❌ Error generating menu: ${error.message}` 
                            });
                        }
                        continue;
                    }
                    
                   // ==================== RESET SESSION (OWNER ONLY) ====================
if (command === '.resetsession' && isOwner) {
    try {
        await sock.sendMessage(sender, { text: '🔄 *Mereset session MongoDB...*' });
        
        // Hapus session di MongoDB
        await clearData();
        
        await sock.sendMessage(sender, { 
            text: '✅ Session dihapus dari MongoDB!\n\nBot akan restart & QR baru akan muncul dalam 5 detik...' 
        });
        
        // Tunggu 5 detik sebelum restart
        setTimeout(() => {
            console.log('🧹 Session reset oleh owner — restarting now');
            // Keluar dengan kode error (1) agar Heroku restart otomatis
            process.exit(1);
        }, 5000);
        
    } catch (e) {
        console.error('❌ Gagal reset session:', e.message);
        await sock.sendMessage(sender, { 
            text: `❌ Gagal reset: ${e.message}` 
        });
    }
    continue;
}
                    // ==================== WELCOME COMMANDS ====================
                    
                    // ENABLE WELCOME
                    if (command === '.enablewelcome') {
                        if (!isGroup) {
                            await sock.sendMessage(sender, { text: '⚠️ *Hanya di group!*' });
                            continue;
                        }
                        
                        welcomeEnabled.set(sender, true);
                        await sock.sendMessage(sender, { 
                            text: '✅ *Fitur Welcome diaktifkan!*\n\nSekarang bot akan mengucapkan selamat datang kepada member baru.' 
                        });
                        continue;
                    }
                    
                    // DISABLE WELCOME
                    if (command === '.disablewelcome') {
                        if (!isGroup) {
                            await sock.sendMessage(sender, { text: '⚠️ *Hanya di group!*' });
                            continue;
                        }
                        
                        welcomeEnabled.set(sender, false);
                        await sock.sendMessage(sender, { 
                            text: '❌ *Fitur Welcome dinonaktifkan!*\n\nBot tidak akan mengucapkan selamat datang lagi.' 
                        });
                        continue;
                    }
                    
                    // CHECK WELCOME STATUS
                    if (command === '.welcomestatus') {
                        if (!isGroup) {
                            await sock.sendMessage(sender, { text: '⚠️ *Hanya di group!*' });
                            continue;
                        }
                        
                        const status = welcomeEnabled.get(sender) !== false;
                        await sock.sendMessage(sender, { 
                            text: `📊 *Status Fitur Welcome*\n\n` +
                                  `Grup: ${isGroup ? '✅' : '❌'}\n` +
                                  `Fitur Welcome: ${status ? '✅ AKTIF' : '❌ NONAKTIF'}\n\n` +
                                  `━━━━━━━━━━━━━━━━━━━━\n` +
                                  `💡 Gunakan .enablewelcome / .disablewelcome` 
                        });
                        continue;
                    }
                    
                    // ==================== DOWNLOADER (FIXED) ====================
                    
                    // YTMP3 - FIXED
                    if (command === '.ytmp3' && args[0]) {
                        try {
                            let url = args[0];
                            
                            // Perbaiki URL jika diperlukan
                            if (url.includes('youtu.be')) {
                                const videoId = url.split('/').pop().split('?')[0];
                                url = `https://www.youtube.com/watch?v=${videoId}`;
                            }
                            
                            if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
                                await sock.sendMessage(sender, { 
                                    text: '❌ URL YouTube tidak valid!\n\n💡 Contoh:\n.ytmp3 https://youtube.com/watch?v=...\n.ytmp3 https://youtu.be/...' 
                                });
                                continue;
                            }
                            
                            const loadingMsg = await sock.sendMessage(sender, { 
                                text: '⏳ *Mendownload audio YouTube...*\n\n📥 Mohon tunggu, proses mungkin memakan waktu 30-60 detik...' 
                            });
                            
                            try {
                                const result = await downloadYouTube(url, 'mp3');
                                
                                const infoText = 
                                    `✅ *Download Berhasil!*\n\n` +
                                    `📝 Title: ${result.title}\n` +
                                    `⏱️ Duration: ${result.duration}\n\n` +
                                    `📥 Mengirim audio...`;
                                
                                await sock.sendMessage(sender, { text: infoText });
                                
                                // Download audio file dengan timeout lebih lama
                                const audioBuffer = await downloadMedia(result.url, {
                                    timeout: 120000,
                                    maxContentLength: 50 * 1024 * 1024 // 50MB
                                });
                                
                                // Hapus pesan loading
                                if (loadingMsg.key) {
                                    try {
                                        await sock.sendMessage(sender, { 
                                            delete: loadingMsg.key 
                                        });
                                    } catch (e) {}
                                }
                                
                                await sock.sendMessage(sender, {
                                    audio: audioBuffer,
                                    mimetype: 'audio/mpeg',
                                    fileName: `${result.title.substring(0, 50).replace(/[^\w\s]/gi, '')}.mp3`
                                });
                                
                            } catch (downloadError) {
                                // Hapus pesan loading
                                if (loadingMsg.key) {
                                    try {
                                        await sock.sendMessage(sender, { 
                                            delete: loadingMsg.key 
                                        });
                                    } catch (e) {}
                                }
                                
                                // Fallback: Kirim link download
                                await sock.sendMessage(sender, { 
                                    text: `⚠️ *File terlalu besar untuk dikirim langsung*\n\n📝 Gunakan link berikut untuk download:\n${result?.url || url}\n\n💡 Bot hanya bisa mengirim file hingga 16MB` 
                                });
                            }
                            
                        } catch (error) {
                            console.error('YouTube MP3 error:', error);
                            await sock.sendMessage(sender, { 
                                text: `❌ Gagal download audio!\n\nError: ${error.message}\n\n💡 Coba gunakan link YouTube yang valid atau coba lagi nanti.` 
                            });
                        }
                        continue;
                    }
                    
                    // YTMP4 - FIXED
                    if (command === '.ytmp4' && args[0]) {
                        try {
                            let url = args[0];
                            
                            // Perbaiki URL jika diperlukan
                            if (url.includes('youtu.be')) {
                                const videoId = url.split('/').pop().split('?')[0];
                                url = `https://www.youtube.com/watch?v=${videoId}`;
                            }
                            
                            if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
                                await sock.sendMessage(sender, { 
                                    text: '❌ URL YouTube tidak valid!\n\n💡 Contoh:\n.ytmp4 https://youtube.com/watch?v=...\n.ytmp4 https://youtu.be/...' 
                                });
                                continue;
                            }
                            
                            const loadingMsg = await sock.sendMessage(sender, { 
                                text: '⏳ *Mendownload video YouTube...*\n\n📥 Mohon tunggu, proses mungkin memakan waktu 30-60 detik...' 
                            });
                            
                            try {
                                const result = await downloadYouTube(url, 'mp4');
                                
                                const infoText = 
                                    `✅ *Download Berhasil!*\n\n` +
                                    `📝 Title: ${result.title}\n` +
                                    `⏱️ Duration: ${result.duration}\n\n` +
                                    `📥 Mengirim video...`;
                                
                                await sock.sendMessage(sender, { text: infoText });
                                
                                // Download video file dengan timeout lebih lama
                                const videoBuffer = await downloadMedia(result.url, {
                                    timeout: 120000,
                                    maxContentLength: 50 * 1024 * 1024 // 50MB
                                });
                                
                                // Hapus pesan loading
                                if (loadingMsg.key) {
                                    try {
                                        await sock.sendMessage(sender, { 
                                            delete: loadingMsg.key 
                                        });
                                    } catch (e) {}
                                }
                                
                                await sock.sendMessage(sender, {
                                    video: videoBuffer,
                                    caption: `📹 ${result.title}`,
                                    fileName: `${result.title.substring(0, 50).replace(/[^\w\s]/gi, '')}.mp4`
                                });
                                
                            } catch (downloadError) {
                                // Hapus pesan loading
                                if (loadingMsg.key) {
                                    try {
                                        await sock.sendMessage(sender, { 
                                            delete: loadingMsg.key 
                                        });
                                    } catch (e) {}
                                }
                                
                                // Fallback: Kirim link download
                                await sock.sendMessage(sender, { 
                                    text: `⚠️ *File terlalu besar untuk dikirim langsung*\n\n📝 Gunakan link berikut untuk download:\n${result?.url || url}\n\n💡 Bot hanya bisa mengirim file hingga 16MB` 
                                });
                            }
                            
                        } catch (error) {
                            console.error('YouTube MP4 error:', error);
                            await sock.sendMessage(sender, { 
                                text: `❌ Gagal download video!\n\nError: ${error.message}\n\n💡 Coba gunakan link YouTube yang valid atau coba lagi nanti.` 
                            });
                        }
                        continue;
                    }
                    
                    // TIKTOK - FIXED
                    if (command === '.tiktok' && args[0]) {
                        try {
                            const url = args[0];
                            if (!url.includes('tiktok.com')) {
                                await sock.sendMessage(sender, { 
                                    text: '❌ URL TikTok tidak valid!\n\n💡 Contoh: .tiktok https://tiktok.com/@user/video/...' 
                                });
                                continue;
                            }
                            
                            await sock.sendMessage(sender, { 
                                text: '⏳ *Mendownload video TikTok...*\n\n📥 Mohon tunggu, proses mungkin memakan waktu beberapa detik...' 
                            });
                            
                            const result = await downloadTikTok(url);
                            
                            const infoText = 
                                `✅ *Download Berhasil!*\n\n` +
                                `📝 Title: ${result.title}\n` +
                                `👤 Author: ${result.author}\n` +
                                `⏱️ Duration: ${result.duration}s\n\n` +
                                `📥 Mengirim video...`;
                            
                            await sock.sendMessage(sender, { text: infoText });
                            
                            // Download video file
                            const videoBuffer = await downloadMedia(result.url);
                            
                            await sock.sendMessage(sender, {
                                video: videoBuffer,
                                caption: `📹 TikTok - ${result.author}`,
                                fileName: `tiktok_${Date.now()}.mp4`
                            });
                            
                        } catch (error) {
                            console.error('TikTok error:', error);
                            await sock.sendMessage(sender, { 
                                text: `❌ Gagal download TikTok!\n\nError: ${error.message}\n\n💡 Coba gunakan link TikTok yang valid.` 
                            });
                        }
                        continue;
                    }
                    
                    // INSTAGRAM - FIXED
                    if (command === '.ig' && args[0]) {
                        try {
                            const url = args[0];
                            if (!url.includes('instagram.com')) {
                                await sock.sendMessage(sender, { 
                                    text: '❌ URL Instagram tidak valid!\n\n💡 Contoh:\n.ig https://instagram.com/p/...\n.ig https://www.instagram.com/reel/...' 
                                });
                                continue;
                            }
                            
                            await sock.sendMessage(sender, { 
                                text: '⏳ *Mendownload dari Instagram...*\n\n📥 Mohon tunggu, proses mungkin memakan waktu beberapa detik...' 
                            });
                            
                            const result = await downloadInstagram(url);
                            
                            const infoText = 
                                `✅ *Download Berhasil!*\n\n` +
                                `📝 Title: ${result.title}\n` +
                                `📁 Type: ${result.type.toUpperCase()}\n\n` +
                                `📥 Mengirim ${result.type}...`;
                            
                            await sock.sendMessage(sender, { text: infoText });
                            
                            // Download media file
                            const mediaBuffer = await downloadMedia(result.url);
                            
                            if (result.type === 'video') {
                                await sock.sendMessage(sender, {
                                    video: mediaBuffer,
                                    caption: `📹 Instagram Video`,
                                    fileName: `instagram_${Date.now()}.mp4`
                                });
                            } else {
                                await sock.sendMessage(sender, {
                                    image: mediaBuffer,
                                    caption: `📸 Instagram Photo`
                                });
                            }
                            
                        } catch (error) {
                            console.error('Instagram error:', error);
                            await sock.sendMessage(sender, { 
                                text: `❌ Gagal download Instagram!\n\nError: ${error.message}\n\n💡 Coba gunakan link Instagram yang valid.` 
                            });
                        }
                        continue;
                    }
                    
                    // ==================== GAMES (AI GENERATED) ====================
                    
                    // TEBAK KATA (AI)
                    if (command === '.tebakkata') {
                        try {
                            await sock.sendMessage(sender, { text: '🎮 Generating AI teka-teki...' });
                            
                            const game = await generateGameQuestion('tebakkata');
                            if (!game) throw new Error('Gagal membuat game');
                            
                            tebakKataGames.set(sender, {
                                ...game,
                                startTime: Date.now(),
                                attempts: 0
                            });
                            
                            const gameText = 
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃ 🎮 *TEBAK KATA* 🎮 ┃\n' +
                                '┃     (AI Generated)   ┃\n' +
                                '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                                '❓ ' + game.question + '\n\n' +
                                '💡 Kirim jawabanmu! (1 kata)\n' +
                                '⏰ Kamu punya 3 kesempatan\n\n' +
                                '━━━━━━━━━━━━━━━━━━━━\n' +
                                '✨ Ketik .tebakkata untuk game baru';
                            
                            await sock.sendMessage(sender, { text: gameText });
                        } catch (error) {
                            await sock.sendMessage(sender, { 
                                text: `❌ Error: ${error.message}\n\n💡 Coba lagi nanti!` 
                            });
                        }
                        continue;
                    }
                    
                    // Check tebak kata answer
                    if (tebakKataGames.has(sender)) {
                        const game = tebakKataGames.get(sender);
                        const userAnswer = text.toLowerCase().trim();
                        
                        game.attempts++;
                        const isCorrect = userAnswer === game.answer.toLowerCase();
                        
                        if (isCorrect) {
                            tebakKataGames.delete(sender);
                            await sock.sendMessage(sender, { 
                                text: `✅ *BENAR!*\n\nJawaban: ${game.answer}\n\n🎉 Selamat! Kamu menang!\n⏱️ Waktu: ${Math.floor((Date.now() - game.startTime) / 1000)} detik` 
                            });
                        } else if (game.attempts >= 3) {
                            tebakKataGames.delete(sender);
                            await sock.sendMessage(sender, { 
                                text: `💀 *GAME OVER!*\n\nJawaban yang benar: ${game.answer}\n\n💡 Ketik .tebakkata untuk bermain lagi` 
                            });
                        } else {
                            await sock.sendMessage(sender, { 
                                text: `❌ *SALAH!*\n\nKesempatan tersisa: ${3 - game.attempts}\n\n💡 Coba lagi!` 
                            });
                        }
                        continue;
                    }
                    
                    // TEBAK BENDERA (AI)
                    if (command === '.tebakbendera') {
                        try {
                            await sock.sendMessage(sender, { text: '🏳️ Generating AI bendera game...' });
                            
                            const game = await generateGameQuestion('tebakbendera');
                            if (!game) throw new Error('Gagal membuat game');
                            
                            tebakBenderaGames.set(sender, {
                                ...game,
                                startTime: Date.now(),
                                attempts: 0
                            });
                            
                            const gameText = 
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃ 🏳️ *TEBAK BENDERA* 🏳️ ┃\n' +
                                '┃    (AI Generated)    ┃\n' +
                                '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                                '🇺🇳 Bendera: ' + game.emoji + '\n' +
                                '💡 Clue: ' + game.clue + '\n\n' +
                                '❓ Negara apakah ini?\n\n' +
                                '⏰ Kamu punya 3 kesempatan\n' +
                                '✨ Ketik .tebakbendera untuk game baru';
                            
                            await sock.sendMessage(sender, { text: gameText });
                        } catch (error) {
                            await sock.sendMessage(sender, { 
                                text: `❌ Error: ${error.message}\n\n💡 Coba lagi nanti!` 
                            });
                        }
                        continue;
                    }
                    
                    // Check tebak bendera answer
                    if (tebakBenderaGames.has(sender)) {
                        const game = tebakBenderaGames.get(sender);
                        const userAnswer = text.toLowerCase().trim();
                        
                        game.attempts++;
                        const isCorrect = userAnswer === game.country.toLowerCase();
                        
                        if (isCorrect) {
                            tebakBenderaGames.delete(sender);
                            await sock.sendMessage(sender, { 
                                text: `✅ *BENAR!*\n\nNegara: ${game.country}\nBendera: ${game.emoji}\n\n🎉 Selamat! Kamu menang!\n⏱️ Waktu: ${Math.floor((Date.now() - game.startTime) / 1000)} detik` 
                            });
                        } else if (game.attempts >= 3) {
                            tebakBenderaGames.delete(sender);
                            await sock.sendMessage(sender, { 
                                text: `💀 *GAME OVER!*\n\nNegara yang benar: ${game.country}\nBendera: ${game.emoji}\n\n💡 Ketik .tebakbendera untuk bermain lagi` 
                            });
                        } else {
                            await sock.sendMessage(sender, { 
                                text: `❌ *SALAH!*\n\nKesempatan tersisa: ${3 - game.attempts}\n\n💡 Coba lagi!` 
                            });
                        }
                        continue;
                    }
                    
                    // KUIS (AI)
                    if (command === '.kuis') {
                        try {
                            await sock.sendMessage(sender, { text: '🎯 Generating AI kuis...' });
                            
                            const game = await generateGameQuestion('kuis');
                            if (!game) throw new Error('Gagal membuat game');
                            
                            kuisGames.set(sender, {
                                ...game,
                                startTime: Date.now(),
                                attempts: 0
                            });
                            
                            const optionsText = game.options.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n');
                            
                            const gameText = 
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃ 🎯 *KUIS* 🎯 ┃\n' +
                                '┃  (AI Generated)   ┃\n' +
                                '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                                '❓ ' + game.question + '\n\n' +
                                '📝 Pilihan:\n' + optionsText + '\n\n' +
                                '💡 Jawab dengan angka (1-4) atau teks\n' +
                                '⏰ Kamu punya 1 kesempatan\n\n' +
                                '✨ Ketik .kuis untuk kuis baru';
                            
                            await sock.sendMessage(sender, { text: gameText });
                        } catch (error) {
                            await sock.sendMessage(sender, { 
                                text: `❌ Error: ${error.message}\n\n💡 Coba lagi nanti!` 
                            });
                        }
                        continue;
                    }
                    
                    // Check kuis answer
                    if (kuisGames.has(sender)) {
                        const game = kuisGames.get(sender);
                        let userAnswer = text.toLowerCase().trim();
                        
                        // Convert number to answer
                        if (/^[1-4]$/.test(userAnswer)) {
                            const idx = parseInt(userAnswer) - 1;
                            if (game.options[idx]) {
                                userAnswer = game.options[idx].toLowerCase();
                            }
                        }
                        
                        game.attempts++;
                        const isCorrect = userAnswer === game.answer.toLowerCase();
                        
                        if (isCorrect) {
                            kuisGames.delete(sender);
                            await sock.sendMessage(sender, { 
                                text: `✅ *BENAR!*\n\nJawaban: ${game.answer.toUpperCase()}\n\n🎉 Selamat! Kamu menang!\n⏱️ Waktu: ${Math.floor((Date.now() - game.startTime) / 1000)} detik` 
                            });
                        } else {
                            kuisGames.delete(sender);
                            await sock.sendMessage(sender, { 
                                text: `❌ *SALAH!*\n\nJawaban yang benar: ${game.answer.toUpperCase()}\n\n💡 Ketik .kuis untuk bermain lagi` 
                            });
                        }
                        continue;
                    }
                    
                    // TRUTH
                    if (command === '.truth') {
                        const truths = [
                            "Apa rahasia terbesar yang kamu sembunyikan dari keluarga?",
                            "Kapan terakhir kali kamu menangis dan mengapa?",
                            "Apa hal paling memalukan yang pernah terjadi padamu?",
                            "Siapa orang yang pernah kamu sakiti dan belum kamu minta maaf?",
                            "Apa kebohongan terbesar yang pernah kamu katakan?",
                            "Apa hal yang paling kamu takuti dalam hidup?"
                        ];
                        
                        const randomTruth = truths[Math.floor(Math.random() * truths.length)];
                        
                        await sock.sendMessage(sender, { 
                            text: `🤫 *TRUTH*\n\n${randomTruth}\n\n━━━━━━━━━━━━━━━━━━━━\n💬 Jawab dengan jujur!` 
                        });
                        continue;
                    }
                    
                    // DARE
                    if (command === '.dare') {
                        const dares = [
                            "Kirim suara kamu menyanyi lagu anak-anak!",
                            "Ganti foto profil WA selama 1 jam!",
                            "Telepon kontak terakhir di HP kamu selama 30 detik!",
                            "Kirim screenshot history pencarian terakhir kamu!",
                            "Unggah story WA dengan filter paling jelek!",
                            "Kirim pesan 'Aku sayang kamu' ke kontak ke-5 di HP!"
                        ];
                        
                        const randomDare = dares[Math.floor(Math.random() * dares.length)];
                        
                        await sock.sendMessage(sender, { 
                            text: `😈 *DARE*\n\n${randomDare}\n\n━━━━━━━━━━━━━━━━━━━━\n⚡ Lakukan dalam 5 menit!` 
                        });
                        continue;
                    }
                    
                    // ==================== GROUP MANAGEMENT ====================
                    
                    // HIDETAG
                    if (command === '.hidetag' || command === '.ht') {
                        if (!isGroup) {
                            await sock.sendMessage(sender, { text: '⚠️ *Hanya di group!*' });
                            continue;
                        }
                        
                        try {
                            const groupMetadata = await sock.groupMetadata(sender);
                            const participants = groupMetadata.participants;
                            const mentions = participants.map(p => p.id);
                            
                            let hidetagMessage = '';
                            let hasMedia = false;
                            let mediaBuffer = null;
                            let mediaType = null;
                            
                            if (msg.extendedTextMessage?.contextInfo?.quotedMessage) {
                                const quotedMsg = msg.extendedTextMessage.contextInfo.quotedMessage;
                                
                                if (quotedMsg.imageMessage) {
                                    mediaBuffer = await downloadMediaMessage(quotedMsg.imageMessage, 'image');
                                    mediaType = 'image';
                                    hasMedia = true;
                                } else if (quotedMsg.videoMessage) {
                                    mediaBuffer = await downloadMediaMessage(quotedMsg.videoMessage, 'video');
                                    mediaType = 'video';
                                    hasMedia = true;
                                }
                                
                                const quotedText = quotedMsg.conversation || 
                                                 (quotedMsg.extendedTextMessage?.text) || 
                                                 (quotedMsg.imageMessage?.caption) || 
                                                 (quotedMsg.videoMessage?.caption) || '';
                                
                                hidetagMessage = `📢 *PENGUMUMAN*\n\n${quotedText}\n\n━━━━━━━━━━━━━━━━\n👥 ${participants.length} members`;
                            } else {
                                const hidetagText = args.join(' ');
                                
                                if (!hidetagText) {
                                    await sock.sendMessage(sender, { 
                                        text: '┏━━━━━━━━━━━━━━━━┓\n' +
                                              '┃ 🏷️ *HIDETAG*\n' +
                                              '┣━━━━━━━━━━━━━━━━┫\n' +
                                              '┃ .hidetag [text]\n' +
                                              '┃ Reply + .hidetag\n' +
                                              '┗━━━━━━━━━━━━━━━━┛'
                                    });
                                    continue;
                                }
                                
                                hidetagMessage = `📢 *PENGUMUMAN*\n\n${hidetagText}\n\n━━━━━━━━━━━━━━━━\n👥 ${participants.length} members`;
                            }
                            
                            if (hasMedia && mediaBuffer) {
                                if (mediaType === 'image') {
                                    await sock.sendMessage(sender, { 
                                        image: mediaBuffer, 
                                        caption: hidetagMessage, 
                                        mentions 
                                    });
                                } else if (mediaType === 'video') {
                                    await sock.sendMessage(sender, { 
                                        video: mediaBuffer, 
                                        caption: hidetagMessage, 
                                        mentions 
                                    });
                                }
                            } else {
                                await sock.sendMessage(sender, { 
                                    text: hidetagMessage, 
                                    mentions 
                                });
                            }
                            
                            console.log(`✅ Hidetag sent to ${participants.length} members`);
                        } catch (error) {
                            console.error('❌ Hidetag error:', error.message);
                            await sock.sendMessage(sender, { 
                                text: `❌ Error: ${error.message}` 
                            });
                        }
                        continue;
                    }
                    
                    // TAGALL
                    if (command === '.tagall') {
                        if (!isGroup) {
                            await sock.sendMessage(sender, { text: '⚠️ *Hanya di group!*' });
                            continue;
                        }
                        
                        try {
                            const groupMetadata = await sock.groupMetadata(sender);
                            const participants = groupMetadata.participants;
                            const mentions = participants.map(p => p.id);
                            
                            let tagText = '┏━━━━━━━━━━━━━━━━┓\n';
                            tagText += '┃ 📢 *TAG ALL*\n';
                            tagText += '┣━━━━━━━━━━━━━━━━┫\n';
                            
                            participants.forEach((participant, index) => {
                                const number = participant.id.split('@')[0];
                                tagText += `┃ ${index + 1}. @${number}\n`;
                            });
                            
                            tagText += '┗━━━━━━━━━━━━━━━━┛\n\n';
                            tagText += `👥 Total: ${participants.length}`;
                            
                            await sock.sendMessage(sender, { text: tagText, mentions });
                            console.log(`✅ Tagall sent to ${participants.length} members`);
                        } catch (error) {
                            console.error('❌ Tagall error:', error.message);
                            await sock.sendMessage(sender, { 
                                text: `❌ Error: ${error.message}` 
                            });
                        }
                        continue;
                    }
                    
                    // KICK
                    if (command === '.kick') {
                        if (!isGroup) {
                            await sock.sendMessage(sender, { text: '⚠️ Hanya di grup!' });
                            continue;
                        }
                        
                        try {
                            const mentionedJid = msg.extendedTextMessage?.contextInfo?.mentionedJid;
                            
                            if (!mentionedJid || mentionedJid.length === 0) {
                                await sock.sendMessage(sender, { 
                                    text: '⚠️ Tag user!\nContoh: .kick @user' 
                                });
                                continue;
                            }
                            
                            await sock.groupParticipantsUpdate(sender, [mentionedJid[0]], 'remove');
                            await sock.sendMessage(sender, { 
                                text: `✅ @${mentionedJid[0].split('@')[0]} di-kick!`, 
                                mentions: [mentionedJid[0]] 
                            });
                        } catch (error) {
                            await sock.sendMessage(sender, { 
                                text: `❌ Error: ${error.message}` 
                            });
                        }
                        continue;
                    }
                    
                    // ADD
                    if (command === '.add') {
                        if (!isGroup) {
                            await sock.sendMessage(sender, { text: '⚠️ Hanya di grup!' });
                            continue;
                        }
                        
                        if (!args[0]) {
                            await sock.sendMessage(sender, { 
                                text: '⚠️ Format: .add [nomor]\nContoh: .add 628123456789' 
                            });
                            continue;
                        }
                        
                        try {
                            let targetNumber = args[0].replace(/[^0-9]/g, '');
                            if (!targetNumber.startsWith('62')) {
                                targetNumber = '62' + targetNumber;
                            }
                            
                            const targetJid = targetNumber + '@s.whatsapp.net';
                            await sock.groupParticipantsUpdate(sender, [targetJid], 'add');
                            await sock.sendMessage(sender, { 
                                text: `✅ ${targetNumber} ditambahkan!` 
                            });
                        } catch (error) {
                            await sock.sendMessage(sender, { 
                                text: `❌ Error: ${error.message}` 
                            });
                        }
                        continue;
                    }
                    
                    // PROMOTE
                    if (command === '.promote') {
                        if (!isGroup) {
                            await sock.sendMessage(sender, { text: '⚠️ Hanya di grup!' });
                            continue;
                        }
                        
                        try {
                            const mentionedJid = msg.extendedTextMessage?.contextInfo?.mentionedJid;
                            
                            if (!mentionedJid || mentionedJid.length === 0) {
                                await sock.sendMessage(sender, { 
                                    text: '⚠️ Tag user!\nContoh: .promote @user' 
                                });
                                continue;
                            }
                            
                            await sock.groupParticipantsUpdate(sender, [mentionedJid[0]], 'promote');
                            await sock.sendMessage(sender, { 
                                text: `✅ @${mentionedJid[0].split('@')[0]} jadi admin!`, 
                                mentions: [mentionedJid[0]] 
                            });
                        } catch (error) {
                            await sock.sendMessage(sender, { 
                                text: `❌ Error: ${error.message}` 
                            });
                        }
                        continue;
                    }
                    
                    // DEMOTE
                    if (command === '.demote') {
                        if (!isGroup) {
                            await sock.sendMessage(sender, { text: '⚠️ Hanya di grup!' });
                            continue;
                        }
                        
                        try {
                            const mentionedJid = msg.extendedTextMessage?.contextInfo?.mentionedJid;
                            
                            if (!mentionedJid || mentionedJid.length === 0) {
                                await sock.sendMessage(sender, { 
                                    text: '⚠️ Tag user!\nContoh: .demote @user' 
                                });
                                continue;
                            }
                            
                            await sock.groupParticipantsUpdate(sender, [mentionedJid[0]], 'demote');
                            await sock.sendMessage(sender, { 
                                text: `✅ @${mentionedJid[0].split('@')[0]} bukan admin!`, 
                                mentions: [mentionedJid[0]] 
                            });
                        } catch (error) {
                            await sock.sendMessage(sender, { 
                                text: `❌ Error: ${error.message}` 
                            });
                        }
                        continue;
                    }
                    
                    // LINKGC
                    if (command === '.linkgc') {
                        if (!isGroup) {
                            await sock.sendMessage(sender, { text: '⚠️ Hanya di grup!' });
                            continue;
                        }
                        
                        try {
                            const code = await sock.groupInviteCode(sender);
                            await sock.sendMessage(sender, { 
                                text: `🔗 *LINK GROUP*\n\nhttps://chat.whatsapp.com/${code}` 
                            });
                        } catch (error) {
                            await sock.sendMessage(sender, { text: '❌ Bot bukan admin!' });
                        }
                        continue;
                    }
                    
                    // REVOKE
                    if (command === '.revoke') {
                        if (!isGroup) {
                            await sock.sendMessage(sender, { text: '⚠️ Hanya di grup!' });
                            continue;
                        }
                        
                        try {
                            await sock.groupRevokeInvite(sender);
                            await sock.sendMessage(sender, { text: '✅ Link grup direset!' });
                        } catch (error) {
                            await sock.sendMessage(sender, { text: '❌ Bot bukan admin!' });
                        }
                        continue;
                    }
                    
                    // ==================== TOOLS ====================
                    
                    // PING
                    if (command === '.ping') {
                        const start = Date.now();
                        const sent = await sock.sendMessage(sender, { text: '🏓 Pinging...' });
                        const end = Date.now();
                        
                        const pingText = 
                            '┏━━━━━━━━━━━━━━━━┓\n' +
                            '┃ 🏓 *PONG!*\n' +
                            '┣━━━━━━━━━━━━━━━━┫\n' +
                            `┃ ⚡ ${end - start}ms\n` +
                            '┃ 📶 Online\n' +
                            `┃ ⏰ ${formatRuntime(Date.now() - BOT_START_TIME)}\n` +
                            `┃ 💾 ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\n` +
                            '┗━━━━━━━━━━━━━━━━┛';
                        
                        await sock.sendMessage(sender, { text: pingText, edit: sent.key });
                        continue;
                    }
                    
                    // RUNTIME
                    if (command === '.runtime') {
                        const runtimeText = 
                            '┏━━━━━━━━━━━━━━━━┓\n' +
                            '┃ ⏰ *RUNTIME*\n' +
                            '┣━━━━━━━━━━━━━━━━┫\n' +
                            `┃ 🤖 ${BOT_NAME}\n` +
                            `┃ ⏱️ ${formatRuntime(Date.now() - BOT_START_TIME)}\n` +
                            `┃ 📅 ${new Date(BOT_START_TIME).toLocaleString('id-ID')}\n` +
                            `┃ 💾 Database: MongoDB\n` +
                            '┗━━━━━━━━━━━━━━━━┛';
                        
                        await sock.sendMessage(sender, { text: runtimeText });
                        continue;
                    }
                    
                    // SHORTLINK
                    if (command === '.shortlink' && args[0]) {
                        try {
                            await sock.sendMessage(sender, { text: '⏳ Membuat shortlink...' });
                            
                            const url = args[0];
                            if (!url.startsWith('http')) {
                                throw new Error('URL harus dimulai dengan http:// atau https://');
                            }
                            
                            const shortUrl = await createShortlink(url);
                            
                            await sock.sendMessage(sender, { 
                                text: `🔗 *SHORTLINK*\n\n🌐 Original: ${url}\n🔗 Short: ${shortUrl}\n\n━━━━━━━━━━━━━━━━━━━━\n📋 Copy link di atas` 
                            });
                        } catch (error) {
                            await sock.sendMessage(sender, { 
                                text: `❌ Gagal: ${error.message}` 
                            });
                        }
                        continue;
                    }
                    
                    // ==================== FUN ====================
                    
                    // QUOTES
                    if (command === '.quotes') {
                        const quotes = [
                            "Hidup itu seperti coding, kadang ada bug tapi harus tetap di-debug! 💻",
                            "Jangan menyerah, karena setiap error adalah pelajaran baru! 🚀",
                            "Coding bukan tentang sempurna, tapi tentang terus belajar! ✨",
                            "Programmer yang baik adalah programmer yang bisa baca dokumentasi! 📚",
                            "Jika kode tidak berjalan, coba restart dan berdoa! 🙏"
                        ];
                        
                        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
                        await sock.sendMessage(sender, { 
                            text: `💬 *QUOTES*\n\n${randomQuote}\n\n━━━━━━━━━━━━━━━━━━━━\n✨ Inspirasi hari ini` 
                        });
                        continue;
                    }
                    
                    // PANTUN
                    if (command === '.pantun') {
                        const pantuns = [
                            "Pergi ke pasar beli semangka\nJangan lupa beli pepaya\nRajin-rajinlah belajar koding\nAgar jadi programmer hebat!",
                            "Minum es di siang hari\nSegar sekali di tenggorokan\nBuat kode jangan asal copy\nHarus paham dan mengerti!",
                            "Jalan-jalan ke kota Malang\nLihat gunung yang tinggi menjulang\nKoding memang butuh kesabaran\nHasilnya pasti memuaskan!"
                        ];
                        
                        const randomPantun = pantuns[Math.floor(Math.random() * pantuns.length)];
                        await sock.sendMessage(sender, { 
                            text: `📜 *PANTUN*\n\n${randomPantun}\n\n━━━━━━━━━━━━━━━━━━━━\n🎭 Pantun tradisional` 
                        });
                        continue;
                    }
                    
                    // RATE
                    if (command === '.rate' && args.length > 0) {
                        const item = args.join(' ');
                        const rating = Math.floor(Math.random() * 101);
                        let emoji = '⭐';
                        
                        if (rating >= 80) emoji = '🌟🌟🌟🌟🌟';
                        else if (rating >= 60) emoji = '🌟🌟🌟🌟';
                        else if (rating >= 40) emoji = '🌟🌟🌟';
                        else if (rating >= 20) emoji = '🌟🌟';
                        else emoji = '⭐';
                        
                        await sock.sendMessage(sender, { 
                            text: `📊 *RATING*\n\n🎯 Item: ${item}\n⭐ Rating: ${rating}/100\n${emoji}\n\n━━━━━━━━━━━━━━━━━━━━\n💡 Penilaian acak bot` 
                        });
                        continue;
                    }
                    
                    // JODOH
                    if (command === '.jodoh') {
                        const name = args[0] || pushName;
                        const compatibility = Math.floor(Math.random() * 101);
                        const statuses = [
                            'Sangat Cocok! 💖',
                            'Cocok 👍',
                            'Cukup Cocok 😊',
                            'Kurang Cocok 😐',
                            'Tidak Cocok ❌'
                        ];
                        
                        let statusIndex = 0;
                        if (compatibility >= 80) statusIndex = 0;
                        else if (compatibility >= 60) statusIndex = 1;
                        else if (compatibility >= 40) statusIndex = 2;
                        else if (compatibility >= 20) statusIndex = 3;
                        else statusIndex = 4;
                        
                        await sock.sendMessage(sender, { 
                            text: `💑 *CEK JODOH*\n\n👤 Nama: ${name}\n💝 Kecocokan: ${compatibility}%\n📊 Status: ${statuses[statusIndex]}\n\n━━━━━━━━━━━━━━━━━━━━\n🎲 Hasil acak, hanya untuk hiburan!` 
                        });
                        continue;
                    }
                    
                    // ==================== IMAGE/STICKER ====================
                    
                    // STICKER
                    if (command === '.s' || command === '.sticker') {
                        let mediaMessage = null;
                        let mediaType = null;
                        let isVideo = false;
                        
                        if (msg.extendedTextMessage?.contextInfo?.quotedMessage) {
                            const quoted = msg.extendedTextMessage.contextInfo.quotedMessage;
                            
                            if (quoted.imageMessage) {
                                mediaMessage = quoted.imageMessage;
                                mediaType = 'image';
                            } else if (quoted.videoMessage) {
                                mediaMessage = quoted.videoMessage;
                                mediaType = 'video';
                                isVideo = true;
                            }
                        } else if (msg.imageMessage) {
                            mediaMessage = msg.imageMessage;
                            mediaType = 'image';
                        } else if (msg.videoMessage) {
                            mediaMessage = msg.videoMessage;
                            mediaType = 'video';
                            isVideo = true;
                        }
                        
                        if (!mediaMessage) {
                            await sock.sendMessage(sender, { 
                                text: '⚠️ Reply gambar/video dengan caption .s' 
                            });
                            continue;
                        }
                        
                        try {
                            await sock.sendMessage(sender, { text: '⏳ Membuat sticker...' });
                            const buffer = await downloadMediaMessage(mediaMessage, mediaType);
                            const stickerBuffer = await createSticker(buffer, isVideo);
                            await sock.sendMessage(sender, { sticker: stickerBuffer });
                        } catch (error) {
                            await sock.sendMessage(sender, { 
                                text: `❌ Gagal: ${error.message}` 
                            });
                        }
                        continue;
                    }
                    
                    // TOIMG (Convert sticker to image)
                    if (command === '.toimg') {
                        try {
                            if (msg.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage) {
                                const stickerMsg = msg.extendedTextMessage.contextInfo.quotedMessage.stickerMessage;
                                
                                await sock.sendMessage(sender, { text: '⏳ Mengkonversi sticker ke gambar...' });
                                
                                const buffer = await downloadMediaMessage(stickerMsg, 'sticker');
                                const imageBuffer = await convertStickerToImage(buffer);
                                
                                await sock.sendMessage(sender, {
                                    image: imageBuffer,
                                    caption: '🔄 Sticker converted to image'
                                });
                            } else {
                                await sock.sendMessage(sender, { 
                                    text: '⚠️ Reply sticker dengan caption .toimg' 
                                });
                            }
                        } catch (error) {
                            await sock.sendMessage(sender, { 
                                text: `❌ Gagal: ${error.message}` 
                            });
                        }
                        continue;
                    }
                    
                    // AUTO STICKER (skip for view once)
                    const hasImage = msg.imageMessage;
                    const hasVideo = msg.videoMessage;
                    const isViewOnceMsg = m.key.isViewOnce;
                    
                    if ((hasImage || hasVideo) && !text.toLowerCase().includes('nosticker') && !isViewOnceMsg) {
                        try {
                            const mediaMessage = hasImage ? msg.imageMessage : msg.videoMessage;
                            const mediaType = hasImage ? 'image' : 'video';
                            const isVideo = hasVideo;
                            
                            const buffer = await downloadMediaMessage(mediaMessage, mediaType);
                            const stickerBuffer = await createSticker(buffer, isVideo);
                            await sock.sendMessage(sender, { sticker: stickerBuffer });
                        } catch (error) {
                            console.error('Auto-sticker:', error.message);
                        }
                        continue;
                    }
                    
                    // ==================== OWNER COMMANDS ====================
                    
                    // OWNER
                    if (command === '.owner') {
                        const vcard = 
                            'BEGIN:VCARD\n' +
                            'VERSION:3.0\n' +
                            `FN:${BOT_NAME} Owner\n` +
                            `TEL;type=CELL;type=VOICE;waid=${OWNER_NUMBER}:+${OWNER_NUMBER}\n` +
                            'END:VCARD';
                        
                        await sock.sendMessage(sender, {
                            contacts: {
                                displayName: `${BOT_NAME} Owner`,
                                contacts: [{ vcard }]
                            }
                        });
                        continue;
                    }
                    
                    // BAN
                    if (command === '.ban' && isOwner) {
                        if (msg.extendedTextMessage?.contextInfo?.mentionedJid) {
                            const target = msg.extendedTextMessage.contextInfo.mentionedJid[0];
                            bannedUsers.add(target);
                            await sock.sendMessage(sender, { 
                                text: `⛔ @${target.split('@')[0]} telah di-BAN!`, 
                                mentions: [target] 
                            });
                        }
                        continue;
                    }
                    
                    // UNBAN
                    if (command === '.unban' && isOwner) {
                        if (msg.extendedTextMessage?.contextInfo?.mentionedJid) {
                            const target = msg.extendedTextMessage.contextInfo.mentionedJid[0];
                            bannedUsers.delete(target);
                            await sock.sendMessage(sender, { 
                                text: `✅ @${target.split('@')[0]} telah di-UNBAN!`, 
                                mentions: [target] 
                            });
                        }
                        continue;
                    }
                    
                    // VIEWONCE LIST
                    if ((command === '.viewonce' || command === '.savedmedia') && isOwner) {
                        const savedCount = Array.from(viewOnceMessages.values()).length;
                        const fileCount = fs.existsSync(VIEWONCE_SAVE_FOLDER) ? 
                            fs.readdirSync(VIEWONCE_SAVE_FOLDER).filter(f => f.startsWith('viewonce_')).length : 0;
                        
                        const listText = 
                            `🚨 *VIEW ONCE SAVED MEDIA*\n\n` +
                            `📊 Stats:\n` +
                            `├ Total Saved: ${savedCount}\n` +
                            `├ Files in Folder: ${fileCount}\n` +
                            `└ Folder: ${VIEWONCE_SAVE_FOLDER}\n\n` +
                            `🌐 Web Access:\n` +
                            `├ List: http://localhost:${PORT}/viewonce\n` +
                            `└ Health: http://localhost:${PORT}/health\n\n` +
                            `💡 Semua media view once telah disimpan secara otomatis.`;
                        
                        await sock.sendMessage(sender, { text: listText });
                        continue;
                    }
                    
                    // ==================== AI CHAT ====================
                    
                    // AI Chat (only if no command and has text)
                    if (text && !m.key.fromMe && groq && !hasImage && !hasVideo && !text.startsWith('.') && text.length > 3) {
                        try {
                            await sock.sendPresenceUpdate('composing', sender);
                            
                            const completion = await groq.chat.completions.create({
                                messages: [
                                    { 
                                        role: 'system', 
                                        content: `Kamu adalah ${BOT_NAME}, asisten WhatsApp yang ramah dan helpful. Jawablah dalam bahasa Indonesia yang santai dan mudah dimengerti. Gunakan emoji yang sesuai.` 
                                    },
                                    { role: 'user', content: text }
                                ],
                                model: 'llama-3.3-70b-versatile',
                                max_tokens: 500,
                                temperature: 0.7
                            });
                            
                            const response = completion.choices[0].message.content;
                            if (response) {
                                await sock.sendMessage(sender, { text: response });
                            }
                        } catch (e) {
                            console.error('AI chat error:', e.message);
                        }
                    }
                    
                } catch (err) {
                    console.error('Handler error:', err.message);
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Bot startup error:', error.message);
        console.log('🔄 Restarting in 5 seconds...');
        setTimeout(() => startBot(), 5000);
    }
}

// Error handling
process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err.message);
    console.error(err.stack);
});

process.on('unhandledRejection', (err) => {
    console.error('💥 Unhandled Rejection:', err.message);
});

// test update github

startBot();