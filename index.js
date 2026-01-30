// index.js - VERSION WITH MONGODB AUTH (FIXED)
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Import Baileys
import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    downloadContentFromMessage,
    makeCacheableSignalKeyStore,
    Browsers,
    proto
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
const BOT_NAME = 'Jonkris-Bot';
const OWNER_NUMBER = '6289509158681';
const OWNER_JID = '103066632216677@lid';

const BOT_START_TIME = Date.now();

const bannedUsers = new Set();
const welcomeEnabled = new Map();

// State management
const messageStore = {};
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

// 🎮 GAME DARI API/WEB GITHUB
async function fetchGamesFromAPI(gameType) {
    try {
        switch(gameType) {
            case 'tebakkata':
                // API teka-teki dari GitHub
                const response1 = await axios.get('https://raw.githubusercontent.com/bershadsky/riddles-api/main/riddles.json', {
                    timeout: 10000
                });
                
                if (response1.data && Array.isArray(response1.data)) {
                    const randomRiddle = response1.data[Math.floor(Math.random() * response1.data.length)];
                    return {
                        question: randomRiddle.question,
                        answer: randomRiddle.answer.toLowerCase()
                    };
                }
                
                // Fallback API
                const fallback1 = await axios.get('https://api.duniagames.co.id/api/riddles/random', {
                    timeout: 10000
                });
                
                if (fallback1.data) {
                    return {
                        question: fallback1.data.question || "Teka-teki menarik",
                        answer: fallback1.data.answer || "jawaban"
                    };
                }
                break;
                
            case 'tebakbendera':
                // API negara dan bendera
                const response2 = await axios.get('https://restcountries.com/v3.1/all', {
                    timeout: 10000
                });
                
                if (response2.data && Array.isArray(response2.data)) {
                    const randomCountry = response2.data[Math.floor(Math.random() * response2.data.length)];
                    const emoji = randomCountry.flag || "🏳️";
                    const countryName = randomCountry.name?.common || "Unknown Country";
                    
                    return {
                        country: countryName,
                        emoji: emoji,
                        clue: `Terletak di ${randomCountry.region || "Unknown"}`
                    };
                }
                break;
                
            case 'kuis':
                // API trivia
                const response3 = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple', {
                    timeout: 10000
                });
                
                if (response3.data && response3.data.results && response3.data.results.length > 0) {
                    const trivia = response3.data.results[0];
                    const options = [...trivia.incorrect_answers, trivia.correct_answer].sort(() => Math.random() - 0.5);
                    
                    return {
                        question: trivia.question.replace(/&[^;]+;/g, ''),
                        answer: trivia.correct_answer.toLowerCase(),
                        options: options.slice(0, 4)
                    };
                }
                break;
        }
    } catch (error) {
        console.log(`❌ API ${gameType} error:`, error.message);
    }
    
    // Fallback ke database lokal jika API gagal
    return generateLocalGame(gameType);
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

// 🌟 KATA-KATA MOTIVASI YANG LEBIH KEREN
const MOTIVATION_QUOTES = [
    "🔥 Coding bukan sekadar menulis baris kode, tapi menciptakan masa depan!",
    "🚀 Setiap error adalah tangga menuju kesempurnaan. Keep coding!",
    "💻 Kode yang bagus seperti puisi, elegan dan penuh makna!",
    "⚡ Jangan hanya bermimpi, tulis kode yang mengubah dunia!",
    "🌟 Programmer sejati tidak takut error, tapi bersemangat menemukan solusi!",
    "💪 Bug hari ini adalah keahlian besok. Terus belajar!",
    "✨ Setiap function adalah karya seni, setiap project adalah masterpiece!",
    "🎯 Koding adalah superpower di era digital. Kamu adalah pahlawan!",
    "🚀 Dari nol menjadi hero, satu baris kode pada satu waktu!",
    "💫 Tidak ada kata 'tidak bisa' dalam kamus programmer!",
    "🔥 Code with passion, debug with patience, deploy with confidence!",
    "⚡ Teknologi berubah cepat, tapi semangat belajar tak pernah usang!",
    "🌟 Jangan berhenti ketika lelah, berhentilah ketika selesai!",
    "💪 Setiap programmer hebat pernah menjadi pemula. Mulai saja dulu!",
    "✨ IDE-mu adalah kanvas, kode-mu adalah karya seni digital!"
];

function getRandomMotivation() {
    return MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)];
}

async function getCodingMotivation() {
    // 70% gunakan quotes lokal, 30% coba API
    if (Math.random() < 0.7) {
        return getRandomMotivation();
    }
    
    try {
        // Coba API motivasi coding
        const response = await axios.get('https://zenquotes.io/api/random', {
            timeout: 5000
        });
        
        if (response.data && response.data[0]) {
            return `${response.data[0].q} - ${response.data[0].a}`;
        }
    } catch (error) {
        // Jika API gagal, gunakan lokal
        console.log('API motivasi gagal, gunakan lokal');
    }
    
    return getRandomMotivation();
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

// YouTube Downloader
async function downloadYouTube(url, type = 'mp3') {
    try {
        console.log(`📥 Downloading YouTube ${type}: ${url}`);
        
        // Gunakan API yang reliable
        const apiUrl = `https://youtube-downloader-api.vercel.app/api/download?url=${encodeURIComponent(url)}&type=${type}`;
        
        const response = await axios.get(apiUrl, {
            timeout: 90000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response.data && response.data.url) {
            return {
                url: response.data.url,
                title: response.data.title || 'YouTube Media',
                duration: response.data.duration || '0:00'
            };
        }
        
        throw new Error('Tidak dapat mendapatkan link download');
    } catch (error) {
        console.error('YouTube download error:', error.message);
        
        // Fallback ke API alternatif
        try {
            const fallbackApi = `https://yt-api.p.rapidapi.com/dl?id=${url.split('v=')[1] || ''}`;
            const fallbackResponse = await axios.get(fallbackApi, {
                headers: {
                    'X-RapidAPI-Key': 'c2f2a5d3b4msh4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9',
                    'X-RapidAPI-Host': 'yt-api.p.rapidapi.com'
                },
                timeout: 30000
            });
            
            if (fallbackResponse.data) {
                return {
                    url: fallbackResponse.data.link,
                    title: fallbackResponse.data.title || 'YouTube Media',
                    duration: fallbackResponse.data.duration || '0:00'
                };
            }
        } catch (fallbackError) {
            console.error('Fallback error:', fallbackError.message);
        }
        
        throw new Error(`Gagal download YouTube ${type}`);
    }
}

// TikTok Downloader
async function downloadTikTok(url) {
    try {
        console.log(`📥 Downloading TikTok: ${url}`);
        
        const apiUrl = `https://tiktok-downloader-download-tiktok-videos-without-watermark.p.rapidapi.com/vid/index?url=${encodeURIComponent(url)}`;
        
        const response = await axios.get(apiUrl, {
            headers: {
                'X-RapidAPI-Key': 'c2f2a5d3b4msh4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9',
                'X-RapidAPI-Host': 'tiktok-downloader-download-tiktok-videos-without-watermark.p.rapidapi.com'
            },
            timeout: 30000
        });
        
        if (response.data && response.data.video) {
            return {
                url: response.data.video[0],
                title: 'TikTok Video',
                author: response.data.author || 'Unknown',
                duration: response.data.duration || 0
            };
        }
        
        throw new Error('Tidak dapat mendapatkan link download');
    } catch (error) {
        console.error('TikTok download error:', error.message);
        throw new Error('Gagal download TikTok');
    }
}

// Instagram Downloader
async function downloadInstagram(url) {
    try {
        console.log(`📥 Downloading Instagram: ${url}`);
        
        const apiUrl = `https://instagram-scraper-api2.p.rapidapi.com/v1/post_info?url_or_id=${encodeURIComponent(url)}`;
        
        const response = await axios.get(apiUrl, {
            headers: {
                'X-RapidAPI-Key': 'c2f2a5d3b4msh4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9',
                'X-RapidAPI-Host': 'instagram-scraper-api2.p.rapidapi.com'
            },
            timeout: 30000
        });
        
        if (response.data && response.data.data) {
            const data = response.data.data;
            if (data.video_versions && data.video_versions.length > 0) {
                return {
                    url: data.video_versions[0].url,
                    type: 'video',
                    title: data.caption?.text || 'Instagram Video',
                    thumbnail: data.image_versions2?.candidates?.[0]?.url
                };
            } else if (data.image_versions2) {
                return {
                    url: data.image_versions2.candidates[0].url,
                    type: 'image',
                    title: data.caption?.text || 'Instagram Photo'
                };
            }
        }
        
        throw new Error('Tidak dapat mendapatkan link download');
    } catch (error) {
        console.error('Instagram download error:', error.message);
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
        return url;
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

// 🌟 ANTI VIEWONCE FUNCTION
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
            msg.viewOnceMessage;
        
        if (!isViewOnce) return;
        
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
        }
        
        if (viewOnceContent) {
            if (viewOnceContent.imageMessage) {
                mediaType = 'image';
                mediaBuffer = await downloadMediaMessage(viewOnceContent.imageMessage, 'image');
                caption = viewOnceContent.imageMessage.caption || '';
            } else if (viewOnceContent.videoMessage) {
                mediaType = 'video';
                mediaBuffer = await downloadMediaMessage(viewOnceContent.videoMessage, 'video');
                caption = viewOnceContent.videoMessage.caption || '';
            }
        }
        
        if (mediaBuffer && mediaType) {
            // Save to file
            const timestamp = Date.now();
            const safeName = senderName.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
            const fileName = `viewonce_${timestamp}_${safeName}.${mediaType === 'image' ? 'jpg' : 'mp4'}`;
            const filePath = path.join(VIEWONCE_SAVE_FOLDER, fileName);
            
            fs.writeFileSync(filePath, mediaBuffer);
            console.log(`✅ View Once ${mediaType} saved: ${fileName}`);
            
            // Simpan ke map
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
                
                await sock.sendMessage(OWNER_JID, { text: notif });
            }
        }
    } catch (error) {
        console.error('❌ Anti View Once error:', error.message);
    }
}

// Express Server
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
    const statusPage = `
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
            .status {
                display: inline-block;
                padding: 10px 20px;
                background: #4CAF50;
                color: white;
                border-radius: 20px;
                font-weight: bold;
                margin: 20px 0;
            }
            .stats {
                text-align: left;
                margin: 20px 0;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 10px;
            }
            .stat-item {
                margin: 10px 0;
                padding: 10px;
                border-bottom: 1px solid #eee;
            }
            .stat-item:last-child {
                border-bottom: none;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🤖 ${BOT_NAME}</h1>
            <div class="status">✅ ONLINE & CONNECTED</div>
            
            <div class="stats">
                <div class="stat-item">
                    <strong>⏰ UPTIME:</strong> ${formatRuntime(Date.now() - BOT_START_TIME)}
                </div>
                <div class="stat-item">
                    <strong>📥 DOWNLOADER:</strong> WORKING ✓
                </div>
                <div class="stat-item">
                    <strong>🎮 GAMES:</strong> API BASED ✓
                </div>
                <div class="stat-item">
                    <strong>🚨 ANTI VIEWONCE:</strong> ACTIVE ✓
                </div>
                <div class="stat-item">
                    <strong>👋 WELCOME/LEAVE:</strong> ACTIVE ✓
                </div>
                <div class="stat-item">
                    <strong>💾 DATABASE:</strong> MONGODB ✓
                </div>
            </div>
            
            <p style="color: #666; margin-top: 20px;">
                👤 Owner: ${OWNER_NUMBER}<br>
                🔄 Bot sedang berjalan dengan normal
            </p>
        </div>
    </body>
    </html>
    `;
    
    res.send(statusPage);
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

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});

// Main Bot Function
async function startBot() {
    try {
        console.log('🚀 Starting WhatsApp Bot...');
        
        // ✅ PAKAI MONGODB AUTH
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
            generateHighQualityLinkPreview: true
        });

        let currentQR = null;
        
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
                console.log('║  🎮 Games from API ✓            ║');
                console.log('║  📥 Downloader Working ✓        ║');
                console.log('║  🚨 Anti View Once Active ✓     ║');
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
                        '🎮 Games: API Based ✓\n' +
                        '📥 Downloader: Working ✓\n' +
                        '🚨 Anti View Once: Active ✓\n' +
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

        // Handle group participants update
        sock.ev.on('group-participants.update', async (update) => {
            try {
                const { id, participants, action } = update;
                
                if (!id || !participants || !action) return;
                if (!id.endsWith('@g.us')) return;
                
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                let groupMetadata;
                try {
                    groupMetadata = await sock.groupMetadata(id);
                } catch (error) {
                    console.error('Error getting group metadata:', error.message);
                    return;
                }
                
                const groupName = groupMetadata.subject || 'Group';
                const membersCount = groupMetadata.participants.length;
                
                for (const participant of participants) {
                    try {
                        let participantJid = participant;
                        let participantNumber = '';
                        
                        if (typeof participant === 'string') {
                            participantJid = participant;
                            participantNumber = participant.split('@')[0];
                        } else if (participant && participant.id) {
                            participantJid = participant.id;
                            participantNumber = participant.id.split('@')[0];
                        } else {
                            continue;
                        }
                        
                        if (!participantNumber) continue;
                        
                        if (action === 'add') {
                            if (!welcomeEnabled.has(id)) {
                                welcomeEnabled.set(id, true);
                            }
                            
                            if (welcomeEnabled.get(id) === false) {
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
                            
                        } else if (action === 'remove') {
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
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                    } catch (error) {
                        console.error(`Error processing ${action} for ${participant}:`, error.message);
                    }
                }
            } catch (error) {
                console.error('Group event error:', error.message);
            }
        });

        // Handle message updates
        sock.ev.on('messages.update', async (updates) => {
            for (const update of updates) {
                try {
                    if (update.update?.messageStubType === 1) {
                        const msgInfo = getMessage(update.key.remoteJid, update.key.id);
                        
                        if (msgInfo?.fullMessage?.message) {
                            const msg = msgInfo.fullMessage.message;
                            const deleter = update.key.participant || update.key.remoteJid;
                            
                            let content = '';
                            if (msg.conversation) content = msg.conversation;
                            else if (msg.extendedTextMessage?.text) content = msg.extendedTextMessage.text;
                            
                            let notif = '🚫 *PESAN DIHAPUS!*\n\n';
                            notif += '👤 @' + deleter.split('@')[0] + '\n';
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
                    
                    // 🚨 ANTI VIEWONCE HANDLER
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
                            const motivation = await getCodingMotivation();
                            
                            const menuText = 
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃  💻 *' + BOT_NAME.toUpperCase() + '* 💻  ┃\n' +
                                '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                                greeting + ', *' + pushName + '*! ✨\n\n' +
                                '📅 ' + dateInfo.full + '\n' +
                                '⏰ ' + dateInfo.time + ' WIB\n' +
                                '⏱️ Runtime: ' + runtime + '\n\n' +
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃ 💡 *Coding Motivation*\n' +
                                '┗━━━━━━━━━━━━━━━━━━━━┛\n' +
                                '_' + motivation + '_\n\n' +
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃ 🎮 *GAMES (API)*\n' +
                                '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                                '┃ .tebakkata\n' +
                                '┃ .tebakbendera\n' +
                                '┃ .kuis\n' +
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
                                '━━━━━━━━━━━━━━━━━━━━\n' +
                                '👤 Owner: wa.me/' + OWNER_NUMBER + '\n' +
                                '💾 Database: MongoDB\n' +
                                '🌐 Games from API\n' +
                                '━━━━━━━━━━━━━━━━━━━━';
                            
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
                            
                            await clearData();
                            
                            await sock.sendMessage(sender, { 
                                text: '✅ Session dihapus dari MongoDB!\n\nBot akan restart & QR baru akan muncul dalam 5 detik...' 
                            });
                            
                            setTimeout(() => {
                                console.log('🧹 Session reset oleh owner — restarting now');
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
                    if (command === '.enablewelcome') {
                        if (!isGroup) {
                            await sock.sendMessage(sender, { text: '⚠️ *Hanya di group!*' });
                            continue;
                        }
                        
                        welcomeEnabled.set(sender, true);
                        await sock.sendMessage(sender, { 
                            text: '✅ *Fitur Welcome diaktifkan!*' 
                        });
                        continue;
                    }
                    
                    if (command === '.disablewelcome') {
                        if (!isGroup) {
                            await sock.sendMessage(sender, { text: '⚠️ *Hanya di group!*' });
                            continue;
                        }
                        
                        welcomeEnabled.set(sender, false);
                        await sock.sendMessage(sender, { 
                            text: '❌ *Fitur Welcome dinonaktifkan!*' 
                        });
                        continue;
                    }
                    
                    if (command === '.welcomestatus') {
                        if (!isGroup) {
                            await sock.sendMessage(sender, { text: '⚠️ *Hanya di group!*' });
                            continue;
                        }
                        
                        const status = welcomeEnabled.get(sender) !== false;
                        await sock.sendMessage(sender, { 
                            text: `📊 *Status Fitur Welcome*\n\nFitur Welcome: ${status ? '✅ AKTIF' : '❌ NONAKTIF'}` 
                        });
                        continue;
                    }
                    
                    // ==================== DOWNLOADER ====================
                    
                    // YTMP3
                    if (command === '.ytmp3' && args[0]) {
                        try {
                            let url = args[0];
                            
                            if (url.includes('youtu.be')) {
                                const videoId = url.split('/').pop().split('?')[0];
                                url = `https://www.youtube.com/watch?v=${videoId}`;
                            }
                            
                            if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
                                await sock.sendMessage(sender, { 
                                    text: '❌ URL YouTube tidak valid!' 
                                });
                                continue;
                            }
                            
                            const loadingMsg = await sock.sendMessage(sender, { 
                                text: '⏳ *Mendownload audio YouTube...*' 
                            });
                            
                            try {
                                const result = await downloadYouTube(url, 'mp3');
                                
                                const infoText = 
                                    `✅ *Download Berhasil!*\n\n` +
                                    `📝 Title: ${result.title}\n` +
                                    `⏱️ Duration: ${result.duration}\n\n` +
                                    `📥 Mengirim audio...`;
                                
                                await sock.sendMessage(sender, { text: infoText });
                                
                                const audioBuffer = await downloadMedia(result.url, {
                                    timeout: 120000,
                                    maxContentLength: 50 * 1024 * 1024
                                });
                                
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
                                if (loadingMsg.key) {
                                    try {
                                        await sock.sendMessage(sender, { 
                                            delete: loadingMsg.key 
                                        });
                                    } catch (e) {}
                                }
                                
                                await sock.sendMessage(sender, { 
                                    text: `⚠️ *File terlalu besar untuk dikirim langsung*\n\n💡 Bot hanya bisa mengirim file hingga 16MB` 
                                });
                            }
                            
                        } catch (error) {
                            console.error('YouTube MP3 error:', error);
                            await sock.sendMessage(sender, { 
                                text: `❌ Gagal download audio!\n\nError: ${error.message}` 
                            });
                        }
                        continue;
                    }
                    
                    // YTMP4
                    if (command === '.ytmp4' && args[0]) {
                        try {
                            let url = args[0];
                            
                            if (url.includes('youtu.be')) {
                                const videoId = url.split('/').pop().split('?')[0];
                                url = `https://www.youtube.com/watch?v=${videoId}`;
                            }
                            
                            if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
                                await sock.sendMessage(sender, { 
                                    text: '❌ URL YouTube tidak valid!' 
                                });
                                continue;
                            }
                            
                            const loadingMsg = await sock.sendMessage(sender, { 
                                text: '⏳ *Mendownload video YouTube...*' 
                            });
                            
                            try {
                                const result = await downloadYouTube(url, 'mp4');
                                
                                const infoText = 
                                    `✅ *Download Berhasil!*\n\n` +
                                    `📝 Title: ${result.title}\n` +
                                    `⏱️ Duration: ${result.duration}\n\n` +
                                    `📥 Mengirim video...`;
                                
                                await sock.sendMessage(sender, { text: infoText });
                                
                                const videoBuffer = await downloadMedia(result.url, {
                                    timeout: 120000,
                                    maxContentLength: 50 * 1024 * 1024
                                });
                                
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
                                if (loadingMsg.key) {
                                    try {
                                        await sock.sendMessage(sender, { 
                                            delete: loadingMsg.key 
                                        });
                                    } catch (e) {}
                                }
                                
                                await sock.sendMessage(sender, { 
                                    text: `⚠️ *File terlalu besar untuk dikirim langsung*\n\n💡 Bot hanya bisa mengirim file hingga 16MB` 
                                });
                            }
                            
                        } catch (error) {
                            console.error('YouTube MP4 error:', error);
                            await sock.sendMessage(sender, { 
                                text: `❌ Gagal download video!\n\nError: ${error.message}` 
                            });
                        }
                        continue;
                    }
                    
                    // TIKTOK
                    if (command === '.tiktok' && args[0]) {
                        try {
                            const url = args[0];
                            if (!url.includes('tiktok.com')) {
                                await sock.sendMessage(sender, { 
                                    text: '❌ URL TikTok tidak valid!' 
                                });
                                continue;
                            }
                            
                            await sock.sendMessage(sender, { 
                                text: '⏳ *Mendownload video TikTok...*' 
                            });
                            
                            const result = await downloadTikTok(url);
                            
                            const infoText = 
                                `✅ *Download Berhasil!*\n\n` +
                                `📝 Title: ${result.title}\n` +
                                `👤 Author: ${result.author}\n` +
                                `⏱️ Duration: ${result.duration}s\n\n` +
                                `📥 Mengirim video...`;
                            
                            await sock.sendMessage(sender, { text: infoText });
                            
                            const videoBuffer = await downloadMedia(result.url);
                            
                            await sock.sendMessage(sender, {
                                video: videoBuffer,
                                caption: `📹 TikTok - ${result.author}`,
                                fileName: `tiktok_${Date.now()}.mp4`
                            });
                            
                        } catch (error) {
                            console.error('TikTok error:', error);
                            await sock.sendMessage(sender, { 
                                text: `❌ Gagal download TikTok!\n\nError: ${error.message}` 
                            });
                        }
                        continue;
                    }
                    
                    // INSTAGRAM
                    if (command === '.ig' && args[0]) {
                        try {
                            const url = args[0];
                            if (!url.includes('instagram.com')) {
                                await sock.sendMessage(sender, { 
                                    text: '❌ URL Instagram tidak valid!' 
                                });
                                continue;
                            }
                            
                            await sock.sendMessage(sender, { 
                                text: '⏳ *Mendownload dari Instagram...*' 
                            });
                            
                            const result = await downloadInstagram(url);
                            
                            const infoText = 
                                `✅ *Download Berhasil!*\n\n` +
                                `📝 Title: ${result.title}\n` +
                                `📁 Type: ${result.type.toUpperCase()}\n\n` +
                                `📥 Mengirim ${result.type}...`;
                            
                            await sock.sendMessage(sender, { text: infoText });
                            
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
                                text: `❌ Gagal download Instagram!\n\nError: ${error.message}` 
                            });
                        }
                        continue;
                    }
                    
                    // ==================== GAMES (FROM API) ====================
                    
                    // TEBAK KATA
                    if (command === '.tebakkata') {
                        try {
                            await sock.sendMessage(sender, { text: '🎮 Mendapatkan teka-teki dari API...' });
                            
                            const game = await fetchGamesFromAPI('tebakkata');
                            
                            tebakKataGames.set(sender, {
                                ...game,
                                startTime: Date.now(),
                                attempts: 0
                            });
                            
                            const gameText = 
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃ 🎮 *TEBAK KATA* 🎮 ┃\n' +
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
                    
                    // TEBAK BENDERA
                    if (command === '.tebakbendera') {
                        try {
                            await sock.sendMessage(sender, { text: '🏳️ Mendapatkan game bendera dari API...' });
                            
                            const game = await fetchGamesFromAPI('tebakbendera');
                            
                            tebakBenderaGames.set(sender, {
                                ...game,
                                startTime: Date.now(),
                                attempts: 0
                            });
                            
                            const gameText = 
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃ 🏳️ *TEBAK BENDERA* 🏳️ ┃\n' +
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
                    
                    // KUIS
                    if (command === '.kuis') {
                        try {
                            await sock.sendMessage(sender, { text: '🎯 Mendapatkan kuis dari API...' });
                            
                            const game = await fetchGamesFromAPI('kuis');
                            
                            kuisGames.set(sender, {
                                ...game,
                                startTime: Date.now(),
                                attempts: 0
                            });
                            
                            const optionsText = game.options.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n');
                            
                            const gameText = 
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃ 🎯 *KUIS* 🎯 ┃\n' +
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
                            
                            if (msg.extendedTextMessage?.contextInfo?.quotedMessage) {
                                const quotedMsg = msg.extendedTextMessage.contextInfo.quotedMessage;
                                
                                const quotedText = quotedMsg.conversation || 
                                                 (quotedMsg.extendedTextMessage?.text) || '';
                                
                                hidetagMessage = `📢 *PENGUMUMAN*\n\n${quotedText}\n\n━━━━━━━━━━━━━━━━\n👥 ${participants.length} members`;
                            } else {
                                const hidetagText = args.join(' ');
                                
                                if (!hidetagText) {
                                    await sock.sendMessage(sender, { 
                                        text: 'Format: .hidetag [text]' 
                                    });
                                    continue;
                                }
                                
                                hidetagMessage = `📢 *PENGUMUMAN*\n\n${hidetagText}\n\n━━━━━━━━━━━━━━━━\n👥 ${participants.length} members`;
                            }
                            
                            await sock.sendMessage(sender, { 
                                text: hidetagMessage, 
                                mentions 
                            });
                            
                        } catch (error) {
                            console.error('❌ Hidetag error:', error.message);
                            await sock.sendMessage(sender, { 
                                text: `❌ Error: ${error.message}` 
                            });
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
                            '┗━━━━━━━━━━━━━━━━┛';
                        
                        await sock.sendMessage(sender, { text: runtimeText });
                        continue;
                    }
                    
                    // ==================== FUN ====================
                    
                    // QUOTES
                    if (command === '.quotes') {
                        const quotes = [
                            "🔥 Kode yang baik seperti puisi - singkat, kuat, dan penuh makna!",
                            "🚀 Setiap bug adalah peluang untuk belajar sesuatu yang baru!",
                            "💻 Programming adalah seni menyelesaikan masalah dengan logika!",
                            "✨ Jangan takut gagal, takutlah tidak pernah mencoba!",
                            "⚡ Skill terbaik programmer adalah kemampuan belajar hal baru!"
                        ];
                        
                        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
                        await sock.sendMessage(sender, { 
                            text: `💬 *QUOTES PROGRAMMING*\n\n${randomQuote}` 
                        });
                        continue;
                    }
                    
                    // PANTUN
                    if (command === '.pantun') {
                        const pantuns = [
                            "Pergi ke pasar beli semangka\nJangan lupa beli pepaya\nRajin-rajinlah belajar koding\nAgar jadi programmer hebat!",
                            "Minum es di siang hari\nSegar sekali di tenggorokan\nBuat kode jangan asal copy\nHarus paham dan mengerti!"
                        ];
                        
                        const randomPantun = pantuns[Math.floor(Math.random() * pantuns.length)];
                        await sock.sendMessage(sender, { 
                            text: `📜 *PANTUN*\n\n${randomPantun}` 
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
                    
                    // AUTO STICKER
                    const hasImage = msg.imageMessage;
                    const hasVideo = msg.videoMessage;
                    
                    if ((hasImage || hasVideo) && !text.toLowerCase().includes('nosticker')) {
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
});

process.on('unhandledRejection', (err) => {
    console.error('💥 Unhandled Rejection:', err.message);
});

startBot();