// index.js - VERSION 2.0 WITH 15+ GAMES & RPG SYSTEM
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

// ✅ IMPORT GAME & RPG SYSTEMS
import GameSystem from './gameSystem.js';
import RPGSystem from './rpgSystem.js';

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
const OWNER_JID = '103066632216677@lid';

const BOT_START_TIME = Date.now();

const bannedUsers = new Set();
const welcomeEnabled = new Map();

// State management
const messageStore = {};
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

// 📥 DOWNLOADER FUNCTIONS
async function downloadMedia(url, options = {}) {
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer',
            timeout: 60000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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

async function downloadYouTube(url, type = 'mp3') {
    try {
        console.log(`📥 Downloading YouTube ${type}: ${url}`);
        
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
        
        throw new Error('Tidak dapat mendapatkan link download');
    } catch (error) {
        console.error('YouTube download error:', error.message);
        throw new Error(`Gagal download YouTube ${type}`);
    }
}

async function downloadTikTok(url) {
    try {
        console.log(`📥 Downloading TikTok: ${url}`);
        
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
        
        throw new Error('Tidak dapat mendapatkan link download');
    } catch (error) {
        console.error('TikTok download error:', error.message);
        throw new Error('Gagal download TikTok');
    }
}

async function downloadInstagram(url) {
    try {
        console.log(`📥 Downloading Instagram: ${url}`);
        
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
        throw new Error('Gagal download Instagram');
    }
}

async function createShortlink(url) {
    try {
        const tinyurl = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`;
        const response = await axios.get(tinyurl, { timeout: 5000 });
        return response.data;
    } catch {
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
        
        const isViewOnce = 
            msg.viewOnceMessageV2 || 
            msg.viewOnceMessageV2Extension || 
            msg.viewOnceMessage || 
            (m.key && m.key.isViewOnce);
        
        if (!isViewOnce) return;
        
        console.log(`🔍 View Once message detected from ${senderName}`);
        
        let mediaBuffer = null;
        let mediaType = null;
        let caption = '';
        
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
                try {
                    mediaBuffer = await downloadMediaMessage(viewOnceContent.imageMessage, 'image');
                    caption = viewOnceContent.imageMessage.caption || '';
                } catch (error) {
                    console.error('Error downloading view once image:', error.message);
                    return;
                }
            } else if (viewOnceContent.videoMessage) {
                mediaType = 'video';
                try {
                    mediaBuffer = await downloadMediaMessage(viewOnceContent.videoMessage, 'video');
                    caption = viewOnceContent.videoMessage.caption || '';
                } catch (error) {
                    console.error('Error downloading view once video:', error.message);
                    return;
                }
            }
        }
        
        if (mediaBuffer && mediaType) {
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
            
            viewOnceMessages.set(messageId, {
                sender,
                senderName,
                timestamp,
                mediaType,
                filePath,
                caption,
                saved: true
            });
            
            if (sender !== OWNER_JID) {
                const notif = 
                    `🚨 *VIEW ONCE DETECTED!*\n\n` +
                    `👤 From: ${senderName}\n` +
                    `📞 Number: ${sender.split('@')[0]}\n` +
                    `📁 Type: ${mediaType.toUpperCase()}\n` +
                    `⏰ Time: ${new Date().toLocaleTimeString('id-ID')}`;
                
                try {
                    await sock.sendMessage(OWNER_JID, { text: notif });
                } catch (error) {
                    console.error('Error sending notification to owner:', error.message);
                }
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
    const dateInfo = getFormattedDate();
    const runtime = formatRuntime(Date.now() - BOT_START_TIME);
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${BOT_NAME} v2.0</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                    color: #333;
                }
                .container {
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(10px);
                    padding: 40px;
                    border-radius: 20px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    text-align: center;
                    max-width: 800px;
                    width: 100%;
                }
                h1 {
                    color: #667eea;
                    margin-bottom: 20px;
                    font-size: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                }
                .stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 15px;
                    margin: 30px 0;
                }
                .stat-card {
                    background: white;
                    padding: 20px;
                    border-radius: 15px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                    transition: transform 0.3s;
                }
                .stat-card:hover {
                    transform: translateY(-5px);
                }
                .stat-card h3 {
                    color: #667eea;
                    font-size: 14px;
                    margin-bottom: 10px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .stat-card p {
                    font-size: 24px;
                    font-weight: bold;
                    color: #333;
                }
                .features {
                    text-align: left;
                    background: white;
                    padding: 25px;
                    border-radius: 15px;
                    margin: 20px 0;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                }
                .features h3 {
                    color: #667eea;
                    margin-bottom: 15px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .feature-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                }
                .feature-item {
                    padding: 15px;
                    background: #f8f9fa;
                    border-radius: 10px;
                    border-left: 4px solid #667eea;
                }
                .feature-item strong {
                    color: #667eea;
                }
                .status-badge {
                    display: inline-block;
                    padding: 5px 15px;
                    background: #4CAF50;
                    color: white;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: bold;
                    margin-left: 10px;
                }
                .footer {
                    margin-top: 30px;
                    color: #666;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 ${BOT_NAME} <span class="status-badge">v2.0</span></h1>
                <p><strong>${dateInfo.full}</strong> • ${dateInfo.time} WIB</p>
                <p>⏱️ Uptime: ${runtime}</p>
                
                <div class="stats">
                    <div class="stat-card">
                        <h3>🎮 Games</h3>
                        <p>15+</p>
                    </div>
                    <div class="stat-card">
                        <h3>👥 Groups</h3>
                        <p>${welcomeEnabled.size}</p>
                    </div>
                    <div class="stat-card">
                        <h3>💾 Database</h3>
                        <p>MongoDB ✓</p>
                    </div>
                    <div class="stat-card">
                        <h3>🚨 ViewOnce</h3>
                        <p>${viewOnceMessages.size} saved</p>
                    </div>
                </div>
                
                <div class="features">
                    <h3>✨ Featured Systems</h3>
                    <div class="feature-grid">
                        <div class="feature-item">
                            <strong>🎮 Game System</strong><br>
                            15+ games from Web API
                        </div>
                        <div class="feature-item">
                            <strong>🎪 RPG System</strong><br>
                            Level, coins, inventory
                        </div>
                        <div class="feature-item">
                            <strong>📥 Downloader</strong><br>
                            YT, TikTok, IG, etc.
                        </div>
                        <div class="feature-item">
                            <strong>👥 Group Tools</strong><br>
                            Welcome, tagall, etc.
                        </div>
                    </div>
                </div>
                
                <div class="features">
                    <h3>🎯 Available Games</h3>
                    <div class="feature-grid">
                        <div class="feature-item">1. Tebak Kata</div>
                        <div class="feature-item">2. Tebak Gambar</div>
                        <div class="feature-item">3. Quiz</div>
                        <div class="feature-item">4. Truth or Dare</div>
                        <div class="feature-item">5. Tebak Lagu</div>
                        <div class="feature-item">6. Tebak Bendera</div>
                        <div class="feature-item">7. Tebak Emoji</div>
                        <div class="feature-item">8. Tebak Lirik</div>
                        <div class="feature-item">9. Math Battle</div>
                        <div class="feature-item">10. Suit</div>
                        <div class="feature-item">11. Tebak Angka</div>
                        <div class="feature-item">12. RPG System</div>
                        <div class="feature-item">13. Spin/Gacha</div>
                        <div class="feature-item">14. Pet Game</div>
                        <div class="feature-item">15. Werewolf</div>
                    </div>
                </div>
                
                <div class="footer">
                    👤 Owner: ${OWNER_NUMBER}<br>
                    🚀 Powered by Baileys & MongoDB<br>
                    ⚡ Auto-refresh every 30 seconds
                </div>
            </div>
            
            <script>
                setTimeout(() => location.reload(), 30000);
            </script>
        </body>
        </html>
    `);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        bot: BOT_NAME,
        version: '2.0',
        owner: OWNER_NUMBER,
        uptime: formatRuntime(Date.now() - BOT_START_TIME),
        games_available: 15,
        rpg_system: true,
        timestamp: new Date().toISOString()
    });
});

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
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/health`);
    console.log(`🎮 ${BOT_NAME} v2.0 - 15+ Games Ready!`);
});

// Main Bot Function
async function startBot() {
    try {
        console.log('🚀 Starting WhatsApp Bot v2.0...');
        
        const { state, saveCreds, clearData } = await useMongoAuthState();
        const { version } = await fetchLatestBaileysVersion();
        
        console.log(`📱 WhatsApp v${version.join('.')}`);
        console.log(`🤖 Bot: ${BOT_NAME} v2.0`);
        console.log(`👤 Owner: ${OWNER_NUMBER}`);
        console.log(`🎮 Games: 15+ available`);
        console.log(`🎪 RPG System: Enabled`);
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

        // Initialize Game & RPG Systems
        const gameSystem = new GameSystem(sock);
        const rpgSystem = new RPGSystem();

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('\n╔══════════════════════╗');
                console.log('║  📱 SCAN QR CODE    ║');
                console.log('╚══════════════════════╝\n');
                qrcode.generate(qr, { small: true });
            }
            
            if (connection === 'close') {
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
                console.log('\n╔════════════════════════════════════════╗');
                console.log('║  ✅ ' + BOT_NAME + ' v2.0 ONLINE!       ║');
                console.log('║  🎮 15+ Games Ready ✓                   ║');
                console.log('║  🎪 RPG System Active ✓                 ║');
                console.log('║  📥 Downloader Updated ✓                ║');
                console.log('║  🚨 Anti View Once Active ✓             ║');
                console.log('║  👥 Group Tools Ready ✓                 ║');
                console.log('║  💾 MongoDB Connected ✓                 ║');
                console.log('╚════════════════════════════════════════╝\n');
                
                try {
                    const dateInfo = getFormattedDate();
                    const runtime = formatRuntime(Date.now() - BOT_START_TIME);
                    
                    const statusMsg = 
                        '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                        '┃  🤖 *BOT ONLINE!*  ┃\n' +
                        '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                        `✅ ${BOT_NAME} v2.0 is now online!\n\n` +
                        `📅 ${dateInfo.full}\n` +
                        `⏰ ${dateInfo.time}\n` +
                        `⏱️ Uptime: ${runtime}\n\n` +
                        '━━━━━━━━━━━━━━━━━━━━\n' +
                        '🎮 15+ Games: Ready ✓\n' +
                        '🎪 RPG System: Active ✓\n' +
                        '📥 Downloader: Updated ✓\n' +
                        '🚨 Anti View Once: Active ✓\n' +
                        '👥 Group Tools: Ready ✓\n' +
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
                    groupMetadata = { subject: 'Group', participants: [] };
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
                            
                            if (welcomeEnabled.get(id) === false) continue;
                            
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
                                '🎮 Ketik .menu untuk melihat fitur\n' +
                                `💻 _${BOT_NAME} v2.0_`;
                            
                            await sock.sendMessage(id, { 
                                text: welcomeMsg, 
                                mentions: [participantJid] 
                            });
                            
                        } else if (action === 'remove') {
                            const botJid = sock.user?.id;
                            if (participantJid === botJid) continue;
                            
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
                        console.error(`Error processing ${action}:`, error.message);
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
                            const name = msgInfo.pushName;
                            
                            let content = '';
                            if (msg.conversation) content = msg.conversation;
                            else if (msg.extendedTextMessage?.text) content = msg.extendedTextMessage.text;
                            else if (msg.imageMessage?.caption) content = msg.imageMessage.caption;
                            
                            let notif = '🚫 *PESAN DIHAPUS!*\n\n';
                            notif += '👤 @' + deleter.split('@')[0] + '\n';
                            notif += '📝 ' + name + '\n';
                            notif += '⏰ ' + new Date().toLocaleTimeString('id-ID') + '\n';
                            if (content) notif += '\n💬 "' + content.substring(0, 100) + '"';
                            
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
                    if (command === '.menu' || command === '.help') {
                        console.log(`📋 Menu command from: ${pushName}`);
                        
                        try {
                            const greeting = getGreeting();
                            const dateInfo = getFormattedDate();
                            const runtime = formatRuntime(Date.now() - BOT_START_TIME);
                            
                            const motivation = await getAICodingMotivation();
                            
                            const menuText = 
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃  💻 *' + BOT_NAME.toUpperCase() + ' v2.0* 💻  ┃\n' +
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
                                '┃ 🎮 *GAMES (15+)*\n' +
                                '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                                '┃ .tebakkata .tebakgambar\n' +
                                '┃ .quiz .truth .dare\n' +
                                '┃ .tebaklagu .tebakbendera\n' +
                                '┃ .tebakemoji .tebaklirik\n' +
                                '┃ .math .suit .tebakangka\n' +
                                '┃ .hint (clue game aktif)\n' +
                                '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃ 🎪 *RPG SYSTEM*\n' +
                                '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                                '┃ .profile .daily .work\n' +
                                '┃ .hunt .fight @user\n' +
                                '┃ .shop .buy .inventory\n' +
                                '┃ .leaderboard .spin\n' +
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
                                '🤖 AI Powered Bot v2.0\n' +
                                '━━━━━━━━━━━━━━━━━━━━';
                            
                            await sock.sendMessage(sender, { text: menuText });
                        } catch (error) {
                            console.error('❌ Menu error:', error.message);
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
                            setTimeout(() => process.exit(1), 5000);
                        } catch (e) {
                            console.error('❌ Gagal reset session:', e.message);
                            await sock.sendMessage(sender, { text: `❌ Gagal reset: ${e.message}` });
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
                        await sock.sendMessage(sender, { text: '✅ *Fitur Welcome diaktifkan!*' });
                        continue;
                    }
                    
                    if (command === '.disablewelcome') {
                        if (!isGroup) {
                            await sock.sendMessage(sender, { text: '⚠️ *Hanya di group!*' });
                            continue;
                        }
                        welcomeEnabled.set(sender, false);
                        await sock.sendMessage(sender, { text: '❌ *Fitur Welcome dinonaktifkan!*' });
                        continue;
                    }
                    
                    if (command === '.welcomestatus') {
                        if (!isGroup) {
                            await sock.sendMessage(sender, { text: '⚠️ *Hanya di group!*' });
                            continue;
                        }
                        const status = welcomeEnabled.get(sender) !== false;
                        await sock.sendMessage(sender, { 
                            text: `📊 *Status Fitur Welcome*\n\nGrup: ${isGroup ? '✅' : '❌'}\nFitur Welcome: ${status ? '✅ AKTIF' : '❌ NONAKTIF'}` 
                        });
                        continue;
                    }
                    
                    // ==================== GAME ANSWER HANDLER (NON-COMMAND) ====================
                    const activeGame = gameSystem.getGame(sender);
                    
                    if (activeGame && !text.startsWith('.') && text.trim()) {
                        // Process game answer
                        const isCorrect = gameSystem.checkAnswer(activeGame, text);
                        
                        if (isCorrect) {
                            // Give rewards melalui RPG system
                            await rpgSystem.addCoins(userId, activeGame.points || 50);
                            await rpgSystem.addExp(userId, 10);
                            
                            await sock.sendMessage(sender, { 
                                text: `✅ *BENAR!*\n\n🏆 +${activeGame.points || 50} coins\n⭐ +10 EXP\n\n🎉 Selamat!` 
                            });
                            
                            gameSystem.removeGame(sender);
                        } else {
                            // Handle wrong answer berdasarkan game type
                            switch(activeGame.type) {
                                case 'tebak-angka':
                                    const guess = parseInt(text);
                                    if (!isNaN(guess)) {
                                        const hint = guess > activeGame.number ? 'KECIL' : 'BESAR';
                                        await sock.sendMessage(sender, { 
                                            text: `📉 Tebakanmu terlalu ${hint}! Coba lagi.\n\nKesempatan: ${activeGame.attempts + 1}/${activeGame.maxAttempts}` 
                                        });
                                        activeGame.attempts++;
                                        
                                        if (activeGame.attempts >= activeGame.maxAttempts) {
                                            await sock.sendMessage(sender, { 
                                                text: `💀 GAME OVER!\nAngka yang benar: ${activeGame.number}\n\n💡 Ketik .tebakangka untuk bermain lagi` 
                                            });
                                            gameSystem.removeGame(sender);
                                        }
                                    }
                                    break;
                                case 'tebak-kata':
                                    activeGame.attempts++;
                                    if (activeGame.attempts >= activeGame.maxAttempts) {
                                        await sock.sendMessage(sender, { 
                                            text: `💀 GAME OVER!\nKata yang benar: ${activeGame.answer}\n\n💡 Ketik .tebakkata untuk bermain lagi` 
                                        });
                                        gameSystem.removeGame(sender);
                                    } else {
                                        await sock.sendMessage(sender, { 
                                            text: `❌ Salah! Kesempatan tersisa: ${activeGame.maxAttempts - activeGame.attempts}\n💡 Hint: ${gameSystem.getHint(activeGame)}` 
                                        });
                                    }
                                    break;
                                default:
                                    await sock.sendMessage(sender, { 
                                        text: '❌ Salah! Coba lagi.' 
                                    });
                            }
                        }
                        continue; // Skip processing lainnya
                    }
                    
                    // ==================== GAME COMMAND HANDLERS ====================
                    
                    // 1) Tebak Kata
                    if (command === '.tebakkata' || command === '.tkata') {
                        await gameSystem.startTebakKata(sender);
                        continue;
                    }
                    
                    // 2) Tebak Gambar
                    if (command === '.tebakgambar' || command === '.tgambar') {
                        const mode = args[0] || 'easy';
                        if (!['easy', 'medium', 'hard'].includes(mode)) {
                            await sock.sendMessage(sender, { 
                                text: '❌ Mode tidak valid!\n\n💡 Gunakan: .tebakgambar [easy/medium/hard]' 
                            });
                            continue;
                        }
                        await gameSystem.startTebakGambar(sender, mode);
                        continue;
                    }
                    
                    // 3) Quiz
                    if (command === '.quiz' || command === '.kuis') {
                        const category = args[0] || 'random';
                        await gameSystem.startQuiz(sender, category);
                        continue;
                    }
                    
                    // 4) Truth or Dare
                    if (command === '.truth') {
                        const truth = await gameSystem.getTruthOrDare('truth');
                        await sock.sendMessage(sender, { 
                            text: `🤫 *TRUTH*\n\n${truth.text}\n\n💬 Jawab dengan jujur!` 
                        });
                        continue;
                    }
                    
                    if (command === '.dare') {
                        const dare = await gameSystem.getTruthOrDare('dare');
                        await sock.sendMessage(sender, { 
                            text: `😈 *DARE*\n\n${dare.text}\n\n⚡ Lakukan dalam 5 menit!` 
                        });
                        continue;
                    }
                    
                    // 5) Tebak Lagu
                    if (command === '.tebaklagu' || command === '.tlagu') {
                        await gameSystem.startTebakLagu(sender);
                        continue;
                    }
                    
                    // 6) Tebak Bendera
                    if (command === '.tebakbendera' || command === '.tbendera') {
                        await gameSystem.startTebakBendera(sender);
                        continue;
                    }
                    
                    // 7) Tebak Emoji
                    if (command === '.tebakemoji' || command === '.temoji') {
                        await gameSystem.startTebakEmoji(sender);
                        continue;
                    }
                    
                    // 8) Tebak Lirik
                    if (command === '.tebaklirik' || command === '.tlirik') {
                        await gameSystem.startTebakLirik(sender);
                        continue;
                    }
                    
                    // 9) Math Battle
                    if (command === '.math' || command === '.mathbattle') {
                        await gameSystem.startMathBattle(sender);
                        continue;
                    }
                    
                    // 10) Suit
                    if (command === '.suit') {
                        if (!['batu', 'gunting', 'kertas'].includes(args[0])) {
                            await sock.sendMessage(sender, { 
                                text: '✊✌️✋ *SUIT*\n\nPilihan:\n• batu\n• gunting\n• kertas\n\nContoh: .suit batu' 
                            });
                            continue;
                        }
                        
                        const result = await gameSystem.playSuit(sender, args[0]);
                        
                        if (result.winner === 'player') {
                            await rpgSystem.addCoins(userId, 30);
                            await rpgSystem.addExp(userId, 5);
                            result.message += `\n\n🏆 +30 coins\n⭐ +5 EXP`;
                        }
                        
                        await sock.sendMessage(sender, { text: result.message });
                        continue;
                    }
                    
                    // 11) Tebak Angka
                    if (command === '.tebakangka' || command === '.tangka') {
                        await gameSystem.startTebakAngka(sender);
                        continue;
                    }
                    
                    // 12) Game Hint
                    if (command === '.hint') {
                        const game = gameSystem.getGame(sender);
                        if (game) {
                            const hint = gameSystem.getHint(game);
                            await sock.sendMessage(sender, { text: `💡 ${hint}` });
                        } else {
                            await sock.sendMessage(sender, { text: '❌ Tidak ada game yang aktif!' });
                        }
                        continue;
                    }
                    
                    // ==================== RPG SYSTEM HANDLERS ====================
                    
                    // Profile
                    if (command === '.profile' || command === '.myprofile') {
                        const profile = await rpgSystem.getProfile(userId);
                        
                        const profileText = 
                            `👤 *PROFILE*\n\n` +
                            `📛 Name: ${profile.username}\n` +
                            `🎯 Level: ${profile.level}\n` +
                            `📊 EXP: ${profile.exp}/${profile.expNeeded} (${profile.expPercent}%)\n` +
                            `💰 Coins: ${profile.coins}\n` +
                            `🔥 Streak: ${profile.dailyStreak} hari\n\n` +
                            `📈 Stats:\n` +
                            `├ Games Won: ${profile.stats.gamesWon}\n` +
                            `├ Games Played: ${profile.stats.gamesPlayed}\n` +
                            `└ Total Coins: ${profile.stats.totalCoins}\n\n` +
                            `📦 Inventory: ${profile.inventoryCount} items\n` +
                            `🐾 Pet: ${profile.pet || 'Tidak ada'}`;
                        
                        await sock.sendMessage(sender, { text: profileText });
                        continue;
                    }
                    
                    // Daily Reward
                    if (command === '.daily' || command === '.hadiah') {
                        const result = await rpgSystem.claimDaily(userId);
                        
                        if (result.success) {
                            const text = 
                                `🎁 *DAILY REWARD*\n\n` +
                                `💰 Coins: +${result.coins}\n` +
                                `⭐ EXP: +${result.exp}\n` +
                                `🔥 Streak: ${result.streak} hari\n\n` +
                                `✅ Klaim berhasil!\n` +
                                `⏰ Kembali besok untuk hadiah lebih besar!`;
                            
                            await sock.sendMessage(sender, { text });
                        } else {
                            await sock.sendMessage(sender, { 
                                text: `⏳ Tunggu ${result.hoursLeft} jam lagi untuk klaim daily!` 
                            });
                        }
                        continue;
                    }
                    
                    // Work
                    if (command === '.work' || command === '.kerja') {
                        const result = await rpgSystem.work(userId);
                        
                        if (result.success) {
                            const text = 
                                `💼 *WORK*\n\n` +
                                `Pekerjaan: ${result.job}\n` +
                                `💰 Coins: +${result.coins}\n` +
                                `⭐ EXP: +${result.exp}\n\n` +
                                `⏰ Cooldown: 5 menit`;
                            
                            await sock.sendMessage(sender, { text });
                        } else {
                            await sock.sendMessage(sender, { 
                                text: `⏳ Tunggu ${result.minutesLeft} menit lagi untuk kerja!` 
                            });
                        }
                        continue;
                    }
                    
                    // Hunt
                    if (command === '.hunt' || command === '.berburu') {
                        const result = await rpgSystem.hunt(userId);
                        
                        if (result.success) {
                            if (result.caught) {
                                const rareText = result.rare ? '✨ *ITEM LANGKA!* ✨\n' : '';
                                const text = 
                                    `🏹 *HUNT*\n\n` +
                                    rareText +
                                    `🎯 Berhasil menangkap: ${result.item}\n` +
                                    `💰 Coins: +${result.coins}\n` +
                                    `⭐ EXP: +${result.exp}\n\n` +
                                    `⏰ Cooldown: 10 menit`;
                                
                                await sock.sendMessage(sender, { text });
                            } else {
                                await sock.sendMessage(sender, { 
                                    text: `🏹 *HUNT*\n\n${result.message}\n\n⏰ Cooldown: 10 menit` 
                                });
                            }
                        } else {
                            await sock.sendMessage(sender, { 
                                text: `⏳ Tunggu ${result.minutesLeft} menit lagi untuk berburu!` 
                            });
                        }
                        continue;
                    }
                    
                    // Fight (PvP)
                    if (command === '.fight' || command === '.pvp') {
                        if (!isGroup) {
                            await sock.sendMessage(sender, { text: '⚠️ *Hanya di group!*' });
                            continue;
                        }
                        
                        const mentionedJid = msg.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                        if (!mentionedJid) {
                            await sock.sendMessage(sender, { 
                                text: '⚔️ *FIGHT*\n\nTag lawanmu!\nContoh: .fight @user' 
                            });
                            continue;
                        }
                        
                        if (mentionedJid === userId) {
                            await sock.sendMessage(sender, { text: '❌ Tidak bisa fight diri sendiri!' });
                            continue;
                        }
                        
                        try {
                            await rpgSystem.getUser(mentionedJid);
                        } catch {
                            await sock.sendMessage(sender, { 
                                text: '❌ Lawan belum terdaftar di RPG system!' 
                            });
                            continue;
                        }
                        
                        const result = await rpgSystem.fight(userId, mentionedJid);
                        
                        const winnerName = result.winner.split('@')[0];
                        const loserName = result.loser.split('@')[0];
                        
                        const text = 
                            `⚔️ *BATTLE RESULT*\n\n` +
                            `🏆 Winner: @${winnerName}\n` +
                            `💀 Loser: @${loserName}\n\n` +
                            `💰 Coins: +${result.coins} (winner) / -${result.coins} (loser)\n` +
                            `⭐ EXP: +${result.exp.winner} (winner) / +${result.exp.loser} (loser)`;
                        
                        await sock.sendMessage(sender, { 
                            text: text,
                            mentions: [result.winner, result.loser]
                        });
                        continue;
                    }
                    
                    // Shop
                    if (command === '.shop' || command === '.toko') {
                        const shopItems = [
                            { id: 1, name: '🍎 Apel Penyembuh', price: 50, desc: 'Menyembuhkan 50 HP' },
                            { id: 2, name: '⚔️ Pedang Besi', price: 200, desc: 'Attack +10' },
                            { id: 3, name: '🛡️ Perunggu Shield', price: 150, desc: 'Defense +5' },
                            { id: 4, name: '💎 Diamond', price: 500, desc: 'Item langka untuk upgrade' },
                            { id: 5, name: '🐾 Pet Egg', price: 1000, desc: 'Menetas menjadi pet' }
                        ];
                        
                        let shopText = `🛒 *SHOP*\n\n`;
                        shopItems.forEach(item => {
                            shopText += `${item.id}. ${item.name}\n💰 ${item.price} coins\n📝 ${item.desc}\n\n`;
                        });
                        
                        shopText += `💡 Beli dengan: .buy [id]\n💰 Cek coins: .profile`;
                        
                        await sock.sendMessage(sender, { text: shopText });
                        continue;
                    }
                    
                    // Buy from shop
                    if (command === '.buy' || command === '.beli') {
                        const itemId = parseInt(args[0]);
                        const user = await rpgSystem.getUser(userId);
                        
                        const shopItems = [
                            { id: 1, name: '🍎 Apel Penyembuh', price: 50 },
                            { id: 2, name: '⚔️ Pedang Besi', price: 200 },
                            { id: 3, name: '🛡️ Perunggu Shield', price: 150 },
                            { id: 4, name: '💎 Diamond', price: 500 },
                            { id: 5, name: '🐾 Pet Egg', price: 1000 }
                        ];
                        
                        const item = shopItems.find(i => i.id === itemId);
                        
                        if (!item) {
                            await sock.sendMessage(sender, { 
                                text: '❌ Item tidak ditemukan!\n💡 Lihat .shop untuk daftar item' 
                            });
                            continue;
                        }
                        
                        if (user.coins < item.price) {
                            await sock.sendMessage(sender, { 
                                text: `❌ Coins tidak cukup!\n💰 Kamu punya: ${user.coins} coins\n💵 Dibutuhkan: ${item.price} coins` 
                            });
                            continue;
                        }
                        
                        await rpgSystem.updateUser(userId, {
                            coins: user.coins - item.price
                        });
                        
                        await sock.sendMessage(sender, { 
                            text: `✅ Berhasil membeli ${item.name}!\n💰 -${item.price} coins\n📦 Item ditambahkan ke inventory` 
                        });
                        continue;
                    }
                    
                    // Inventory
                    if (command === '.inventory' || command === '.inv') {
                        const user = await rpgSystem.getProfile(userId);
                        let invText = `📦 *INVENTORY*\n\n`;
                        
                        if (user.inventoryCount === 0) {
                            invText += `Kosong! Beli item di .shop`;
                        } else {
                            invText += `Total items: ${user.inventoryCount}\n`;
                            invText += `💡 Gunakan item dengan .use [nama]`;
                        }
                        
                        invText += `\n💰 Coins: ${user.coins}`;
                        
                        await sock.sendMessage(sender, { text: invText });
                        continue;
                    }
                    
                    // Leaderboard
                    if (command === '.leaderboard' || command === '.top') {
                        const type = args[0] || 'coins';
                        const topUsers = await rpgSystem.getLeaderboard(type, 10);
                        
                        let leaderboardText = `🏆 *LEADERBOARD*\n\n`;
                        leaderboardText += `📊 Kategori: ${type.toUpperCase()}\n\n`;
                        
                        topUsers.forEach(user => {
                            let value = '';
                            switch(type) {
                                case 'coins': value = `💰 ${user.coins}`; break;
                                case 'level': value = `🎯 Level ${user.level}`; break;
                                case 'streak': value = `🔥 ${user.streak} hari`; break;
                            }
                            
                            leaderboardText += `${user.rank}. ${user.username}\n${value}\n\n`;
                        });
                        
                        await sock.sendMessage(sender, { text: leaderboardText });
                        continue;
                    }
                    
                    // Spin / Gacha
                    if (command === '.spin' || command === '.gacha') {
                        const user = await rpgSystem.getUser(userId);
                        
                        if (user.coins < 50) {
                            await sock.sendMessage(sender, { 
                                text: `❌ Coins tidak cukup!\n💰 Dibutuhkan: 50 coins\n💵 Kamu punya: ${user.coins} coins` 
                            });
                            continue;
                        }
                        
                        const rewards = [
                            { name: '💰 10 coins', value: 10, type: 'coins' },
                            { name: '💰 50 coins', value: 50, type: 'coins' },
                            { name: '💰 100 coins', value: 100, type: 'coins' },
                            { name: '⭐ 20 EXP', value: 20, type: 'exp' },
                            { name: '⭐ 50 EXP', value: 50, type: 'exp' },
                            { name: '🍎 Apel', value: 'apple', type: 'item' },
                            { name: '✨ Rare Item', value: 'rare', type: 'item', rare: true }
                        ];
                        
                        const reward = rewards[Math.floor(Math.random() * rewards.length)];
                        
                        await rpgSystem.updateUser(userId, {
                            coins: user.coins - 50
                        });
                        
                        let rewardText = `🎰 *SPIN RESULT*\n\n`;
                        rewardText += `Kamu mendapatkan: ${reward.name}\n`;
                        
                        if (reward.type === 'coins') {
                            await rpgSystem.addCoins(userId, reward.value);
                            rewardText += `💰 +${reward.value} coins`;
                        } else if (reward.type === 'exp') {
                            await rpgSystem.addExp(userId, reward.value);
                            rewardText += `⭐ +${reward.value} EXP`;
                        } else if (reward.type === 'item') {
                            rewardText += `🎁 Item telah ditambahkan ke inventory`;
                            if (reward.rare) {
                                rewardText += `\n✨ *ITEM LANGKA!*`;
                            }
                        }
                        
                        rewardText += `\n\n💰 Biaya spin: -50 coins`;
                        
                        await sock.sendMessage(sender, { text: rewardText });
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
                            
                            await sock.sendMessage(sender, { 
                                text: '⏳ *Mendownload audio YouTube...*' 
                            });
                            
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
                            
                            await sock.sendMessage(sender, {
                                audio: audioBuffer,
                                mimetype: 'audio/mpeg',
                                fileName: `${result.title.substring(0, 50).replace(/[^\w\s]/gi, '')}.mp3`
                            });
                            
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
                            
                            await sock.sendMessage(sender, { 
                                text: '⏳ *Mendownload video YouTube...*' 
                            });
                            
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
                            
                            await sock.sendMessage(sender, {
                                video: videoBuffer,
                                caption: `📹 ${result.title}`,
                                fileName: `${result.title.substring(0, 50).replace(/[^\w\s]/gi, '')}.mp4`
                            });
                            
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
                                `⏱️ Duration: ${result.duration}s`;
                            
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
                                `📁 Type: ${result.type.toUpperCase()}`;
                            
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
                        } catch (error) {
                            console.error('❌ Hidetag error:', error.message);
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
                        } catch (error) {
                            console.error('❌ Tagall error:', error.message);
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
                            `┃ 🤖 ${BOT_NAME} v2.0\n` +
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
                            const url = args[0];
                            if (!url.startsWith('http')) {
                                throw new Error('URL harus dimulai dengan http:// atau https://');
                            }
                            
                            const shortUrl = await createShortlink(url);
                            
                            await sock.sendMessage(sender, { 
                                text: `🔗 *SHORTLINK*\n\n🌐 Original: ${url}\n🔗 Short: ${shortUrl}` 
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
                            text: `💬 *QUOTES*\n\n${randomQuote}` 
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
                            text: `📜 *PANTUN*\n\n${randomPantun}` 
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
                            text: `📊 *RATING*\n\n🎯 Item: ${item}\n⭐ Rating: ${rating}/100\n${emoji}` 
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
                            text: `💑 *CEK JODOH*\n\n👤 Nama: ${name}\n💝 Kecocokan: ${compatibility}%\n📊 Status: ${statuses[statusIndex]}` 
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
                    
                    // TOIMG
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
                    
                    // AUTO STICKER
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
});

process.on('unhandledRejection', (err) => {
    console.error('💥 Unhandled Rejection:', err.message);
});

startBot();