// index.js - VERSION WITH ALL GAMES
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

const welcomeEnabled = new Map();

// Game States
const gameStates = {
    // Tebak Kata
    tebakKata: new Map(),
    tebakKataScores: new Map(),
    
    // Tebak Gambar
    tebakGambar: new Map(),
    tebakGambarScores: new Map(),
    
    // Quiz
    quizGames: new Map(),
    quizScores: new Map(),
    
    // Truth or Dare
    truthDare: new Map(),
    
    // Tebak Lagu
    tebakLagu: new Map(),
    tebakLaguScores: new Map(),
    
    // Tebak Bendera
    tebakBendera: new Map(),
    tebakBenderaScores: new Map(),
    
    // Tebak Emoji
    tebakEmoji: new Map(),
    tebakEmojiScores: new Map(),
    
    // Tebak Lirik
    tebakLirik: new Map(),
    tebakLirikScores: new Map(),
    
    // Math Battle
    mathBattle: new Map(),
    mathBattleScores: new Map(),
    
    // Suit
    suitGames: new Map(),
    suitScores: new Map(),
    
    // Tebak Angka
    tebakAngka: new Map(),
    tebakAngkaScores: new Map(),
    
    // RPG System
    rpgProfiles: new Map(),
    rpgInventory: new Map(),
    rpgCooldowns: new Map(),
    
    // Spin/Gacha
    spinGames: new Map(),
    
    // Pet Game
    petProfiles: new Map(),
    
    // Leaderboards
    globalLeaderboard: new Map(),
    groupLeaderboard: new Map(),
    
    // Coins System
    userCoins: new Map()
};

// Game Data
const gameData = {
    // Tebak Kata words
    kataWords: [
        { kata: "KOMPUTER", acak: "KOMPUTER", hint: "Alat elektronik untuk mengolah data" },
        { kata: "SMARTPHONE", acak: "SMARTPHONE", hint: "Telepon pintar" },
        { kata: "INDONESIA", acak: "INDONESIA", hint: "Negara kepulauan di Asia Tenggara" },
        { kata: "PROGRAMMER", acak: "PROGRAMMER", hint: "Pembuat aplikasi" },
        { kata: "INTERNET", acak: "INTERNET", hint: "Jaringan komputer global" },
        { kata: "TEKNOLOGI", acak: "TEKNOLOGI", hint: "Ilmu terapan" },
        { kata: "EDUCATION", acak: "EDUCATION", hint: "Pendidikan (bahasa Inggris)" },
        { kata: "SOFTWARE", acak: "SOFTWARE", hint: "Perangkat lunak" },
        { kata: "HARDWARE", acak: "HARDWARE", hint: "Perangkat keras" },
        { kata: "DATABASE", acak: "DATABASE", hint: "Basis data" }
    ],
    
    // Tebak Gambar (random images URLs)
    gambarData: [
        { url: "https://i.imgur.com/3A6Y7aB.jpeg", answer: "kucing", hint: "Hewan peliharaan" },
        { url: "https://i.imgur.com/5L8Y6Za.jpeg", answer: "mobil", hint: "Kendaraan roda empat" },
        { url: "https://i.imgur.com/7N9Y8Xb.jpeg", answer: "pohon", hint: "Tumbuhan besar" },
        { url: "https://i.imgur.com/2B3C4D5.jpeg", answer: "laptop", hint: "Komputer portabel" },
        { url: "https://i.imgur.com/9A0B1C2.jpeg", answer: "buku", hint: "Sumber ilmu" }
    ],
    
    // Quiz Questions
    quizQuestions: [
        {
            question: "Ibukota Indonesia adalah?",
            options: ["A. Jakarta", "B. Bandung", "C. Surabaya", "D. Medan"],
            answer: "A",
            point: 10
        },
        {
            question: "Planet terdekat dengan matahari?",
            options: ["A. Venus", "B. Merkurius", "C. Bumi", "D. Mars"],
            answer: "B",
            point: 15
        },
        {
            question: "2 + 2 x 2 = ?",
            options: ["A. 6", "B. 8", "C. 4", "D. 10"],
            answer: "A",
            point: 10
        },
        {
            question: "Warna bendera Indonesia?",
            options: ["A. Merah Putih", "B. Hijau Putih", "C. Merah Kuning", "D. Biru Putih"],
            answer: "A",
            point: 5
        },
        {
            question: "Hewan tercepat di dunia?",
            options: ["A. Singa", "B. Cheetah", "C. Elang", "D. Ikan Marlin"],
            answer: "B",
            point: 15
        }
    ],
    
    // Truth Questions
    truthQuestions: [
        "Apa rahasia terbesar yang kamu sembunyikan dari teman-teman?",
        "Kapan terakhir kali kamu menangis dan mengapa?",
        "Siapa orang yang paling kamu kagumi?",
        "Apa kebohongan terbesar yang pernah kamu katakan?",
        "Apa ketakutan terbesarmu?",
        "Jika kamu bisa bertukar hidup dengan seseorang selama sehari, siapa itu?",
        "Apa hal paling memalukan yang pernah terjadi padamu?",
        "Apa impian terbesarmu yang belum tercapai?"
    ],
    
    // Dare Challenges
    dareChallenges: [
        "Kirim suara kamu menyanyi lagu populer!",
        "Ganti foto profil WA selama 1 jam!",
        "Telepon teman terdekat dan bilang 'Aku sayang kamu'!",
        "Posting story dengan filter paling aneh!",
        "Kirim pesan 'Halo sayang' ke kontak ke-5 di HP!",
        "Rekam video sedang menari selama 15 detik!",
        "Kirim screenshot gallery terbaru ke grup!",
        "Ucapkan alfabet terbalik dengan suara!"
    ],
    
    // Tebak Lagu (song snippets info)
    songs: [
        { title: "Smooth Criminal", artist: "Michael Jackson", hint: "Lagu tentang kejahatan" },
        { title: "Bohemian Rhapsody", artist: "Queen", hint: "Lagu rock opera" },
        { title: "Shape of You", artist: "Ed Sheeran", hint: "Lagu pop tentang tubuh" },
        { title: "Dynamite", artist: "BTS", hint: "Lagu K-pop energik" },
        { title: "Bad Guy", artist: "Billie Eilish", hint: "Lagu dengan bass kuat" }
    ],
    
    // Bendera negara
    bendera: [
        { country: "Indonesia", emoji: "🇮🇩", clue: "Merah Putih" },
        { country: "Malaysia", emoji: "🇲🇾", clue: "Jalur Gemilang" },
        { country: "Singapore", emoji: "🇸🇬", clue: "Bulan sabit dan bintang" },
        { country: "Japan", emoji: "🇯🇵", clue: "Matahari terbit" },
        { country: "USA", emoji: "🇺🇸", clue: "Stars and Stripes" },
        { country: "UK", emoji: "🇬🇧", clue: "Union Jack" },
        { country: "France", emoji: "🇫🇷", clue: "Tricolore" },
        { country: "Germany", emoji: "🇩🇪", clue: "Hitam, Merah, Emas" },
        { country: "Brazil", emoji: "🇧🇷", clue: "Hijau dan Kuning" },
        { country: "Australia", emoji: "🇦🇺", clue: "Bintang dan Union Jack" }
    ],
    
    // Emoji tebak
    emojiPuzzles: [
        { emoji: "🍜🔥", answer: "mie pedas", hint: "Makanan pedas" },
        { emoji: "✈️🌍", answer: "perjalanan dunia", hint: "Terbang mengelilingi" },
        { emoji: "💻☕", answer: "ngoding sambil ngopi", hint: "Aktivitas programmer" },
        { emoji: "🌧️☔", answer: "hujan turun", hint: "Cuaca basah" },
        { emoji: "🎓💼", answer: "wisuda kerja", hint: "Lulus dan bekerja" },
        { emoji: "❤️💔", answer: "cinta patah", hint: "Hubungan putus" },
        { emoji: "🍕🎉", answer: "pesta pizza", hint: "Pesta dengan makanan" },
        { emoji: "🎮🏆", answer: "juara game", hint: "Menang kompetisi" }
    ],
    
    // Lirik lagu
    lirikLagu: [
        { line: "Kisah klasik untuk dunia", next: "Yang selalu terngiang di telinga" },
        { line: "Andai aku bisa terbang", next: "Aku kan datang bawa angin" },
        { line: "Menatap mentari pagi", next: "Menyinari hari yang baru" },
        { line: "Dalam diam aku berharap", next: "Semoga kau mengerti rasa" },
        { line: "Jalan ini panjang sekali", next: "Tapi aku takkan berhenti" }
    ],
    
    // Items untuk RPG
    shopItems: [
        { id: 1, name: "⚔️ Pedang Besi", price: 100, type: "weapon", power: 10 },
        { id: 2, name: "🛡️ Perisai Kayu", price: 80, type: "armor", defense: 8 },
        { id: 3, name: "❤️ Potion Kecil", price: 30, type: "potion", heal: 50 },
        { id: 4, name: "❤️ Potion Besar", price: 60, type: "potion", heal: 100 },
        { id: 5, name: "🍗 Ayam Goreng", price: 20, type: "food", stamina: 20 },
        { id: 6, name: "💎 Batu Ajaib", price: 200, type: "special", luck: 5 }
    ],
    
    // Gacha items
    gachaItems: [
        { name: "🪙 100 Koin", rarity: "common", value: 100 },
        { name: "🪙 500 Koin", rarity: "rare", value: 500 },
        { name: "💎 Batu Langka", rarity: "epic", value: 1000 },
        { name: "👑 Mahkota Emas", rarity: "legendary", value: 5000 },
        { name: "❤️ Potion Langka", rarity: "rare", value: 300 },
        { name: "🗡️ Pedang Legenda", rarity: "legendary", value: 3000 },
        { name: "🛡️ Perisai Suci", rarity: "epic", value: 1500 },
        { name: "📜 Gulungan Ajaib", rarity: "epic", value: 1200 }
    ],
    
    // Pet types
    petTypes: [
        { name: "🐉 Naga Kecil", type: "dragon", rarity: "legendary" },
        { name: "🐱 Kucing Ajaib", type: "cat", rarity: "common" },
        { name: "🐕 Anjing Setia", type: "dog", rarity: "common" },
        { name: "🦅 Elang Perkasa", type: "eagle", rarity: "rare" },
        { name: "🦊 Rubah Cerdik", type: "fox", rarity: "rare" },
        { name: "🐼 Panda Lucu", type: "panda", rarity: "epic" },
        { name: "🦁 Singa Muda", type: "lion", rarity: "epic" },
        { name: "🦄 Unicorn", type: "unicorn", rarity: "legendary" }
    ]
};

// Utility Functions
function scrambleWord(word) {
    const letters = word.split('');
    for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    return letters.join('');
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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

// Coin System Functions
function getCoins(userId) {
    return gameStates.userCoins.get(userId) || 0;
}

function addCoins(userId, amount) {
    const current = getCoins(userId);
    gameStates.userCoins.set(userId, current + amount);
    return current + amount;
}

function deductCoins(userId, amount) {
    const current = getCoins(userId);
    if (current >= amount) {
        gameStates.userCoins.set(userId, current - amount);
        return true;
    }
    return false;
}

// RPG System Functions
function getRPGProfile(userId) {
    if (!gameStates.rpgProfiles.has(userId)) {
        gameStates.rpgProfiles.set(userId, {
            level: 1,
            exp: 0,
            hp: 100,
            maxHp: 100,
            attack: 10,
            defense: 5,
            lastDaily: 0,
            lastWork: 0,
            lastHunt: 0
        });
    }
    return gameStates.rpgProfiles.get(userId);
}

function addExp(userId, expAmount) {
    const profile = getRPGProfile(userId);
    profile.exp += expAmount;
    
    // Level up
    const expNeeded = profile.level * 100;
    if (profile.exp >= expNeeded) {
        profile.level++;
        profile.exp = profile.exp - expNeeded;
        profile.maxHp += 20;
        profile.hp = profile.maxHp;
        profile.attack += 5;
        profile.defense += 3;
        return true;
    }
    return false;
}

function getInventory(userId) {
    if (!gameStates.rpgInventory.has(userId)) {
        gameStates.rpgInventory.set(userId, []);
    }
    return gameStates.rpgInventory.get(userId);
}

function addToInventory(userId, item) {
    const inventory = getInventory(userId);
    inventory.push(item);
    return inventory;
}

// Cooldown System
function checkCooldown(userId, type) {
    if (!gameStates.rpgCooldowns.has(userId)) {
        gameStates.rpgCooldowns.set(userId, {});
    }
    
    const cooldowns = gameStates.rpgCooldowns.get(userId);
    const now = Date.now();
    
    switch(type) {
        case 'daily':
            if (cooldowns.daily && now - cooldowns.daily < 24 * 60 * 60 * 1000) {
                const remaining = 24 * 60 * 60 * 1000 - (now - cooldowns.daily);
                return { onCooldown: true, remaining };
            }
            cooldowns.daily = now;
            return { onCooldown: false };
            
        case 'work':
            if (cooldowns.work && now - cooldowns.work < 5 * 60 * 1000) {
                const remaining = 5 * 60 * 1000 - (now - cooldowns.work);
                return { onCooldown: true, remaining };
            }
            cooldowns.work = now;
            return { onCooldown: false };
            
        case 'hunt':
            if (cooldowns.hunt && now - cooldowns.hunt < 10 * 60 * 1000) {
                const remaining = 10 * 60 * 1000 - (now - cooldowns.hunt);
                return { onCooldown: true, remaining };
            }
            cooldowns.hunt = now;
            return { onCooldown: false };
            
        case 'fight':
            if (cooldowns.fight && now - cooldowns.fight < 2 * 60 * 1000) {
                const remaining = 2 * 60 * 1000 - (now - cooldowns.fight);
                return { onCooldown: true, remaining };
            }
            cooldowns.fight = now;
            return { onCooldown: false };
    }
    
    return { onCooldown: false };
}

// Leaderboard Functions
function updateLeaderboard(userId, points, groupId = null) {
    // Global leaderboard
    const currentGlobal = gameStates.globalLeaderboard.get(userId) || 0;
    gameStates.globalLeaderboard.set(userId, currentGlobal + points);
    
    // Group leaderboard
    if (groupId) {
        if (!gameStates.groupLeaderboard.has(groupId)) {
            gameStates.groupLeaderboard.set(groupId, new Map());
        }
        const groupBoard = gameStates.groupLeaderboard.get(groupId);
        const currentGroup = groupBoard.get(userId) || 0;
        groupBoard.set(userId, currentGroup + points);
    }
}

function getGlobalLeaderboard(limit = 10) {
    const entries = Array.from(gameStates.globalLeaderboard.entries());
    entries.sort((a, b) => b[1] - a[1]);
    return entries.slice(0, limit);
}

function getGroupLeaderboard(groupId, limit = 10) {
    if (!gameStates.groupLeaderboard.has(groupId)) return [];
    const entries = Array.from(gameStates.groupLeaderboard.get(groupId).entries());
    entries.sort((a, b) => b[1] - a[1]);
    return entries.slice(0, limit);
}

// Game Functions
async function startTebakKata(sock, sender, pushName) {
    const wordData = gameData.kataWords[Math.floor(Math.random() * gameData.kataWords.length)];
    const scrambled = scrambleWord(wordData.kata);
    
    gameStates.tebakKata.set(sender, {
        answer: wordData.kata,
        scrambled: scrambled,
        hint: wordData.hint,
        attempts: 0,
        startTime: Date.now(),
        timer: setTimeout(() => {
            gameStates.tebakKata.delete(sender);
            sock.sendMessage(sender, { 
                text: `⏰ *WAKTU HABIS!*\n\nKata yang benar: ${wordData.kata}\n\nKetik .tebakkata untuk bermain lagi!` 
            });
        }, 30000) // 30 detik
    });
    
    const gameText = 
        '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
        '┃ 🎮 *TEBAK KATA* 🎮 ┃\n' +
        '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
        `Susun kata: *${scrambled}*\n\n` +
        `💡 Hint: ${wordData.hint}\n` +
        `⏰ Waktu: 30 detik\n` +
        `🎯 Kesempatan: 3x\n` +
        `💰 Hadiah: 50 koin\n\n` +
        '━━━━━━━━━━━━━━━━━━━━\n' +
        'Ketik jawabanmu sekarang!';
    
    await sock.sendMessage(sender, { text: gameText });
}

async function startTebakGambar(sock, sender, pushName) {
    const imageData = gameData.gambarData[Math.floor(Math.random() * gameData.gambarData.length)];
    
    gameStates.tebakGambar.set(sender, {
        answer: imageData.answer,
        hint: imageData.hint,
        attempts: 0,
        startTime: Date.now()
    });
    
    try {
        // Kirim gambar
        const response = await axios.get(imageData.url, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data);
        
        const gameText = 
            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
            '┃ 🖼️ *TEBAK GAMBAR* 🖼️ ┃\n' +
            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
            '❓ Apa yang ada di gambar ini?\n\n' +
            `💡 Hint: ${imageData.hint}\n` +
            `🎯 Kesempatan: 3x\n` +
            `💰 Hadiah: 75 koin\n\n` +
            '━━━━━━━━━━━━━━━━━━━━\n' +
            'Ketik jawabanmu sekarang!';
        
        await sock.sendMessage(sender, { 
            image: imageBuffer,
            caption: gameText
        });
    } catch (error) {
        await sock.sendMessage(sender, { 
            text: '❌ Gagal memuat gambar. Coba lagi nanti!' 
        });
    }
}

async function startQuiz(sock, sender, pushName) {
    const quiz = gameData.quizQuestions[Math.floor(Math.random() * gameData.quizQuestions.length)];
    
    gameStates.quizGames.set(sender, {
        ...quiz,
        startTime: Date.now(),
        answered: false
    });
    
    const gameText = 
        '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
        '┃ 🎯 *KUIS* 🎯 ┃\n' +
        '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
        `❓ ${quiz.question}\n\n` +
        `${quiz.options.join('\n')}\n\n` +
        `⏰ Waktu: 30 detik\n` +
        `💰 Hadiah: ${quiz.point} koin\n\n` +
        '━━━━━━━━━━━━━━━━━━━━\n' +
        'Jawab dengan huruf (A/B/C/D)';
    
    await sock.sendMessage(sender, { text: gameText });
}

async function startTebakBendera(sock, sender, pushName) {
    const bendera = gameData.bendera[Math.floor(Math.random() * gameData.bendera.length)];
    
    gameStates.tebakBendera.set(sender, {
        answer: bendera.country,
        emoji: bendera.emoji,
        clue: bendera.clue,
        attempts: 0,
        startTime: Date.now()
    });
    
    const gameText = 
        '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
        '┃ 🏳️ *TEBAK BENDERA* 🏳️ ┃\n' +
        '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
        `Bendera: ${bendera.emoji}\n\n` +
        `💡 Clue: ${bendera.clue}\n` +
        `🎯 Kesempatan: 3x\n` +
        `💰 Hadiah: 60 koin\n\n` +
        '━━━━━━━━━━━━━━━━━━━━\n' +
        'Negara apakah ini?';
    
    await sock.sendMessage(sender, { text: gameText });
}

async function startTebakEmoji(sock, sender, pushName) {
    const puzzle = gameData.emojiPuzzles[Math.floor(Math.random() * gameData.emojiPuzzles.length)];
    
    gameStates.tebakEmoji.set(sender, {
        answer: puzzle.answer,
        emoji: puzzle.emoji,
        hint: puzzle.hint,
        attempts: 0,
        startTime: Date.now()
    });
    
    const gameText = 
        '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
        '┃ 😀 *TEBAK EMOJI* 😀 ┃\n' +
        '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
        `Emoji: ${puzzle.emoji}\n\n` +
        `💡 Hint: ${puzzle.hint}\n` +
        `🎯 Kesempatan: 3x\n` +
        `💰 Hadiah: 40 koin\n\n` +
        '━━━━━━━━━━━━━━━━━━━━\n' +
        'Apa maksud dari emoji ini?';
    
    await sock.sendMessage(sender, { text: gameText });
}

async function startTebakLirik(sock, sender, pushName) {
    const lirik = gameData.lirikLagu[Math.floor(Math.random() * gameData.lirikLagu.length)];
    
    gameStates.tebakLirik.set(sender, {
        answer: lirik.next,
        line: lirik.line,
        attempts: 0,
        startTime: Date.now()
    });
    
    const gameText = 
        '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
        '┃ 🎵 *TEBAK LIRIK* 🎵 ┃\n' +
        '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
        `🎶 "${lirik.line}"\n\n` +
        'Sambung lirik berikutnya!\n\n' +
        `🎯 Kesempatan: 3x\n` +
        `💰 Hadiah: 55 koin\n\n` +
        '━━━━━━━━━━━━━━━━━━━━\n' +
        'Ketik lirik selanjutnya!';
    
    await sock.sendMessage(sender, { text: gameText });
}

async function startMathBattle(sock, sender, pushName) {
    const operations = ['+', '-', '*'];
    const op = operations[Math.floor(Math.random() * operations.length)];
    let num1, num2, answer;
    
    switch(op) {
        case '+':
            num1 = getRandomInt(10, 50);
            num2 = getRandomInt(10, 50);
            answer = num1 + num2;
            break;
        case '-':
            num1 = getRandomInt(50, 100);
            num2 = getRandomInt(10, 50);
            answer = num1 - num2;
            break;
        case '*':
            num1 = getRandomInt(2, 12);
            num2 = getRandomInt(2, 12);
            answer = num1 * num2;
            break;
    }
    
    gameStates.mathBattle.set(sender, {
        answer: answer,
        question: `${num1} ${op} ${num2}`,
        startTime: Date.now(),
        winner: null
    });
    
    const gameText = 
        '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
        '┃ 🧮 *MATH BATTLE* 🧮 ┃\n' +
        '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
        `Soal: ${num1} ${op} ${num2} = ?\n\n` +
        `⏰ Yang jawab duluan menang!\n` +
        `💰 Hadiah: 100 koin\n\n` +
        '━━━━━━━━━━━━━━━━━━━━\n' +
        'Cepat jawab!';
    
    await sock.sendMessage(sender, { text: gameText });
}

async function startTebakAngka(sock, sender, pushName) {
    const secretNumber = getRandomInt(1, 100);
    
    gameStates.tebakAngka.set(sender, {
        answer: secretNumber,
        attempts: 0,
        startTime: Date.now(),
        min: 1,
        max: 100
    });
    
    const gameText = 
        '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
        '┃ 🔢 *TEBAK ANGKA* 🔢 ┃\n' +
        '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
        'Saya memilih angka antara 1-100\n\n' +
        `💡 Saya akan kasih clue:\n` +
        `"Terlalu besar" / "Terlalu kecil"\n\n` +
        `🎯 Kesempatan: 10x\n` +
        `💰 Hadiah: 150 koin\n\n` +
        '━━━━━━━━━━━━━━━━━━━━\n' +
        'Tebak angkanya!';
    
    await sock.sendMessage(sender, { text: gameText });
}

async function startSuit(sock, sender, pushName) {
    gameStates.suitGames.set(sender, {
        waiting: true
    });
    
    const gameText = 
        '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
        '┃ ✂️ *SUIT* ✂️ ┃\n' +
        '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
        'Pilih salah satu:\n\n' +
        '`.suit batu` - 🪨\n' +
        '`.suit gunting` - ✂️\n' +
        '`.suit kertas` - 📄\n\n' +
        '━━━━━━━━━━━━━━━━━━━━\n' +
        'Lawan: Bot 🤖';
    
    await sock.sendMessage(sender, { text: gameText });
}

// Express Server
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
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
                <p>Bot dengan 15+ game siap dimainkan!</p>
                
                <div class="stats">
                    <div class="stat-item">
                        <h3>⏰ UPTIME</h3>
                        <p>${formatRuntime(Date.now() - BOT_START_TIME)}</p>
                    </div>
                    <div class="stat-item">
                        <h3>🎮 TOTAL GAMES</h3>
                        <p>15+ Games</p>
                    </div>
                    <div class="stat-item">
                        <h3>💰 COIN SYSTEM</h3>
                        <p>ACTIVE</p>
                    </div>
                    <div class="stat-item">
                        <h3>🏆 LEADERBOARD</h3>
                        <p>ACTIVE</p>
                    </div>
                    <div class="stat-item">
                        <h3>⚔️ RPG SYSTEM</h3>
                        <p>ACTIVE</p>
                    </div>
                    <div class="stat-item">
                        <h3>👥 GROUPS</h3>
                        <p>${welcomeEnabled.size}</p>
                    </div>
                </div>
                
                <div class="owner">👤 Owner: ${OWNER_NUMBER}</div>
                <div class="owner">💾 Database: MongoDB ✓</div>
                <div class="owner">🔄 Halaman ini akan refresh otomatis</div>
            </div>
        </body>
        </html>
    `);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        bot: BOT_NAME,
        owner: OWNER_NUMBER,
        uptime: formatRuntime(Date.now() - BOT_START_TIME),
        games_active: gameStates.tebakKata.size + gameStates.quizGames.size,
        rpg_users: gameStates.rpgProfiles.size,
        total_coins: Array.from(gameStates.userCoins.values()).reduce((a, b) => a + b, 0),
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
});

// Main Bot Function
async function startBot() {
    try {
        console.log('🚀 Starting WhatsApp Bot with 15+ Games...');
        
        const { state, saveCreds, clearData } = await useMongoAuthState();
        const { version } = await fetchLatestBaileysVersion();
        
        console.log(`📱 WhatsApp v${version.join('.')}`);
        console.log(`🤖 Bot: ${BOT_NAME}`);
        console.log(`👤 Owner: ${OWNER_NUMBER}`);
        console.log(`🎮 Total Games: 15+`);
        console.log(`💰 Coin System: Active`);
        console.log(`🏆 Leaderboard: Active`);
        console.log(`⚔️ RPG System: Active`);

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: true,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            msgRetryCounterCache,
            browser: Browsers.macOS('Desktop'),
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
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
                console.log('\n╔══════════════════════════════════════╗');
                console.log('║  ✅ ' + BOT_NAME + ' ONLINE!         ║');
                console.log('║  🎮 15+ Games Ready ✓                ║');
                console.log('║  💰 Coin System Active ✓             ║');
                console.log('║  🏆 Leaderboard Active ✓             ║');
                console.log('║  ⚔️ RPG System Active ✓              ║');
                console.log('║  👥 Group Tools Ready ✓              ║');
                console.log('║  👋 Welcome/Leave Active ✓           ║');
                console.log('║  💾 MongoDB Connected ✓              ║');
                console.log('╚══════════════════════════════════════╝\n');
                
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
                        '🎮 15+ Games Ready ✓\n' +
                        '💰 Coin System Active ✓\n' +
                        '🏆 Leaderboard Active ✓\n' +
                        '⚔️ RPG System Active ✓\n' +
                        '👥 Group Tools Ready ✓\n' +
                        '👋 Welcome/Leave Active ✓\n' +
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
                
                if (!id || !participants || !action || !id.endsWith('@g.us')) return;
                
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
                                '🎮 Ketik .games untuk melihat semua game\n' +
                                `💻 _${BOT_NAME}_`;
                            
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

        // Main message handler
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;
            
            for (const m of messages) {
                try {
                    if (!m.key || !m.key.remoteJid || m.key.remoteJid === 'status@broadcast') continue;
                    
                    const sender = m.key.remoteJid;
                    const pushName = m.pushName || 'User';
                    const isGroup = sender.endsWith('@g.us');
                    const userId = m.key.participant || sender;
                    const isOwner = userId === OWNER_JID;
                    
                    if (!m.message) continue;
                    
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
                    
                    // ==================== MENU & GAMES LIST ====================
                    if (command === '.menu' || command === '.games') {
                        const greeting = getGreeting();
                        const dateInfo = getFormattedDate();
                        const runtime = formatRuntime(Date.now() - BOT_START_TIME);
                        const coins = getCoins(userId);
                        
                        const menuText = 
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃  🎮 *' + BOT_NAME.toUpperCase() + '* 🎮  ┃\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            greeting + ', *' + pushName + '*! ✨\n' +
                            `💰 Koin: ${coins}\n\n` +
                            '📅 ' + dateInfo.full + '\n' +
                            '⏰ ' + dateInfo.time + '\n' +
                            '⏱️ Runtime: ' + runtime + '\n\n' +
                            
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃ 🎯 *WORD GAMES*\n' +
                            '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                            '┃ .tebakkata - Susun kata acak\n' +
                            '┃ .tebakemoji - Tebak arti emoji\n' +
                            '┃ .tebaklirik - Sambung lirik lagu\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃ 🖼️ *IMAGE GAMES*\n' +
                            '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                            '┃ .tebakgambar - Tebak gambar\n' +
                            '┃ .tebakbendera - Tebak bendera\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃ 🧠 *QUIZ & TRIVIA*\n' +
                            '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                            '┃ .quiz - Kuis pilihan ganda\n' +
                            '┃ .truth - Pertanyaan jujur\n' +
                            '┃ .dare - Tantangan seru\n' +
                            '┃ .mathbattle - Hitungan cepat\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃ 🎵 *MUSIC GAMES*\n' +
                            '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                            '┃ .tebaklagu - Tebak judul lagu\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃ 🎲 *CASUAL GAMES*\n' +
                            '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                            '┃ .suit - Batu gunting kertas\n' +
                            '┃ .tebakangka - Tebak angka 1-100\n' +
                            '┃ .spin - Spin gacha\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃ ⚔️ *RPG SYSTEM*\n' +
                            '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                            '┃ .profile - Profil RPG\n' +
                            '┃ .daily - Klaim harian\n' +
                            '┃ .work - Kerja dapet koin\n' +
                            '┃ .hunt - Berburu item\n' +
                            '┃ .fight @tag - PvP battle\n' +
                            '┃ .shop - Toko item\n' +
                            '┃ .inventory - Inventory\n' +
                            '┃ .adopt - Adopsi pet\n' +
                            '┃ .pet - Lihat pet\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃ 📊 *LEADERBOARD*\n' +
                            '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                            '┃ .topglobal - Top 10 global\n' +
                            '┃ .topgroup - Top 10 grup\n' +
                            '┃ .myrank - Rank kamu\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃ 🛠️ *TOOLS*\n' +
                            '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                            '┃ .ping - Test bot\n' +
                            '┃ .runtime - Uptime bot\n' +
                            '┃ .owner - Kontak owner\n' +
                            '┃ .resetsession (owner)\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            
                            '━━━━━━━━━━━━━━━━━━━━\n' +
                            '💡 Setiap game berikan koin!\n' +
                            '👤 Owner: wa.me/' + OWNER_NUMBER + '\n' +
                            '━━━━━━━━━━━━━━━━━━━━';
                        
                        await sock.sendMessage(sender, { text: menuText });
                        continue;
                    }
                    
                    // ==================== RESET SESSION (OWNER ONLY) ====================
                    if (command === '.resetsession' && isOwner) {
                        await sock.sendMessage(sender, { text: '🔄 *Mereset session MongoDB...*' });
                        await clearData();
                        await sock.sendMessage(sender, { 
                            text: '✅ Session dihapus dari MongoDB!\n\nBot akan restart dalam 5 detik...' 
                        });
                        setTimeout(() => process.exit(1), 5000);
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
                    
                    // ==================== GAME 1: TEBAK KATA ====================
                    if (command === '.tebakkata') {
                        await startTebakKata(sock, sender, pushName);
                        continue;
                    }
                    
                    // Check tebak kata answer
                    if (gameStates.tebakKata.has(sender)) {
                        const game = gameStates.tebakKata.get(sender);
                        const userAnswer = text.toUpperCase().trim();
                        
                        if (userAnswer === game.answer) {
                            clearTimeout(game.timer);
                            gameStates.tebakKata.delete(sender);
                            const coinsEarned = 50;
                            addCoins(userId, coinsEarned);
                            updateLeaderboard(userId, 10, isGroup ? sender : null);
                            
                            await sock.sendMessage(sender, { 
                                text: `✅ *BENAR!*\n\n🎉 Kamu menang!\n💰 +${coinsEarned} koin\n🏆 +10 poin leaderboard\n\nKata: ${game.answer}\nWaktu: ${Math.floor((Date.now() - game.startTime) / 1000)} detik` 
                            });
                        } else {
                            game.attempts++;
                            if (game.attempts >= 3) {
                                clearTimeout(game.timer);
                                gameStates.tebakKata.delete(sender);
                                await sock.sendMessage(sender, { 
                                    text: `💀 *GAME OVER!*\n\nKata yang benar: ${game.answer}\n\n💡 Ketik .tebakkata untuk bermain lagi` 
                                });
                            } else {
                                const hintMsg = game.attempts === 2 ? `💡 Hint: ${game.hint}\n` : '';
                                await sock.sendMessage(sender, { 
                                    text: `❌ *SALAH!*\n\n${hintMsg}Kesempatan tersisa: ${3 - game.attempts}` 
                                });
                            }
                        }
                        continue;
                    }
                    
                    // ==================== GAME 2: TEBAK GAMBAR ====================
                    if (command === '.tebakgambar') {
                        await startTebakGambar(sock, sender, pushName);
                        continue;
                    }
                    
                    // Check tebak gambar answer
                    if (gameStates.tebakGambar.has(sender)) {
                        const game = gameStates.tebakGambar.get(sender);
                        const userAnswer = text.toLowerCase().trim();
                        
                        if (userAnswer === game.answer) {
                            gameStates.tebakGambar.delete(sender);
                            const coinsEarned = 75;
                            addCoins(userId, coinsEarned);
                            updateLeaderboard(userId, 15, isGroup ? sender : null);
                            
                            await sock.sendMessage(sender, { 
                                text: `✅ *BENAR!*\n\n🎉 Kamu menang!\n💰 +${coinsEarned} koin\n🏆 +15 poin leaderboard\n\nJawaban: ${game.answer}` 
                            });
                        } else {
                            game.attempts++;
                            if (game.attempts >= 3) {
                                gameStates.tebakGambar.delete(sender);
                                await sock.sendMessage(sender, { 
                                    text: `💀 *GAME OVER!*\n\nJawaban yang benar: ${game.answer}\n\n💡 Ketik .tebakgambar untuk bermain lagi` 
                                });
                            } else {
                                await sock.sendMessage(sender, { 
                                    text: `❌ *SALAH!*\n\nKesempatan tersisa: ${3 - game.attempts}` 
                                });
                            }
                        }
                        continue;
                    }
                    
                    // ==================== GAME 3: QUIZ ====================
                    if (command === '.quiz' || command === '.kuis') {
                        await startQuiz(sock, sender, pushName);
                        continue;
                    }
                    
                    // Check quiz answer
                    if (gameStates.quizGames.has(sender)) {
                        const game = gameStates.quizGames.get(sender);
                        const userAnswer = text.toUpperCase().trim();
                        
                        if (userAnswer === game.answer) {
                            gameStates.quizGames.delete(sender);
                            addCoins(userId, game.point);
                            updateLeaderboard(userId, 5, isGroup ? sender : null);
                            
                            await sock.sendMessage(sender, { 
                                text: `✅ *BENAR!*\n\n🎉 Jawaban benar!\n💰 +${game.point} koin\n🏆 +5 poin leaderboard\n\n💡 Waktu: ${Math.floor((Date.now() - game.startTime) / 1000)} detik` 
                            });
                        } else {
                            gameStates.quizGames.delete(sender);
                            await sock.sendMessage(sender, { 
                                text: `❌ *SALAH!*\n\nJawaban yang benar: ${game.answer}\n\n💡 Ketik .quiz untuk bermain lagi` 
                            });
                        }
                        continue;
                    }
                    
                    // ==================== GAME 4: TRUTH OR DARE ====================
                    if (command === '.truth') {
                        const randomTruth = gameData.truthQuestions[Math.floor(Math.random() * gameData.truthQuestions.length)];
                        await sock.sendMessage(sender, { 
                            text: `🤫 *TRUTH*\n\n${randomTruth}\n\n━━━━━━━━━━━━━━━━━━━━\n💬 Jawab dengan jujur ya!` 
                        });
                        continue;
                    }
                    
                    if (command === '.dare') {
                        const randomDare = gameData.dareChallenges[Math.floor(Math.random() * gameData.dareChallenges.length)];
                        await sock.sendMessage(sender, { 
                            text: `😈 *DARE*\n\n${randomDare}\n\n━━━━━━━━━━━━━━━━━━━━\n⚡ Lakukan dalam 5 menit!` 
                        });
                        continue;
                    }
                    
                    // ==================== GAME 5: TEBAK LAGU ====================
                    if (command === '.tebaklagu') {
                        const song = gameData.songs[Math.floor(Math.random() * gameData.songs.length)];
                        
                        gameStates.tebakLagu.set(sender, {
                            answer: song.title.toLowerCase(),
                            artist: song.artist,
                            hint: song.hint,
                            attempts: 0,
                            hintGiven: false
                        });
                        
                        const gameText = 
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃ 🎵 *TEBAK LAGU* 🎵 ┃\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            '🎶 Dengarkan lagu ini!\n\n' +
                            `💡 Clue: ${song.artist}\n` +
                            `🎯 Kesempatan: 3x\n` +
                            `💰 Hadiah: 100 koin\n\n` +
                            '━━━━━━━━━━━━━━━━━━━━\n' +
                            'Tebak judul lagunya!\n\n' +
                            '💡 Ketik "hint" untuk bantuan';
                        
                        await sock.sendMessage(sender, { text: gameText });
                        continue;
                    }
                    
                    // Check tebak lagu answer
                    if (gameStates.tebakLagu.has(sender)) {
                        const game = gameStates.tebakLagu.get(sender);
                        
                        if (text.toLowerCase() === 'hint' && !game.hintGiven) {
                            game.hintGiven = true;
                            await sock.sendMessage(sender, { 
                                text: `💡 *HINT:* ${game.hint}\n\n🎯 Kesempatan tersisa: ${3 - game.attempts}` 
                            });
                            continue;
                        }
                        
                        const userAnswer = text.toLowerCase().trim();
                        
                        if (userAnswer === game.answer) {
                            gameStates.tebakLagu.delete(sender);
                            const coinsEarned = 100;
                            addCoins(userId, coinsEarned);
                            updateLeaderboard(userId, 20, isGroup ? sender : null);
                            
                            await sock.sendMessage(sender, { 
                                text: `✅ *BENAR!*\n\n🎉 Kamu menang!\n💰 +${coinsEarned} koin\n🏆 +20 poin leaderboard\n\nJudul: ${game.answer.toUpperCase()}\nArtis: ${game.artist}` 
                            });
                        } else {
                            game.attempts++;
                            if (game.attempts >= 3) {
                                gameStates.tebakLagu.delete(sender);
                                await sock.sendMessage(sender, { 
                                    text: `💀 *GAME OVER!*\n\nJudul yang benar: ${game.answer.toUpperCase()}\nArtis: ${game.artist}\n\n💡 Ketik .tebaklagu untuk bermain lagi` 
                                });
                            } else {
                                await sock.sendMessage(sender, { 
                                    text: `❌ *SALAH!*\n\nKesempatan tersisa: ${3 - game.attempts}` 
                                });
                            }
                        }
                        continue;
                    }
                    
                    // ==================== GAME 6: TEBAK BENDERA ====================
                    if (command === '.tebakbendera') {
                        await startTebakBendera(sock, sender, pushName);
                        continue;
                    }
                    
                    // Check tebak bendera answer
                    if (gameStates.tebakBendera.has(sender)) {
                        const game = gameStates.tebakBendera.get(sender);
                        const userAnswer = text.toLowerCase().trim();
                        
                        if (userAnswer === game.answer.toLowerCase()) {
                            gameStates.tebakBendera.delete(sender);
                            const coinsEarned = 60;
                            addCoins(userId, coinsEarned);
                            updateLeaderboard(userId, 12, isGroup ? sender : null);
                            
                            await sock.sendMessage(sender, { 
                                text: `✅ *BENAR!*\n\n🎉 Kamu menang!\n💰 +${coinsEarned} koin\n🏆 +12 poin leaderboard\n\nNegara: ${game.answer}\nBendera: ${game.emoji}` 
                            });
                        } else {
                            game.attempts++;
                            if (game.attempts >= 3) {
                                gameStates.tebakBendera.delete(sender);
                                await sock.sendMessage(sender, { 
                                    text: `💀 *GAME OVER!*\n\nNegara yang benar: ${game.answer}\nBendera: ${game.emoji}\n\n💡 Ketik .tebakbendera untuk bermain lagi` 
                                });
                            } else {
                                await sock.sendMessage(sender, { 
                                    text: `❌ *SALAH!*\n\nKesempatan tersisa: ${3 - game.attempts}` 
                                });
                            }
                        }
                        continue;
                    }
                    
                    // ==================== GAME 7: TEBAK EMOJI ====================
                    if (command === '.tebakemoji') {
                        await startTebakEmoji(sock, sender, pushName);
                        continue;
                    }
                    
                    // Check tebak emoji answer
                    if (gameStates.tebakEmoji.has(sender)) {
                        const game = gameStates.tebakEmoji.get(sender);
                        const userAnswer = text.toLowerCase().trim();
                        
                        if (userAnswer === game.answer) {
                            gameStates.tebakEmoji.delete(sender);
                            const coinsEarned = 40;
                            addCoins(userId, coinsEarned);
                            updateLeaderboard(userId, 8, isGroup ? sender : null);
                            
                            await sock.sendMessage(sender, { 
                                text: `✅ *BENAR!*\n\n🎉 Kamu menang!\n💰 +${coinsEarned} koin\n🏆 +8 poin leaderboard\n\nEmoji: ${game.emoji}\nArti: ${game.answer}` 
                            });
                        } else {
                            game.attempts++;
                            if (game.attempts >= 3) {
                                gameStates.tebakEmoji.delete(sender);
                                await sock.sendMessage(sender, { 
                                    text: `💀 *GAME OVER!*\n\nArti yang benar: ${game.answer}\n\n💡 Ketik .tebakemoji untuk bermain lagi` 
                                });
                            } else {
                                await sock.sendMessage(sender, { 
                                    text: `❌ *SALAH!*\n\nKesempatan tersisa: ${3 - game.attempts}` 
                                });
                            }
                        }
                        continue;
                    }
                    
                    // ==================== GAME 8: TEBAK LIRIK ====================
                    if (command === '.tebaklirik') {
                        await startTebakLirik(sock, sender, pushName);
                        continue;
                    }
                    
                    // Check tebak lirik answer
                    if (gameStates.tebakLirik.has(sender)) {
                        const game = gameStates.tebakLirik.get(sender);
                        const userAnswer = text.toLowerCase().trim();
                        
                        if (userAnswer === game.answer.toLowerCase()) {
                            gameStates.tebakLirik.delete(sender);
                            const coinsEarned = 55;
                            addCoins(userId, coinsEarned);
                            updateLeaderboard(userId, 11, isGroup ? sender : null);
                            
                            await sock.sendMessage(sender, { 
                                text: `✅ *BENAR!*\n\n🎉 Kamu menang!\n💰 +${coinsEarned} koin\n🏆 +11 poin leaderboard\n\nLirik lengkap:\n"${game.line}"\n"${game.answer}"` 
                            });
                        } else {
                            game.attempts++;
                            if (game.attempts >= 3) {
                                gameStates.tebakLirik.delete(sender);
                                await sock.sendMessage(sender, { 
                                    text: `💀 *GAME OVER!*\n\nLirik yang benar:\n"${game.line}"\n"${game.answer}"\n\n💡 Ketik .tebaklirik untuk bermain lagi` 
                                });
                            } else {
                                await sock.sendMessage(sender, { 
                                    text: `❌ *SALAH!*\n\nKesempatan tersisa: ${3 - game.attempts}` 
                                });
                            }
                        }
                        continue;
                    }
                    
                    // ==================== GAME 9: MATH BATTLE ====================
                    if (command === '.mathbattle') {
                        await startMathBattle(sock, sender, pushName);
                        continue;
                    }
                    
                    // Check math battle answer
                    if (gameStates.mathBattle.has(sender)) {
                        const game = gameStates.mathBattle.get(sender);
                        const userAnswer = parseInt(text.trim());
                        
                        if (!isNaN(userAnswer) && userAnswer === game.answer) {
                            if (!game.winner) {
                                game.winner = userId;
                                gameStates.mathBattle.delete(sender);
                                const coinsEarned = 100;
                                addCoins(userId, coinsEarned);
                                updateLeaderboard(userId, 25, isGroup ? sender : null);
                                
                                await sock.sendMessage(sender, { 
                                    text: `⚡ *PERTAMA BENAR!*\n\n🎉 ${pushName} menang!\n💰 +${coinsEarned} koin\n🏆 +25 poin leaderboard\n\nSoal: ${game.question} = ${game.answer}\nWaktu: ${Math.floor((Date.now() - game.startTime) / 1000)} detik` 
                                });
                            }
                        }
                        continue;
                    }
                    
                    // ==================== GAME 10: SUIT ====================
                    if (command.startsWith('.suit')) {
                        if (command === '.suit') {
                            await startSuit(sock, sender, pushName);
                            continue;
                        }
                        
                        const choice = args[0]?.toLowerCase();
                        const choices = ['batu', 'gunting', 'kertas'];
                        
                        if (!choices.includes(choice)) {
                            await sock.sendMessage(sender, { 
                                text: '❌ Pilihan tidak valid!\n\nGunakan: .suit batu/gunting/kertas' 
                            });
                            continue;
                        }
                        
                        if (!gameStates.suitGames.has(sender)) {
                            await startSuit(sock, sender, pushName);
                            continue;
                        }
                        
                        const botChoice = choices[Math.floor(Math.random() * 3)];
                        let result = '';
                        let coinsEarned = 0;
                        
                        // Determine winner
                        if (choice === botChoice) {
                            result = '🤝 *SERI!*';
                            coinsEarned = 10;
                        } else if (
                            (choice === 'batu' && botChoice === 'gunting') ||
                            (choice === 'gunting' && botChoice === 'kertas') ||
                            (choice === 'kertas' && botChoice === 'batu')
                        ) {
                            result = '🎉 *KAMU MENANG!*';
                            coinsEarned = 50;
                        } else {
                            result = '😢 *BOT MENANG!*';
                            coinsEarned = 5;
                        }
                        
                        addCoins(userId, coinsEarned);
                        gameStates.suitGames.delete(sender);
                        
                        const emojiMap = { batu: '🪨', gunting: '✂️', kertas: '📄' };
                        
                        await sock.sendMessage(sender, { 
                            text: `✂️ *HASIL SUIT*\n\n` +
                                  `Kamu: ${emojiMap[choice]} (${choice})\n` +
                                  `Bot: ${emojiMap[botChoice]} (${botChoice})\n\n` +
                                  `${result}\n` +
                                  `💰 +${coinsEarned} koin\n\n` +
                                  `💡 Ketik .suit untuk main lagi` 
                        });
                        continue;
                    }
                    
                    // ==================== GAME 11: TEBAK ANGKA ====================
                    if (command === '.tebakangka') {
                        await startTebakAngka(sock, sender, pushName);
                        continue;
                    }
                    
                    // Check tebak angka answer
                    if (gameStates.tebakAngka.has(sender)) {
                        const game = gameStates.tebakAngka.get(sender);
                        const userAnswer = parseInt(text.trim());
                        
                        if (isNaN(userAnswer)) {
                            await sock.sendMessage(sender, { 
                                text: '❌ Masukkan angka yang valid!' 
                            });
                            continue;
                        }
                        
                        game.attempts++;
                        
                        if (userAnswer === game.answer) {
                            gameStates.tebakAngka.delete(sender);
                            const coinsEarned = 150;
                            addCoins(userId, coinsEarned);
                            updateLeaderboard(userId, 30, isGroup ? sender : null);
                            
                            await sock.sendMessage(sender, { 
                                text: `🎉 *BENAR!*\n\nAngka: ${game.answer}\nTebakan: ${game.attempts}x\n💰 +${coinsEarned} koin\n🏆 +30 poin leaderboard\n\nKamu jenius! 🧠` 
                            });
                        } else if (game.attempts >= 10) {
                            gameStates.tebakAngka.delete(sender);
                            await sock.sendMessage(sender, { 
                                text: `💀 *GAME OVER!*\n\nAngka yang benar: ${game.answer}\n\n💡 Ketik .tebakangka untuk bermain lagi` 
                            });
                        } else {
                            let clue = '';
                            if (userAnswer < game.answer) {
                                clue = '📈 Terlalu kecil!';
                                game.min = Math.max(game.min, userAnswer + 1);
                            } else {
                                clue = '📉 Terlalu besar!';
                                game.max = Math.min(game.max, userAnswer - 1);
                            }
                            
                            await sock.sendMessage(sender, { 
                                text: `❌ ${clue}\n\nRange: ${game.min}-${game.max}\nTebakan: ${game.attempts}/10\n\nCoba lagi!` 
                            });
                        }
                        continue;
                    }
                    
                    // ==================== RPG SYSTEM ====================
                    
                    // PROFILE
                    if (command === '.profile') {
                        const profile = getRPGProfile(userId);
                        const coins = getCoins(userId);
                        const inventory = getInventory(userId);
                        
                        const profileText = 
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃ ⚔️ *PROFIL RPG* ⚔️ ┃\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            `👤 Nama: ${pushName}\n` +
                            `⭐ Level: ${profile.level}\n` +
                            `📈 EXP: ${profile.exp}/${profile.level * 100}\n` +
                            `❤️ HP: ${profile.hp}/${profile.maxHp}\n` +
                            `⚔️ Attack: ${profile.attack}\n` +
                            `🛡️ Defense: ${profile.defense}\n` +
                            `💰 Koin: ${coins}\n\n` +
                            '📦 Inventory:\n' +
                            (inventory.length > 0 ? inventory.map(i => `- ${i}`).join('\n') : 'Kosong') +
                            '\n\n━━━━━━━━━━━━━━━━━━━━\n' +
                            '💡 Gunakan .daily untuk klaim hadiah harian!';
                        
                        await sock.sendMessage(sender, { text: profileText });
                        continue;
                    }
                    
                    // DAILY
                    if (command === '.daily') {
                        const cooldown = checkCooldown(userId, 'daily');
                        
                        if (cooldown.onCooldown) {
                            const hours = Math.floor(cooldown.remaining / (60 * 60 * 1000));
                            const minutes = Math.floor((cooldown.remaining % (60 * 60 * 1000)) / (60 * 1000));
                            
                            await sock.sendMessage(sender, { 
                                text: `⏳ *COOLDOWN!*\n\nKamu bisa klaim daily lagi dalam:\n${hours} jam ${minutes} menit` 
                            });
                            continue;
                        }
                        
                        const coinsEarned = 500 + profile.level * 50;
                        addCoins(userId, coinsEarned);
                        
                        await sock.sendMessage(sender, { 
                            text: `🎁 *DAILY REWARD!*\n\n💰 +${coinsEarned} koin\n\n━━━━━━━━━━━━━━━━━━━━\nKembali besok untuk hadiah lebih besar!` 
                        });
                        continue;
                    }
                    
                    // WORK
                    if (command === '.work') {
                        const cooldown = checkCooldown(userId, 'work');
                        
                        if (cooldown.onCooldown) {
                            const minutes = Math.floor(cooldown.remaining / (60 * 1000));
                            
                            await sock.sendMessage(sender, { 
                                text: `⏳ *COOLDOWN!*\n\nKamu bisa kerja lagi dalam:\n${minutes} menit` 
                            });
                            continue;
                        }
                        
                        const jobs = [
                            { name: "👨‍💻 Programmer", min: 100, max: 300 },
                            { name: "👷 Buruh", min: 50, max: 150 },
                            { name: "👨‍🍳 Koki", min: 80, max: 200 },
                            { name: "👨‍🏫 Guru", min: 120, max: 250 },
                            { name: "👨‍🔧 Teknisi", min: 90, max: 180 }
                        ];
                        
                        const job = jobs[Math.floor(Math.random() * jobs.length)];
                        const coinsEarned = getRandomInt(job.min, job.max);
                        addCoins(userId, coinsEarned);
                        
                        await sock.sendMessage(sender, { 
                            text: `💼 *BEKERJA*\n\nPekerjaan: ${job.name}\n💰 +${coinsEarned} koin\n\n━━━━━━━━━━━━━━━━━━━━\nKembali bekerja dalam 5 menit!` 
                        });
                        continue;
                    }
                    
                    // HUNT
                    if (command === '.hunt') {
                        const cooldown = checkCooldown(userId, 'hunt');
                        
                        if (cooldown.onCooldown) {
                            const minutes = Math.floor(cooldown.remaining / (60 * 1000));
                            
                            await sock.sendMessage(sender, { 
                                text: `⏳ *COOLDOWN!*\n\nKamu bisa berburu lagi dalam:\n${minutes} menit` 
                            });
                            continue;
                        }
                        
                        const hunts = [
                            { item: "🐰 Kelinci", coins: 50, exp: 10 },
                            { item: "🦌 Rusa", coins: 100, exp: 20 },
                            { item: "🐗 Babi Hutan", coins: 150, exp: 30 },
                            { item: "🐻 Beruang", coins: 200, exp: 40 },
                            { item: "🐉 Naga Kecil", coins: 500, exp: 100 }
                        ];
                        
                        const hunt = hunts[Math.floor(Math.random() * hunts.length)];
                        const coinsEarned = hunt.coins;
                        const expEarned = hunt.exp;
                        
                        addCoins(userId, coinsEarned);
                        const leveledUp = addExp(userId, expEarned);
                        
                        let levelUpText = '';
                        if (leveledUp) {
                            const profile = getRPGProfile(userId);
                            levelUpText = `\n🎉 *LEVEL UP!* Sekarang level ${profile.level}`;
                        }
                        
                        await sock.sendMessage(sender, { 
                            text: `🏹 *BERBURU*\n\nKamu berhasil menangkap: ${hunt.item}\n💰 +${coinsEarned} koin\n⭐ +${expEarned} EXP${levelUpText}\n\n━━━━━━━━━━━━━━━━━━━━\nKembali berburu dalam 10 menit!` 
                        });
                        continue;
                    }
                    
                    // SHOP
                    if (command === '.shop') {
                        const shopText = 
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃ 🛒 *TOKO ITEM* 🛒 ┃\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            'Gunakan: .beli [nomor]\n\n' +
                            gameData.shopItems.map(item => 
                                `${item.id}. ${item.name} - 💰 ${item.price} koin`
                            ).join('\n') +
                            '\n\n━━━━━━━━━━━━━━━━━━━━\n' +
                            '💡 Contoh: .beli 1';
                        
                        await sock.sendMessage(sender, { text: shopText });
                        continue;
                    }
                    
                    // BELI ITEM
                    if (command === '.beli' && args[0]) {
                        const itemId = parseInt(args[0]);
                        const item = gameData.shopItems.find(i => i.id === itemId);
                        
                        if (!item) {
                            await sock.sendMessage(sender, { 
                                text: '❌ Item tidak ditemukan!' 
                            });
                            continue;
                        }
                        
                        const coins = getCoins(userId);
                        
                        if (coins < item.price) {
                            await sock.sendMessage(sender, { 
                                text: `❌ Koin tidak cukup!\n\nKoin kamu: ${coins}\nHarga: ${item.price}` 
                            });
                            continue;
                        }
                        
                        deductCoins(userId, item.price);
                        addToInventory(userId, item.name);
                        
                        await sock.sendMessage(sender, { 
                            text: `✅ *PEMBELIAN BERHASIL!*\n\nItem: ${item.name}\n💰 -${item.price} koin\n\n📦 Item telah ditambahkan ke inventory!` 
                        });
                        continue;
                    }
                    
                    // INVENTORY
                    if (command === '.inventory' || command === '.inv') {
                        const inventory = getInventory(userId);
                        
                        const invText = 
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃ 📦 *INVENTORY* 📦 ┃\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            `Total item: ${inventory.length}\n\n` +
                            (inventory.length > 0 ? 
                                inventory.map((item, idx) => `${idx + 1}. ${item}`).join('\n') : 
                                'Inventory kosong') +
                            '\n\n━━━━━━━━━━━━━━━━━━━━\n' +
                            '💡 Kunjungi .shop untuk beli item!';
                        
                        await sock.sendMessage(sender, { text: invText });
                        continue;
                    }
                    
                    // ==================== SPIN/GACHA ====================
                    if (command === '.spin' || command === '.gacha') {
                        const spinCost = 100;
                        const coins = getCoins(userId);
                        
                        if (coins < spinCost) {
                            await sock.sendMessage(sender, { 
                                text: `❌ Koin tidak cukup!\n\nKoin kamu: ${coins}\nBiaya spin: ${spinCost}` 
                            });
                            continue;
                        }
                        
                        deductCoins(userId, spinCost);
                        
                        // Animated spin effect
                        await sock.sendMessage(sender, { text: '🎰 *SPINNING...*' });
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        const items = gameData.gachaItems;
                        const weights = {
                            'common': 40,
                            'rare': 30,
                            'epic': 20,
                            'legendary': 10
                        };
                        
                        const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
                        let random = Math.random() * totalWeight;
                        let selectedRarity = '';
                        
                        for (const [rarity, weight] of Object.entries(weights)) {
                            random -= weight;
                            if (random <= 0) {
                                selectedRarity = rarity;
                                break;
                            }
                        }
                        
                        const rareItems = items.filter(item => item.rarity === selectedRarity);
                        const wonItem = rareItems[Math.floor(Math.random() * rareItems.length)];
                        
                        let rewardText = '';
                        if (wonItem.value) {
                            addCoins(userId, wonItem.value);
                            rewardText = `💰 +${wonItem.value} koin`;
                        } else {
                            addToInventory(userId, wonItem.name);
                            rewardText = `📦 ${wonItem.name}`;
                        }
                        
                        const rarityEmoji = {
                            'common': '⚪',
                            'rare': '🔵',
                            'epic': '🟣',
                            'legendary': '🟡'
                        };
                        
                        await sock.sendMessage(sender, { 
                            text: `🎰 *SPIN RESULT!*\n\n` +
                                  `${rarityEmoji[selectedRarity]} *${selectedRarity.toUpperCase()}* ${rarityEmoji[selectedRarity]}\n\n` +
                                  `🎁 Hadiah: ${wonItem.name}\n` +
                                  `${rewardText}\n\n` +
                                  `━━━━━━━━━━━━━━━━━━━━\n` +
                                  `💡 Spin lagi? .spin` 
                        });
                        continue;
                    }
                    
                    // ==================== PET GAME ====================
                    if (command === '.adopt') {
                        if (gameStates.petProfiles.has(userId)) {
                            await sock.sendMessage(sender, { 
                                text: '❌ Kamu sudah punya pet!\n\nGunakan .pet untuk melihat pet-mu' 
                            });
                            continue;
                        }
                        
                        const adoptCost = 1000;
                        const coins = getCoins(userId);
                        
                        if (coins < adoptCost) {
                            await sock.sendMessage(sender, { 
                                text: `❌ Koin tidak cukup!\n\nKoin kamu: ${coins}\nBiaya adopt: ${adoptCost}` 
                            });
                            continue;
                        }
                        
                        deductCoins(userId, adoptCost);
                        const pet = gameData.petTypes[Math.floor(Math.random() * gameData.petTypes.length)];
                        
                        gameStates.petProfiles.set(userId, {
                            name: pet.name,
                            type: pet.type,
                            level: 1,
                            exp: 0,
                            happiness: 100,
                            lastFed: Date.now(),
                            lastTrained: 0
                        });
                        
                        await sock.sendMessage(sender, { 
                            text: `🐾 *ADOPT SUKSES!*\n\nKamu mengadopsi: ${pet.name}\n💰 -${adoptCost} koin\n\n💡 Rawat pet-mu dengan:\n.feed - Kasih makan\n.train - Latih pet\n.pet - Lihat status pet` 
                        });
                        continue;
                    }
                    
                    if (command === '.pet') {
                        if (!gameStates.petProfiles.has(userId)) {
                            await sock.sendMessage(sender, { 
                                text: '❌ Kamu belum punya pet!\n\nGunakan .adopt untuk mengadopsi pet' 
                            });
                            continue;
                        }
                        
                        const pet = gameStates.petProfiles.get(userId);
                        const hoursSinceFed = Math.floor((Date.now() - pet.lastFed) / (60 * 60 * 1000));
                        
                        if (hoursSinceFed > 24) {
                            pet.happiness = Math.max(0, pet.happiness - 20);
                        }
                        
                        const petText = 
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃ 🐾 *PET PROFILE* 🐾 ┃\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            `Nama: ${pet.name}\n` +
                            `Tipe: ${pet.type}\n` +
                            `⭐ Level: ${pet.level}\n` +
                            `📈 EXP: ${pet.exp}/${pet.level * 100}\n` +
                            `😊 Happiness: ${pet.happiness}/100\n\n` +
                            '━━━━━━━━━━━━━━━━━━━━\n' +
                            '💡 Perintah:\n' +
                            '.feed - Kasih makan (+10 happiness)\n' +
                            '.train - Latih (+20 EXP)\n\n' +
                            `⏰ Terakhir makan: ${hoursSinceFed} jam lalu`;
                        
                        await sock.sendMessage(sender, { text: petText });
                        continue;
                    }
                    
                    if (command === '.feed') {
                        if (!gameStates.petProfiles.has(userId)) {
                            await sock.sendMessage(sender, { 
                                text: '❌ Kamu belum punya pet!' 
                            });
                            continue;
                        }
                        
                        const pet = gameStates.petProfiles.get(userId);
                        pet.lastFed = Date.now();
                        pet.happiness = Math.min(100, pet.happiness + 10);
                        
                        await sock.sendMessage(sender, { 
                            text: `🍗 *FEED PET*\n\n${pet.name} sudah diberi makan!\n😊 Happiness: +10\n\n💡 Happiness sekarang: ${pet.happiness}/100` 
                        });
                        continue;
                    }
                    
                    if (command === '.train') {
                        if (!gameStates.petProfiles.has(userId)) {
                            await sock.sendMessage(sender, { 
                                text: '❌ Kamu belum punya pet!' 
                            });
                            continue;
                        }
                        
                        const pet = gameStates.petProfiles.get(userId);
                        const cooldown = 30 * 60 * 1000; // 30 menit
                        
                        if (Date.now() - pet.lastTrained < cooldown) {
                            const minutesLeft = Math.ceil((cooldown - (Date.now() - pet.lastTrained)) / (60 * 1000));
                            await sock.sendMessage(sender, { 
                                text: `⏳ *COOLDOWN!*\n\nKamu bisa latih lagi dalam ${minutesLeft} menit` 
                            });
                            continue;
                        }
                        
                        pet.lastTrained = Date.now();
                        pet.exp += 20;
                        
                        if (pet.exp >= pet.level * 100) {
                            pet.level++;
                            pet.exp = 0;
                            await sock.sendMessage(sender, { 
                                text: `🏋️ *TRAIN PET*\n\n${pet.name} berhasil dilatih!\n⭐ EXP: +20\n🎉 *LEVEL UP!* Sekarang level ${pet.level}` 
                            });
                        } else {
                            await sock.sendMessage(sender, { 
                                text: `🏋️ *TRAIN PET*\n\n${pet.name} berhasil dilatih!\n⭐ EXP: +20\n📈 EXP total: ${pet.exp}/${pet.level * 100}` 
                            });
                        }
                        continue;
                    }
                    
                    // ==================== LEADERBOARD ====================
                    if (command === '.topglobal') {
                        const top = getGlobalLeaderboard(10);
                        
                        let leaderboardText = '┏━━━━━━━━━━━━━━━━━━━━┓\n';
                        leaderboardText += '┃ 🏆 *TOP GLOBAL* 🏆 ┃\n';
                        leaderboardText += '┗━━━━━━━━━━━━━━━━━━━━┛\n\n';
                        
                        if (top.length === 0) {
                            leaderboardText += 'Belum ada data leaderboard\n';
                        } else {
                            top.forEach(([userId, points], index) => {
                                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                                leaderboardText += `${medal} ${userId.split('@')[0]} - ${points} poin\n`;
                            });
                        }
                        
                        leaderboardText += '\n━━━━━━━━━━━━━━━━━━━━\n';
                        leaderboardText += '💡 Main game untuk naik rank!';
                        
                        await sock.sendMessage(sender, { text: leaderboardText });
                        continue;
                    }
                    
                    if (command === '.topgroup' && isGroup) {
                        const top = getGroupLeaderboard(sender, 10);
                        
                        let leaderboardText = '┏━━━━━━━━━━━━━━━━━━━━┓\n';
                        leaderboardText += '┃ 🏆 *TOP GROUP* 🏆 ┃\n';
                        leaderboardText += '┗━━━━━━━━━━━━━━━━━━━━┛\n\n';
                        
                        if (top.length === 0) {
                            leaderboardText += 'Belum ada data leaderboard\n';
                        } else {
                            top.forEach(([userId, points], index) => {
                                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                                leaderboardText += `${medal} @${userId.split('@')[0]} - ${points} poin\n`;
                            });
                        }
                        
                        leaderboardText += '\n━━━━━━━━━━━━━━━━━━━━\n';
                        leaderboardText += '💡 Main game di grup ini untuk naik rank!';
                        
                        await sock.sendMessage(sender, { text: leaderboardText });
                        continue;
                    }
                    
                    if (command === '.myrank') {
                        const globalRank = Array.from(gameStates.globalLeaderboard.entries())
                            .sort((a, b) => b[1] - a[1])
                            .findIndex(([id]) => id === userId) + 1;
                        
                        const coins = getCoins(userId);
                        
                        let rankText = '┏━━━━━━━━━━━━━━━━━━━━┓\n';
                        rankText += '┃ 📊 *MY RANK* 📊 ┃\n';
                        rankText += '┗━━━━━━━━━━━━━━━━━━━━┛\n\n';
                        
                        rankText += `👤 ${pushName}\n`;
                        rankText += `💰 Koin: ${coins}\n`;
                        rankText += `🌐 Global Rank: ${globalRank > 0 ? `#${globalRank}` : 'Belum ada rank'}\n`;
                        
                        if (isGroup) {
                            const groupRank = getGroupLeaderboard(sender)
                                .findIndex(([id]) => id === userId) + 1;
                            rankText += `👥 Group Rank: ${groupRank > 0 ? `#${groupRank}` : 'Belum ada rank'}\n`;
                        }
                        
                        rankText += '\n━━━━━━━━━━━━━━━━━━━━\n';
                        rankText += '💡 Main game untuk naik rank!';
                        
                        await sock.sendMessage(sender, { text: rankText });
                        continue;
                    }
                    
                    // ==================== TOOLS ====================
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
                    
                    if (command === '.runtime') {
                        const runtimeText = 
                            '┏━━━━━━━━━━━━━━━━┓\n' +
                            '┃ ⏰ *RUNTIME*\n' +
                            '┣━━━━━━━━━━━━━━━━┫\n' +
                            `┃ 🤖 ${BOT_NAME}\n` +
                            `┃ ⏱️ ${formatRuntime(Date.now() - BOT_START_TIME)}\n` +
                            `┃ 📅 ${new Date(BOT_START_TIME).toLocaleString('id-ID')}\n` +
                            `┃ 🎮 Games: 15+\n` +
                            `┃ 💰 Coin System: Active\n` +
                            '┗━━━━━━━━━━━━━━━━┛';
                        
                        await sock.sendMessage(sender, { text: runtimeText });
                        continue;
                    }
                    
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