// index.js - VERSION WITH DYNAMIC GAMES FROM WEB API
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
const BOT_NAME = process.env.BOT_NAME || 'Jonkris-Bot';
const OWNER_NUMBER = process.env.OWNER_NUMBER || '6289509158681';
const OWNER_JID = process.env.OWNER_JID || '103066632216677@lid';

// 🔥 GAME API CONFIGURATION
const GAME_API_BASE = process.env.GAME_API_BASE || 'https://game-api.botcreator.id/api';
const GAME_API_KEY = process.env.GAME_API_KEY || 'demo_key_2024';

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
    
    // Werewolf Game
    werewolfGames: new Map(),
    
    // Leaderboards
    globalLeaderboard: new Map(),
    groupLeaderboard: new Map(),
    
    // Coins System
    userCoins: new Map(),

    // Game Data Cache
    gameDataCache: new Map(),
    cacheTimestamp: new Map()
};

// Utility Functions
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
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

function scrambleWord(word) {
    const letters = word.split('');
    for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    return letters.join('');
}

// 🔥 GAME API FUNCTIONS - SEMUA GAME DIAMBIL DARI API
async function fetchFromGameAPI(endpoint, params = {}) {
    try {
        const url = `${GAME_API_BASE}/${endpoint}`;
        const response = await axios.get(url, {
            params: {
                api_key: GAME_API_KEY,
                bot_name: BOT_NAME,
                ...params
            },
            timeout: 10000
        });
        
        return response.data;
    } catch (error) {
        console.error(`❌ API Error (${endpoint}):`, error.message);
        return getFallbackData(endpoint);
    }
}

async function getGameData(gameType, options = {}) {
    const cacheKey = `${gameType}_${JSON.stringify(options)}`;
    const now = Date.now();
    
    // Check cache (5 minutes)
    if (gameStates.gameDataCache.has(cacheKey)) {
        const cached = gameStates.gameDataCache.get(cacheKey);
        if (now - cached.timestamp < 5 * 60 * 1000) {
            return cached.data;
        }
    }
    
    try {
        let data;
        
        switch(gameType) {
            case 'tebakkata':
                data = await fetchFromGameAPI('games/tebak-kata', options);
                if (!data || !data.word) throw new Error('Invalid data');
                return {
                    word: data.word.toUpperCase(),
                    scrambled: scrambleWord(data.word.toUpperCase()),
                    hint: data.hint || 'Tebak kata ini',
                    category: data.category || 'general',
                    difficulty: data.difficulty || 'medium'
                };
                
            case 'tebakgambar':
                data = await fetchFromGameAPI('games/tebak-gambar', options);
                if (!data || !data.image_url) throw new Error('Invalid data');
                return {
                    image_url: data.image_url,
                    answer: data.answer.toLowerCase(),
                    hint: data.hint || 'Tebak apa ini',
                    category: data.category || 'object'
                };
                
            case 'quiz':
                data = await fetchFromGameAPI('games/quiz', options);
                if (!data || !data.question) throw new Error('Invalid data');
                return {
                    question: data.question,
                    options: data.options || ['A. Option 1', 'B. Option 2', 'C. Option 3', 'D. Option 4'],
                    answer: data.answer || 'A',
                    explanation: data.explanation,
                    category: data.category || 'general',
                    difficulty: data.difficulty || 'medium',
                    point: data.point || 10
                };
                
            case 'truth':
                data = await fetchFromGameAPI('games/truth', options);
                if (!data || !data.question) throw new Error('Invalid data');
                return data.question;
                
            case 'dare':
                data = await fetchFromGameAPI('games/dare', options);
                if (!data || !data.challenge) throw new Error('Invalid data');
                return data.challenge;
                
            case 'tebaklagu':
                data = await fetchFromGameAPI('games/tebak-lagu', options);
                if (!data || !data.title) throw new Error('Invalid data');
                return {
                    title: data.title,
                    artist: data.artist || 'Unknown Artist',
                    year: data.year || 'Unknown',
                    hint: data.hint || 'Tebak judul lagu ini',
                    preview_url: data.preview_url
                };
                
            case 'tebakbendera':
                data = await fetchFromGameAPI('games/tebak-bendera', options);
                if (!data || !data.country) throw new Error('Invalid data');
                return {
                    country: data.country,
                    emoji: data.emoji || '🏳️',
                    capital: data.capital || 'Unknown',
                    hint: data.hint || 'Tebak negara ini',
                    continent: data.continent || 'Unknown'
                };
                
            case 'tebakemoji':
                data = await fetchFromGameAPI('games/tebak-emoji', options);
                if (!data || !data.emoji) throw new Error('Invalid data');
                return {
                    emoji: data.emoji,
                    answer: data.answer,
                    hint: data.hint || 'Tebak arti emoji ini'
                };
                
            case 'tebaklirik':
                data = await fetchFromGameAPI('games/tebak-lirik', options);
                if (!data || !data.lyric) throw new Error('Invalid data');
                return {
                    lyric: data.lyric,
                    next_line: data.next_line,
                    song_title: data.song_title || 'Unknown Song',
                    artist: data.artist || 'Unknown Artist',
                    hint: data.hint || 'Sambung lirik berikutnya'
                };
                
            case 'math':
                data = await fetchFromGameAPI('games/math', options);
                if (!data || !data.expression) throw new Error('Invalid data');
                return {
                    expression: data.expression,
                    answer: data.answer,
                    difficulty: data.difficulty || 'easy',
                    time_limit: data.time_limit || 30
                };
                
            case 'tebakangka':
                // Generate random number
                return {
                    number: getRandomInt(1, 100),
                    hint: 'Angka antara 1-100',
                    max_attempts: 10
                };
                
            case 'werewolf_roles':
                data = await fetchFromGameAPI('games/werewolf/roles', options);
                if (!data || !data.roles) throw new Error('Invalid data');
                return data.roles;
                
            case 'rpg_items':
                data = await fetchFromGameAPI('rpg/items', options);
                if (!data || !data.items) throw new Error('Invalid data');
                return data.items;
                
            case 'gacha_items':
                data = await fetchFromGameAPI('games/gacha/items', options);
                if (!data || !data.items) throw new Error('Invalid data');
                return data.items;
                
            case 'pet_types':
                data = await fetchFromGameAPI('games/pet/types', options);
                if (!data || !data.pets) throw new Error('Invalid data');
                return data.pets;
                
            default:
                throw new Error(`Unknown game type: ${gameType}`);
        }
        
        // Cache the data
        gameStates.gameDataCache.set(cacheKey, {
            data: data,
            timestamp: now
        });
        
        return data;
        
    } catch (error) {
        console.error(`❌ Error getting ${gameType}:`, error.message);
        return getFallbackData(gameType);
    }
}

function getFallbackData(gameType) {
    const fallbackData = {
        tebakkata: () => ({
            word: 'KOMPUTER',
            scrambled: scrambleWord('KOMPUTER'),
            hint: 'Alat untuk mengolah data',
            category: 'technology',
            difficulty: 'easy'
        }),
        
        tebakgambar: () => ({
            image_url: 'https://i.imgur.com/3A6Y7aB.jpeg',
            answer: 'kucing',
            hint: 'Hewan peliharaan',
            category: 'animal'
        }),
        
        quiz: () => ({
            question: 'Ibukota Indonesia adalah?',
            options: ['A. Jakarta', 'B. Bandung', 'C. Surabaya', 'D. Medan'],
            answer: 'A',
            explanation: 'Jakarta adalah ibukota Indonesia',
            category: 'geography',
            difficulty: 'easy',
            point: 10
        }),
        
        truth: () => 'Apa rahasia terbesar yang kamu sembunyikan dari teman-teman?',
        
        dare: () => 'Kirim suara kamu menyanyi lagu populer!',
        
        tebaklagu: () => ({
            title: 'Smooth Criminal',
            artist: 'Michael Jackson',
            year: '1987',
            hint: 'Lagu tentang kejahatan',
            preview_url: null
        }),
        
        tebakbendera: () => ({
            country: 'Indonesia',
            emoji: '🇮🇩',
            capital: 'Jakarta',
            hint: 'Merah Putih',
            continent: 'Asia'
        }),
        
        tebakemoji: () => ({
            emoji: '🍜🔥',
            answer: 'mie pedas',
            hint: 'Makanan pedas'
        }),
        
        tebaklirik: () => ({
            lyric: 'Kisah klasik untuk dunia',
            next_line: 'Yang selalu terngiang di telinga',
            song_title: 'Unknown Song',
            artist: 'Unknown Artist',
            hint: 'Sambung lirik berikutnya'
        }),
        
        math: () => ({
            expression: `${getRandomInt(1, 20)} + ${getRandomInt(1, 20)}`,
            answer: getRandomInt(2, 40),
            difficulty: 'easy',
            time_limit: 30
        }),
        
        tebakangka: () => ({
            number: getRandomInt(1, 100),
            hint: 'Angka antara 1-100',
            max_attempts: 10
        }),
        
        werewolf_roles: () => [
            { name: 'Werewolf', description: 'Pemakan manusia di malam hari', team: 'evil' },
            { name: 'Villager', description: 'Warga desa yang baik', team: 'good' },
            { name: 'Seer', description: 'Dapat melihat identitas pemain', team: 'good' },
            { name: 'Doctor', description: 'Dapat menyembuhkan pemain', team: 'good' }
        ],
        
        rpg_items: () => [
            { id: 1, name: '⚔️ Pedang Besi', price: 100, type: 'weapon', power: 10 },
            { id: 2, name: '🛡️ Perisai Kayu', price: 80, type: 'armor', defense: 8 },
            { id: 3, name: '❤️ Potion Kecil', price: 30, type: 'potion', heal: 50 },
            { id: 4, name: '❤️ Potion Besar', price: 60, type: 'potion', heal: 100 }
        ],
        
        gacha_items: () => [
            { name: '🪙 100 Koin', rarity: 'common', value: 100 },
            { name: '🪙 500 Koin', rarity: 'rare', value: 500 },
            { name: '💎 Batu Langka', rarity: 'epic', value: 1000 },
            { name: '👑 Mahkota Emas', rarity: 'legendary', value: 5000 }
        ],
        
        pet_types: () => [
            { name: '🐉 Naga Kecil', type: 'dragon', rarity: 'legendary' },
            { name: '🐱 Kucing Ajaib', type: 'cat', rarity: 'common' },
            { name: '🐕 Anjing Setia', type: 'dog', rarity: 'common' },
            { name: '🦄 Unicorn', type: 'unicorn', rarity: 'legendary' }
        ]
    };
    
    return fallbackData[gameType] ? fallbackData[gameType]() : null;
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
            lastHunt: 0,
            created: Date.now()
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
            
        case 'spin':
            if (cooldowns.spin && now - cooldowns.spin < 1 * 60 * 1000) {
                const remaining = 1 * 60 * 1000 - (now - cooldowns.spin);
                return { onCooldown: true, remaining };
            }
            cooldowns.spin = now;
            return { onCooldown: false };
    }
    
    return { onCooldown: false };
}

function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours} jam ${minutes % 60} menit`;
    if (minutes > 0) return `${minutes} menit ${seconds % 60} detik`;
    return `${seconds} detik`;
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

// Game Functions - Semua game sekarang menggunakan API
async function startTebakKata(sock, sender, pushName) {
    try {
        const gameData = await getGameData('tebakkata', { difficulty: 'medium' });
        
        gameStates.tebakKata.set(sender, {
            answer: gameData.word,
            scrambled: gameData.scrambled,
            hint: gameData.hint,
            category: gameData.category,
            attempts: 0,
            startTime: Date.now(),
            timer: setTimeout(() => {
                gameStates.tebakKata.delete(sender);
                sock.sendMessage(sender, { 
                    text: `⏰ *WAKTU HABIS!*\n\nKata yang benar: ${gameData.word}\n\nKetik .tebakkata untuk bermain lagi!` 
                });
            }, 30000) // 30 detik
        });
        
        const gameText = 
            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
            '┃ 🎮 *TEBAK KATA* 🎮 ┃\n' +
            '┃   (API Powered)    ┃\n' +
            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
            `Susun kata: *${gameData.scrambled}*\n\n` +
            `📚 Kategori: ${gameData.category}\n` +
            `💡 Hint: ${gameData.hint}\n` +
            `⏰ Waktu: 30 detik\n` +
            `🎯 Kesempatan: 3x\n` +
            `💰 Hadiah: 50 koin\n\n` +
            '━━━━━━━━━━━━━━━━━━━━\n' +
            'Ketik jawabanmu sekarang!';
        
        await sock.sendMessage(sender, { text: gameText });
    } catch (error) {
        console.error('Error starting tebakkata:', error);
        await sock.sendMessage(sender, { 
            text: '❌ Gagal memuat game. Coba lagi nanti!' 
        });
    }
}

async function startTebakGambar(sock, sender, pushName) {
    try {
        const gameData = await getGameData('tebakgambar', { category: 'animal' });
        
        gameStates.tebakGambar.set(sender, {
            answer: gameData.answer,
            hint: gameData.hint,
            category: gameData.category,
            attempts: 0,
            startTime: Date.now()
        });
        
        // Download and send image
        const response = await axios.get(gameData.image_url, { 
            responseType: 'arraybuffer',
            timeout: 10000
        });
        
        const imageBuffer = Buffer.from(response.data);
        
        const gameText = 
            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
            '┃ 🖼️ *TEBAK GAMBAR* 🖼️ ┃\n' +
            '┃   (API Powered)    ┃\n' +
            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
            '❓ Apa yang ada di gambar ini?\n\n' +
            `📚 Kategori: ${gameData.category}\n` +
            `💡 Hint: ${gameData.hint}\n` +
            `🎯 Kesempatan: 3x\n` +
            `💰 Hadiah: 75 koin`;
        
        await sock.sendMessage(sender, { 
            image: imageBuffer,
            caption: gameText
        });
    } catch (error) {
        console.error('Error starting tebakgambar:', error);
        await sock.sendMessage(sender, { 
            text: '❌ Gagal memuat gambar. Coba lagi nanti!' 
        });
    }
}

async function startQuiz(sock, sender, pushName) {
    try {
        const gameData = await getGameData('quiz', { category: 'general' });
        
        gameStates.quizGames.set(sender, {
            ...gameData,
            startTime: Date.now(),
            answered: false
        });
        
        const gameText = 
            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
            '┃ 🎯 *KUIS* 🎯 ┃\n' +
            '┃  (API Powered)   ┃\n' +
            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
            `❓ ${gameData.question}\n\n` +
            `${gameData.options.join('\n')}\n\n` +
            `📚 Kategori: ${gameData.category}\n` +
            `🎯 Kesulitan: ${gameData.difficulty}\n` +
            `⏰ Waktu: 30 detik\n` +
            `💰 Hadiah: ${gameData.point} koin\n\n` +
            '━━━━━━━━━━━━━━━━━━━━\n' +
            'Jawab dengan huruf (A/B/C/D)';
        
        await sock.sendMessage(sender, { text: gameText });
        
        // Set timeout
        setTimeout(() => {
            if (gameStates.quizGames.has(sender)) {
                const game = gameStates.quizGames.get(sender);
                if (!game.answered) {
                    gameStates.quizGames.delete(sender);
                    sock.sendMessage(sender, { 
                        text: `⏰ *WAKTU HABIS!*\n\nJawaban: ${game.answer}\nPenjelasan: ${game.explanation || '-'}\n\nKetik .quiz untuk main lagi!` 
                    });
                }
            }
        }, 30000);
        
    } catch (error) {
        console.error('Error starting quiz:', error);
        await sock.sendMessage(sender, { 
            text: '❌ Gagal memuat kuis. Coba lagi nanti!' 
        });
    }
}

async function startTruth(sock, sender, pushName) {
    try {
        const question = await getGameData('truth');
        
        await sock.sendMessage(sender, { 
            text: `🤫 *TRUTH*\n\n${question}\n\n━━━━━━━━━━━━━━━━━━━━\n💬 Jawab dengan jujur ya!` 
        });
    } catch (error) {
        console.error('Error getting truth:', error);
        await sock.sendMessage(sender, { 
            text: '❌ Gagal memuat truth. Coba lagi nanti!' 
        });
    }
}

async function startDare(sock, sender, pushName) {
    try {
        const challenge = await getGameData('dare');
        
        await sock.sendMessage(sender, { 
            text: `😈 *DARE*\n\n${challenge}\n\n━━━━━━━━━━━━━━━━━━━━\n⚡ Lakukan dalam 5 menit!` 
        });
    } catch (error) {
        console.error('Error getting dare:', error);
        await sock.sendMessage(sender, { 
            text: '❌ Gagal memuat dare. Coba lagi nanti!' 
        });
    }
}

async function startTebakLagu(sock, sender, pushName) {
    try {
        const songData = await getGameData('tebaklagu');
        
        gameStates.tebakLagu.set(sender, {
            answer: songData.title.toLowerCase(),
            artist: songData.artist,
            year: songData.year,
            hint: songData.hint,
            attempts: 0,
            hintGiven: false,
            startTime: Date.now()
        });
        
        const gameText = 
            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
            '┃ 🎵 *TEBAK LAGU* 🎵 ┃\n' +
            '┃   (API Powered)    ┃\n' +
            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
            '🎶 Dengarkan lagu ini!\n\n' +
            `🎤 Artis: ${songData.artist}\n` +
            `📅 Tahun: ${songData.year}\n` +
            `💡 Clue: ${songData.hint}\n` +
            `🎯 Kesempatan: 3x\n` +
            `💰 Hadiah: 100 koin\n\n` +
            '━━━━━━━━━━━━━━━━━━━━\n' +
            'Tebak judul lagunya!\n\n' +
            '💡 Ketik "hint" untuk bantuan tambahan';
        
        await sock.sendMessage(sender, { text: gameText });
    } catch (error) {
        console.error('Error starting tebaklagu:', error);
        await sock.sendMessage(sender, { 
            text: '❌ Gagal memuat game. Coba lagi nanti!' 
        });
    }
}

async function startTebakBendera(sock, sender, pushName) {
    try {
        const flagData = await getGameData('tebakbendera');
        
        gameStates.tebakBendera.set(sender, {
            answer: flagData.country.toLowerCase(),
            emoji: flagData.emoji,
            capital: flagData.capital,
            continent: flagData.continent,
            hint: flagData.hint,
            attempts: 0,
            startTime: Date.now()
        });
        
        const gameText = 
            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
            '┃ 🏳️ *TEBAK BENDERA* 🏳️ ┃\n' +
            '┃    (API Powered)    ┃\n' +
            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
            `Bendera: ${flagData.emoji}\n\n` +
            `💡 Clue: ${flagData.hint}\n` +
            `🌍 Benua: ${flagData.continent}\n` +
            `🎯 Kesempatan: 3x\n` +
            `💰 Hadiah: 60 koin\n\n` +
            '━━━━━━━━━━━━━━━━━━━━\n' +
            'Negara apakah ini?';
        
        await sock.sendMessage(sender, { text: gameText });
    } catch (error) {
        console.error('Error starting tebakbendera:', error);
        await sock.sendMessage(sender, { 
            text: '❌ Gagal memuat game. Coba lagi nanti!' 
        });
    }
}

async function startTebakEmoji(sock, sender, pushName) {
    try {
        const emojiData = await getGameData('tebakemoji');
        
        gameStates.tebakEmoji.set(sender, {
            answer: emojiData.answer.toLowerCase(),
            emoji: emojiData.emoji,
            hint: emojiData.hint,
            attempts: 0,
            startTime: Date.now()
        });
        
        const gameText = 
            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
            '┃ 😀 *TEBAK EMOJI* 😀 ┃\n' +
            '┃   (API Powered)    ┃\n' +
            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
            `Emoji: ${emojiData.emoji}\n\n` +
            `💡 Hint: ${emojiData.hint}\n` +
            `🎯 Kesempatan: 3x\n` +
            `💰 Hadiah: 40 koin\n\n` +
            '━━━━━━━━━━━━━━━━━━━━\n' +
            'Apa maksud dari emoji ini?';
        
        await sock.sendMessage(sender, { text: gameText });
    } catch (error) {
        console.error('Error starting tebakemoji:', error);
        await sock.sendMessage(sender, { 
            text: '❌ Gagal memuat game. Coba lagi nanti!' 
        });
    }
}

async function startTebakLirik(sock, sender, pushName) {
    try {
        const lyricData = await getGameData('tebaklirik');
        
        gameStates.tebakLirik.set(sender, {
            answer: lyricData.next_line.toLowerCase(),
            lyric: lyricData.lyric,
            song_title: lyricData.song_title,
            artist: lyricData.artist,
            hint: lyricData.hint,
            attempts: 0,
            startTime: Date.now()
        });
        
        const gameText = 
            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
            '┃ 🎵 *TEBAK LIRIK* 🎵 ┃\n' +
            '┃   (API Powered)    ┃\n' +
            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
            `🎶 Lagu: ${lyricData.song_title}\n` +
            `🎤 Artis: ${lyricData.artist}\n\n` +
            `"${lyricData.lyric}"\n\n` +
            `💡 ${lyricData.hint}\n` +
            `🎯 Kesempatan: 3x\n` +
            `💰 Hadiah: 55 koin\n\n` +
            '━━━━━━━━━━━━━━━━━━━━\n' +
            'Sambung lirik berikutnya!';
        
        await sock.sendMessage(sender, { text: gameText });
    } catch (error) {
        console.error('Error starting tebaklirik:', error);
        await sock.sendMessage(sender, { 
            text: '❌ Gagal memuat game. Coba lagi nanti!' 
        });
    }
}

async function startMathBattle(sock, sender, pushName) {
    try {
        const mathData = await getGameData('math', { difficulty: 'medium' });
        
        gameStates.mathBattle.set(sender, {
            answer: mathData.answer,
            expression: mathData.expression,
            difficulty: mathData.difficulty,
            startTime: Date.now(),
            winner: null
        });
        
        const gameText = 
            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
            '┃ 🧮 *MATH BATTLE* 🧮 ┃\n' +
            '┃   (API Powered)    ┃\n' +
            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
            `Soal: ${mathData.expression} = ?\n\n` +
            `🎯 Kesulitan: ${mathData.difficulty}\n` +
            `⏰ Waktu: ${mathData.time_limit} detik\n` +
            `💰 Hadiah: 100 koin\n\n` +
            '━━━━━━━━━━━━━━━━━━━━\n' +
            '⚡ Yang jawab duluan menang!';
        
        await sock.sendMessage(sender, { text: gameText });
        
        // Set timeout
        setTimeout(() => {
            if (gameStates.mathBattle.has(sender)) {
                const game = gameStates.mathBattle.get(sender);
                if (!game.winner) {
                    gameStates.mathBattle.delete(sender);
                    sock.sendMessage(sender, { 
                        text: `⏰ *WAKTU HABIS!*\n\nJawaban: ${game.answer}\n\nKetik .mathbattle untuk main lagi!` 
                    });
                }
            }
        }, mathData.time_limit * 1000);
        
    } catch (error) {
        console.error('Error starting mathbattle:', error);
        await sock.sendMessage(sender, { 
            text: '❌ Gagal memuat game. Coba lagi nanti!' 
        });
    }
}

async function startTebakAngka(sock, sender, pushName) {
    try {
        const numberData = await getGameData('tebakangka');
        
        gameStates.tebakAngka.set(sender, {
            answer: numberData.number,
            hint: numberData.hint,
            maxAttempts: numberData.max_attempts,
            attempts: 0,
            startTime: Date.now(),
            min: 1,
            max: 100
        });
        
        const gameText = 
            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
            '┃ 🔢 *TEBAK ANGKA* 🔢 ┃\n' +
            '┃   (API Powered)    ┃\n' +
            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
            `Saya memilih angka ${numberData.hint}\n\n` +
            `💡 Saya akan kasih clue:\n` +
            `"Terlalu besar" / "Terlalu kecil"\n\n` +
            `🎯 Kesempatan: ${numberData.max_attempts}x\n` +
            `💰 Hadiah: 150 koin\n\n` +
            '━━━━━━━━━━━━━━━━━━━━\n' +
            'Tebak angkanya!';
        
        await sock.sendMessage(sender, { text: gameText });
    } catch (error) {
        console.error('Error starting tebakangka:', error);
        await sock.sendMessage(sender, { 
            text: '❌ Gagal memuat game. Coba lagi nanti!' 
        });
    }
}

async function startSuit(sock, sender, pushName) {
    const choices = [
        { emoji: '🪨', name: 'batu', beats: 'gunting' },
        { emoji: '✂️', name: 'gunting', beats: 'kertas' },
        { emoji: '📄', name: 'kertas', beats: 'batu' }
    ];
    
    gameStates.suitGames.set(sender, {
        choices: choices,
        waiting: true
    });
    
    const gameText = 
        '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
        '┃ ✂️ *SUIT* ✂️ ┃\n' +
        '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
        'Pilih salah satu:\n\n' +
        '`.suit batu` - 🪨 Batu\n' +
        '`.suit gunting` - ✂️ Gunting\n' +
        '`.suit kertas` - 📄 Kertas\n\n' +
        '━━━━━━━━━━━━━━━━━━━━\n' +
        'Lawan: Bot 🤖';
    
    await sock.sendMessage(sender, { text: gameText });
}

async function startWerewolf(sock, sender, pushName) {
    try {
        if (!sender.endsWith('@g.us')) {
            await sock.sendMessage(sender, { 
                text: '❌ Werewolf hanya bisa dimainkan di grup!' 
            });
            return;
        }
        
        // Get group participants
        const groupMetadata = await sock.groupMetadata(sender);
        const participants = groupMetadata.participants.filter(p => !p.id.endsWith('@s.whatsapp.net'));
        
        if (participants.length < 4) {
            await sock.sendMessage(sender, { 
                text: '❌ Minimal 4 pemain untuk bermain Werewolf!' 
            });
            return;
        }
        
        const roles = await getGameData('werewolf_roles');
        const shuffledPlayers = shuffleArray([...participants]);
        
        // Assign roles
        const assignedRoles = {};
        shuffledPlayers.forEach((player, index) => {
            const role = roles[index % roles.length];
            assignedRoles[player.id] = role;
        });
        
        gameStates.werewolfGames.set(sender, {
            players: participants.map(p => p.id),
            roles: assignedRoles,
            phase: 'setup',
            alive: participants.map(p => p.id),
            votes: {},
            day: 1
        });
        
        // Send role DMs
        for (const player of participants) {
            const role = assignedRoles[player.id];
            await sock.sendMessage(player.id, {
                text: `🎭 *ROLE WEREWOLF*\n\nKamu adalah: *${role.name}*\n\n${role.description}\n\nTim: ${role.team === 'evil' ? '😈 JAHAT' : '😇 BAIK'}\n\nJangan beritahu siapapun!`
            });
        }
        
        const gameText = 
            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
            '┃ 🐺 *WEREWOLF* 🐺 ┃\n' +
            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
            `🎮 Game Werewolf dimulai!\n` +
            `👥 Pemain: ${participants.length} orang\n\n` +
            `📱 Role sudah dikirim via DM!\n\n` +
            `🌙 Malam pertama dimulai...\n\n` +
            `💡 Pemain Werewolf, ketik .ww kill @target di DM`;
        
        await sock.sendMessage(sender, { text: gameText });
        
    } catch (error) {
        console.error('Error starting werewolf:', error);
        await sock.sendMessage(sender, { 
            text: '❌ Gagal memulai game Werewolf!' 
        });
    }
}

// Express Server
const app = express();
app.use(express.json());

// API Endpoints untuk mengelola game
app.get('/api/games', async (req, res) => {
    try {
        const games = [
            { id: 'tebakkata', name: 'Tebak Kata', description: 'Susun kata acak' },
            { id: 'tebakgambar', name: 'Tebak Gambar', description: 'Tebak objek dalam gambar' },
            { id: 'quiz', name: 'Quiz', description: 'Kuis pilihan ganda' },
            { id: 'tebaklagu', name: 'Tebak Lagu', description: 'Tebak judul lagu' },
            { id: 'tebakbendera', name: 'Tebak Bendera', description: 'Tebak negara dari bendera' },
            { id: 'tebakemoji', name: 'Tebak Emoji', description: 'Tebak arti emoji' },
            { id: 'tebaklirik', name: 'Tebak Lirik', description: 'Sambung lirik lagu' },
            { id: 'mathbattle', name: 'Math Battle', description: 'Hitungan cepat' },
            { id: 'suit', name: 'Suit', description: 'Batu gunting kertas' },
            { id: 'tebakangka', name: 'Tebak Angka', description: 'Tebak angka 1-100' }
        ];
        
        res.json({ success: true, games });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/stats', (req, res) => {
    const stats = {
        active_games: {
            tebakkata: gameStates.tebakKata.size,
            quiz: gameStates.quizGames.size,
            mathbattle: gameStates.mathBattle.size,
            tebakangka: gameStates.tebakAngka.size
        },
        rpg_users: gameStates.rpgProfiles.size,
        total_coins: Array.from(gameStates.userCoins.values()).reduce((a, b) => a + b, 0),
        leaderboard_entries: gameStates.globalLeaderboard.size,
        cache_size: gameStates.gameDataCache.size
    };
    
    res.json({ success: true, stats });
});

app.get('/api/leaderboard', (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const top = getGlobalLeaderboard(limit);
    
    const leaderboard = top.map(([userId, points], index) => ({
        rank: index + 1,
        userId: userId.split('@')[0],
        points: points
    }));
    
    res.json({ success: true, leaderboard });
});

app.post('/api/add-game', async (req, res) => {
    try {
        const { api_key, game_type, data } = req.body;
        
        if (api_key !== GAME_API_KEY) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        
        // Clear cache untuk game type tertentu
        for (const [key, value] of gameStates.gameDataCache.entries()) {
            if (key.startsWith(game_type)) {
                gameStates.gameDataCache.delete(key);
            }
        }
        
        res.json({ success: true, message: 'Cache cleared' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/', (req, res) => {
    const stats = {
        active_games: gameStates.tebakKata.size + gameStates.quizGames.size + gameStates.mathBattle.size,
        rpg_users: gameStates.rpgProfiles.size,
        total_coins: Array.from(gameStates.userCoins.values()).reduce((a, b) => a + b, 0),
        uptime: formatRuntime(Date.now() - BOT_START_TIME)
    };
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${BOT_NAME} - Game Dashboard</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }
                
                body {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    padding: 20px;
                    color: #333;
                }
                
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                }
                
                header {
                    background: white;
                    padding: 30px;
                    border-radius: 20px;
                    margin-bottom: 30px;
                    text-align: center;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                }
                
                h1 {
                    color: #667eea;
                    margin-bottom: 10px;
                    font-size: 2.5rem;
                }
                
                .subtitle {
                    color: #666;
                    font-size: 1.1rem;
                    margin-bottom: 20px;
                }
                
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }
                
                .stat-card {
                    background: white;
                    padding: 25px;
                    border-radius: 15px;
                    text-align: center;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.05);
                    transition: transform 0.3s ease;
                }
                
                .stat-card:hover {
                    transform: translateY(-5px);
                }
                
                .stat-icon {
                    font-size: 2.5rem;
                    margin-bottom: 15px;
                }
                
                .stat-value {
                    font-size: 2rem;
                    font-weight: bold;
                    color: #667eea;
                    margin-bottom: 5px;
                }
                
                .stat-label {
                    color: #666;
                    font-size: 0.9rem;
                }
                
                .games-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                }
                
                .game-card {
                    background: white;
                    padding: 25px;
                    border-radius: 15px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.05);
                }
                
                .game-card h3 {
                    color: #667eea;
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid #f0f0f0;
                }
                
                .game-list {
                    list-style: none;
                }
                
                .game-list li {
                    padding: 12px 0;
                    border-bottom: 1px solid #f5f5f5;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .game-list li:last-child {
                    border-bottom: none;
                }
                
                .api-status {
                    background: white;
                    padding: 25px;
                    border-radius: 15px;
                    margin-top: 30px;
                }
                
                .status-online {
                    color: #4CAF50;
                    font-weight: bold;
                }
                
                .api-info {
                    margin-top: 15px;
                    padding: 15px;
                    background: #f8f9fa;
                    border-radius: 10px;
                    font-family: monospace;
                    font-size: 0.9rem;
                }
                
                footer {
                    text-align: center;
                    margin-top: 40px;
                    color: white;
                    padding: 20px;
                }
                
                .refresh-btn {
                    background: #667eea;
                    color: white;
                    border: none;
                    padding: 12px 25px;
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 1rem;
                    margin-top: 20px;
                    transition: background 0.3s ease;
                }
                
                .refresh-btn:hover {
                    background: #5a67d8;
                }
                
                @media (max-width: 768px) {
                    .container {
                        padding: 10px;
                    }
                    
                    header {
                        padding: 20px;
                    }
                    
                    h1 {
                        font-size: 2rem;
                    }
                    
                    .games-grid {
                        grid-template-columns: 1fr;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <header>
                    <h1>🤖 ${BOT_NAME}</h1>
                    <p class="subtitle">WhatsApp Bot with Dynamic Games from API</p>
                    <button class="refresh-btn" onclick="location.reload()">🔄 Refresh Stats</button>
                </header>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">🎮</div>
                        <div class="stat-value">${stats.active_games}</div>
                        <div class="stat-label">Active Games</div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon">👥</div>
                        <div class="stat-value">${stats.rpg_users}</div>
                        <div class="stat-label">RPG Players</div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon">💰</div>
                        <div class="stat-value">${stats.total_coins.toLocaleString()}</div>
                        <div class="stat-label">Total Coins</div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon">⏱️</div>
                        <div class="stat-value">${stats.uptime}</div>
                        <div class="stat-label">Uptime</div>
                    </div>
                </div>
                
                <div class="games-grid">
                    <div class="game-card">
                        <h3>🎮 Word Games</h3>
                        <ul class="game-list">
                            <li>.tebakkata <span>🔤</span></li>
                            <li>.tebakemoji <span>😀</span></li>
                            <li>.tebaklirik <span>🎵</span></li>
                            <li>.quiz <span>🧠</span></li>
                        </ul>
                    </div>
                    
                    <div class="game-card">
                        <h3>🖼️ Visual Games</h3>
                        <ul class="game-list">
                            <li>.tebakgambar <span>📸</span></li>
                            <li>.tebakbendera <span>🏳️</span></li>
                            <li>.tebaklagu <span>🎶</span></li>
                        </ul>
                    </div>
                    
                    <div class="game-card">
                        <h3>⚔️ RPG System</h3>
                        <ul class="game-list">
                            <li>.profile <span>👤</span></li>
                            <li>.daily <span>🎁</span></li>
                            <li>.work <span>💼</span></li>
                            <li>.hunt <span>🏹</span></li>
                            <li>.shop <span>🛒</span></li>
                            <li>.inventory <span>📦</span></li>
                        </ul>
                    </div>
                    
                    <div class="game-card">
                        <h3>🎲 Casual Games</h3>
                        <ul class="game-list">
                            <li>.truth <span>🤫</span></li>
                            <li>.dare <span>😈</span></li>
                            <li>.suit <span>✂️</span></li>
                            <li>.mathbattle <span>🧮</span></li>
                            <li>.tebakangka <span>🔢</span></li>
                            <li>.spin <span>🎰</span></li>
                        </ul>
                    </div>
                </div>
                
                <div class="api-status">
                    <h3>🔧 API Status</h3>
                    <p>Game Source: <span class="status-online">${GAME_API_BASE}</span></p>
                    <div class="api-info">
                        📁 Semua game data diambil dari API<br>
                        🔄 Auto refresh setiap 5 menit<br>
                        📊 Total cache: ${gameStates.gameDataCache.size} items
                    </div>
                </div>
            </div>
            
            <footer>
                <p>© 2024 ${BOT_NAME} - All games powered by dynamic API</p>
                <p>👤 Owner: ${OWNER_NUMBER} | ⚡ Real-time Game Updates</p>
            </footer>
            
            <script>
                // Auto-refresh every 60 seconds
                setTimeout(() => location.reload(), 60000);
                
                // Fetch live stats
                async function fetchStats() {
                    try {
                        const response = await fetch('/api/stats');
                        const data = await response.json();
                        if (data.success) {
                            console.log('Live Stats:', data.stats);
                        }
                    } catch (error) {
                        console.error('Error fetching stats:', error);
                    }
                }
                
                // Initial fetch
                fetchStats();
                
                // Update every 30 seconds
                setInterval(fetchStats, 30000);
            </script>
        </body>
        </html>
    `);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        bot: BOT_NAME,
        api_base: GAME_API_BASE,
        uptime: formatRuntime(Date.now() - BOT_START_TIME),
        games_active: gameStates.tebakKata.size + gameStates.quizGames.size,
        rpg_users: gameStates.rpgProfiles.size,
        total_coins: Array.from(gameStates.userCoins.values()).reduce((a, b) => a + b, 0),
        cache_size: gameStates.gameDataCache.size,
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
    console.log(`🎮 Game API: ${GAME_API_BASE}`);
    console.log(`🔑 API Key: ${GAME_API_KEY ? 'SET' : 'NOT SET'}`);
});

// Main Bot Function
async function startBot() {
    try {
        console.log('🚀 Starting WhatsApp Bot with Dynamic Games...');
        
        const { state, saveCreds, clearData } = await useMongoAuthState();
        const { version } = await fetchLatestBaileysVersion();
        
        console.log(`📱 WhatsApp v${version.join('.')}`);
        console.log(`🤖 Bot: ${BOT_NAME}`);
        console.log(`🎮 Game Mode: DYNAMIC API`);
        console.log(`🌐 API Base: ${GAME_API_BASE}`);
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
                console.log('\n╔══════════════════════════════════════════╗');
                console.log('║  ✅ ' + BOT_NAME + ' ONLINE!             ║');
                console.log('║  🎮 Dynamic Games from API ✓            ║');
                console.log('║  🌐 API: ' + GAME_API_BASE + '   ║');
                console.log('║  💰 Coin System Active ✓                ║');
                console.log('║  🏆 Leaderboard Active ✓                ║');
                console.log('║  ⚔️ RPG System Active ✓                 ║');
                console.log('║  👥 Group Tools Ready ✓                 ║');
                console.log('║  👋 Welcome/Leave Active ✓              ║');
                console.log('║  💾 MongoDB Connected ✓                 ║');
                console.log('╚══════════════════════════════════════════╝\n');
                
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
                        '🎮 Dynamic Games from API ✓\n' +
                        '🌐 API: ' + GAME_API_BASE + '\n' +
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
                    if (command === '.menu' || command === '.games' || command === '.help') {
                        const greeting = getGreeting();
                        const dateInfo = getFormattedDate();
                        const runtime = formatRuntime(Date.now() - BOT_START_TIME);
                        const coins = getCoins(userId);
                        
                        const menuText = 
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃  🎮 *' + BOT_NAME.toUpperCase() + '* 🎮  ┃\n' +
                            '┃   (API Powered)    ┃\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            greeting + ', *' + pushName + '*! ✨\n' +
                            `💰 Koin: ${coins}\n\n` +
                            '📅 ' + dateInfo.full + '\n' +
                            '⏰ ' + dateInfo.time + '\n' +
                            '⏱️ Runtime: ' + runtime + '\n\n' +
                            
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃ 🎯 *WORD GAMES* 🎯\n' +
                            '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                            '┃ .tebakkata - Susun kata acak (API)\n' +
                            '┃ .tebakemoji - Tebak arti emoji (API)\n' +
                            '┃ .tebaklirik - Sambung lirik lagu (API)\n' +
                            '┃ .quiz - Kuis pilihan ganda (API)\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃ 🖼️ *VISUAL GAMES* 🖼️\n' +
                            '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                            '┃ .tebakgambar - Tebak gambar (API)\n' +
                            '┃ .tebakbendera - Tebak bendera (API)\n' +
                            '┃ .tebaklagu - Tebak judul lagu (API)\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃ 🧠 *FUN GAMES* 🧠\n' +
                            '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                            '┃ .truth - Pertanyaan jujur (API)\n' +
                            '┃ .dare - Tantangan seru (API)\n' +
                            '┃ .mathbattle - Hitungan cepat (API)\n' +
                            '┃ .suit - Batu gunting kertas\n' +
                            '┃ .tebakangka - Tebak angka 1-100\n' +
                            '┃ .spin - Spin gacha\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃ ⚔️ *RPG SYSTEM* ⚔️\n' +
                            '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                            '┃ .profile - Profil RPG\n' +
                            '┃ .daily - Klaim harian (24h)\n' +
                            '┃ .work - Kerja dapet koin (5m)\n' +
                            '┃ .hunt - Berburu item (10m)\n' +
                            '┃ .shop - Toko item (API)\n' +
                            '┃ .inventory - Inventory\n' +
                            '┃ .adopt - Adopsi pet (API)\n' +
                            '┃ .pet - Lihat pet\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃ 🐺 *GROUP GAMES* 🐺\n' +
                            '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                            '┃ .ww start - Werewolf game\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃ 📊 *LEADERBOARD* 📊\n' +
                            '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                            '┃ .topglobal - Top 10 global\n' +
                            '┃ .topgroup - Top 10 grup\n' +
                            '┃ .myrank - Rank kamu\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃ 🛠️ *TOOLS* 🛠️\n' +
                            '┣━━━━━━━━━━━━━━━━━━━━┫\n' +
                            '┃ .ping - Test bot\n' +
                            '┃ .runtime - Uptime bot\n' +
                            '┃ .owner - Kontak owner\n' +
                            '┃ .resetsession (owner)\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            
                            '━━━━━━━━━━━━━━━━━━━━\n' +
                            '🌐 Semua game diambil dari API\n' +
                            '💰 Setiap game berikan koin!\n' +
                            '👤 Owner: wa.me/' + OWNER_NUMBER + '\n' +
                            '🔧 API: ' + GAME_API_BASE + '\n' +
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
                                text: `✅ *BENAR!*\n\n🎉 Kamu menang!\n💰 +${coinsEarned} koin\n🏆 +10 poin leaderboard\n\nKata: ${game.answer}\nWaktu: ${Math.floor((Date.now() - game.startTime) / 1000)} detik\nKategori: ${game.category}` 
                            });
                        } else {
                            game.attempts++;
                            if (game.attempts >= 3) {
                                clearTimeout(game.timer);
                                gameStates.tebakKata.delete(sender);
                                await sock.sendMessage(sender, { 
                                    text: `💀 *GAME OVER!*\n\nKata yang benar: ${game.answer}\nKategori: ${game.category}\n\n💡 Ketik .tebakkata untuk bermain lagi` 
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
                                text: `✅ *BENAR!*\n\n🎉 Kamu menang!\n💰 +${coinsEarned} koin\n🏆 +15 poin leaderboard\n\nJawaban: ${game.answer}\nKategori: ${game.category}` 
                            });
                        } else {
                            game.attempts++;
                            if (game.attempts >= 3) {
                                gameStates.tebakGambar.delete(sender);
                                await sock.sendMessage(sender, { 
                                    text: `💀 *GAME OVER!*\n\nJawaban yang benar: ${game.answer}\nKategori: ${game.category}\n\n💡 Ketik .tebakgambar untuk bermain lagi` 
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
                            game.answered = true;
                            gameStates.quizGames.delete(sender);
                            addCoins(userId, game.point);
                            updateLeaderboard(userId, 5, isGroup ? sender : null);
                            
                            await sock.sendMessage(sender, { 
                                text: `✅ *BENAR!*\n\n🎉 Jawaban benar!\n💰 +${game.point} koin\n🏆 +5 poin leaderboard\n\n💡 Penjelasan: ${game.explanation || '-'}\nWaktu: ${Math.floor((Date.now() - game.startTime) / 1000)} detik` 
                            });
                        } else {
                            gameStates.quizGames.delete(sender);
                            await sock.sendMessage(sender, { 
                                text: `❌ *SALAH!*\n\nJawaban yang benar: ${game.answer}\nPenjelasan: ${game.explanation || '-'}\n\n💡 Ketik .quiz untuk bermain lagi` 
                            });
                        }
                        continue;
                    }
                    
                    // ==================== GAME 4: TRUTH OR DARE ====================
                    if (command === '.truth') {
                        await startTruth(sock, sender, pushName);
                        continue;
                    }
                    
                    if (command === '.dare') {
                        await startDare(sock, sender, pushName);
                        continue;
                    }
                    
                    // ==================== GAME 5: TEBAK LAGU ====================
                    if (command === '.tebaklagu') {
                        await startTebakLagu(sock, sender, pushName);
                        continue;
                    }
                    
                    // Check tebak lagu answer
                    if (gameStates.tebakLagu.has(sender)) {
                        const game = gameStates.tebakLagu.get(sender);
                        
                        if (text.toLowerCase() === 'hint' && !game.hintGiven) {
                            game.hintGiven = true;
                            await sock.sendMessage(sender, { 
                                text: `💡 *HINT TAMBAHAN:* Tahun rilis: ${game.year}\n\n🎯 Kesempatan tersisa: ${3 - game.attempts}` 
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
                                text: `✅ *BENAR!*\n\n🎉 Kamu menang!\n💰 +${coinsEarned} koin\n🏆 +20 poin leaderboard\n\nJudul: ${game.answer.toUpperCase()}\nArtis: ${game.artist}\nTahun: ${game.year}` 
                            });
                        } else {
                            game.attempts++;
                            if (game.attempts >= 3) {
                                gameStates.tebakLagu.delete(sender);
                                await sock.sendMessage(sender, { 
                                    text: `💀 *GAME OVER!*\n\nJudul yang benar: ${game.answer.toUpperCase()}\nArtis: ${game.artist}\nTahun: ${game.year}\n\n💡 Ketik .tebaklagu untuk bermain lagi` 
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
                        
                        if (userAnswer === game.answer) {
                            gameStates.tebakBendera.delete(sender);
                            const coinsEarned = 60;
                            addCoins(userId, coinsEarned);
                            updateLeaderboard(userId, 12, isGroup ? sender : null);
                            
                            await sock.sendMessage(sender, { 
                                text: `✅ *BENAR!*\n\n🎉 Kamu menang!\n💰 +${coinsEarned} koin\n🏆 +12 poin leaderboard\n\nNegara: ${game.answer.toUpperCase()}\nIbukota: ${game.capital}\nBenua: ${game.continent}\nBendera: ${game.emoji}` 
                            });
                        } else {
                            game.attempts++;
                            if (game.attempts >= 3) {
                                gameStates.tebakBendera.delete(sender);
                                await sock.sendMessage(sender, { 
                                    text: `💀 *GAME OVER!*\n\nNegara yang benar: ${game.answer.toUpperCase()}\nIbukota: ${game.capital}\nBenua: ${game.continent}\nBendera: ${game.emoji}\n\n💡 Ketik .tebakbendera untuk bermain lagi` 
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
                                    text: `💀 *GAME OVER!*\n\nArti yang benar: ${game.answer}\nEmoji: ${game.emoji}\n\n💡 Ketik .tebakemoji untuk bermain lagi` 
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
                        
                        if (userAnswer === game.answer) {
                            gameStates.tebakLirik.delete(sender);
                            const coinsEarned = 55;
                            addCoins(userId, coinsEarned);
                            updateLeaderboard(userId, 11, isGroup ? sender : null);
                            
                            await sock.sendMessage(sender, { 
                                text: `✅ *BENAR!*\n\n🎉 Kamu menang!\n💰 +${coinsEarned} koin\n🏆 +11 poin leaderboard\n\nLirik lengkap:\n"${game.lyric}"\n"${game.answer}"\n\nLagu: ${game.song_title}\nArtis: ${game.artist}` 
                            });
                        } else {
                            game.attempts++;
                            if (game.attempts >= 3) {
                                gameStates.tebakLirik.delete(sender);
                                await sock.sendMessage(sender, { 
                                    text: `💀 *GAME OVER!*\n\nLirik yang benar:\n"${game.lyric}"\n"${game.answer}"\n\nLagu: ${game.song_title}\nArtis: ${game.artist}\n\n💡 Ketik .tebaklirik untuk bermain lagi` 
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
                                    text: `⚡ *PERTAMA BENAR!*\n\n🎉 ${pushName} menang!\n💰 +${coinsEarned} koin\n🏆 +25 poin leaderboard\n\nSoal: ${game.expression} = ${game.answer}\nKesulitan: ${game.difficulty}\nWaktu: ${Math.floor((Date.now() - game.startTime) / 1000)} detik` 
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
                        
                        const game = gameStates.suitGames.get(sender);
                        const botChoice = game.choices[Math.floor(Math.random() * 3)];
                        let result = '';
                        let coinsEarned = 0;
                        
                        // Determine winner
                        if (choice === botChoice.name) {
                            result = '🤝 *SERI!*';
                            coinsEarned = 10;
                        } else if (
                            (choice === 'batu' && botChoice.name === 'gunting') ||
                            (choice === 'gunting' && botChoice.name === 'kertas') ||
                            (choice === 'kertas' && botChoice.name === 'batu')
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
                                  `Bot: ${emojiMap[botChoice.name]} (${botChoice.name})\n\n` +
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
                        
                        if (isNaN(userAnswer) || userAnswer < 1 || userAnswer > 100) {
                            await sock.sendMessage(sender, { 
                                text: '❌ Masukkan angka 1-100 yang valid!' 
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
                        } else if (game.attempts >= game.maxAttempts) {
                            gameStates.tebakAngka.delete(sender);
                            await sock.sendMessage(sender, { 
                                text: `💀 *GAME OVER!*\n\nAngka yang benar: ${game.answer}\nTebakan: ${game.attempts}x\n\n💡 Ketik .tebakangka untuk bermain lagi` 
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
                                text: `❌ ${clue}\n\nRange: ${game.min}-${game.max}\nTebakan: ${game.attempts}/${game.maxAttempts}\n\nCoba lagi!` 
                            });
                        }
                        continue;
                    }
                    
                    // ==================== WEREWOLF GAME ====================
                    if (command === '.ww' || command === '.werewolf') {
                        const subcommand = args[0]?.toLowerCase();
                        
                        if (!subcommand) {
                            await sock.sendMessage(sender, { 
                                text: '🐺 *WEREWOLF GAME*\n\n.perintah:\n.ww start - Mulai game\n.ww vote @player - Voting\n.ww kill @player - Kill (werewolf only)\n.ww roles - Lihat role\n.ww end - Akhiri game' 
                            });
                            continue;
                        }
                        
                        if (subcommand === 'start') {
                            await startWerewolf(sock, sender, pushName);
                            continue;
                        }
                        
                        if (subcommand === 'roles') {
                            if (!gameStates.werewolfGames.has(sender)) {
                                await sock.sendMessage(sender, { 
                                    text: '❌ Tidak ada game Werewolf aktif!' 
                                });
                                continue;
                            }
                            
                            const game = gameStates.werewolfGames.get(sender);
                            const rolesText = game.players.map(player => {
                                const role = game.roles[player];
                                const status = game.alive.includes(player) ? '❤️ Hidup' : '💀 Mati';
                                return `@${player.split('@')[0]} - ${role.name} (${status})`;
                            }).join('\n');
                            
                            await sock.sendMessage(sender, { 
                                text: `🐺 *PLAYER ROLES*\n\n${rolesText}\n\nHari: ${game.day}`,
                                mentions: game.players
                            });
                            continue;
                        }
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
                            `💰 Koin: ${coins}\n` +
                            `📅 Dibuat: ${new Date(profile.created).toLocaleDateString('id-ID')}\n\n` +
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
                            await sock.sendMessage(sender, { 
                                text: `⏳ *COOLDOWN!*\n\nKamu bisa klaim daily lagi dalam:\n${formatTime(cooldown.remaining)}` 
                            });
                            continue;
                        }
                        
                        const profile = getRPGProfile(userId);
                        const coinsEarned = 500 + profile.level * 50;
                        addCoins(userId, coinsEarned);
                        
                        await sock.sendMessage(sender, { 
                            text: `🎁 *DAILY REWARD!*\n\n💰 +${coinsEarned} koin\n\n━━━━━━━━━━━━━━━━━━━━\nKembali besok untuk hadiah lebih besar!\n💰 Total koin: ${getCoins(userId)}` 
                        });
                        continue;
                    }
                    
                    // WORK
                    if (command === '.work') {
                        const cooldown = checkCooldown(userId, 'work');
                        
                        if (cooldown.onCooldown) {
                            await sock.sendMessage(sender, { 
                                text: `⏳ *COOLDOWN!*\n\nKamu bisa kerja lagi dalam:\n${formatTime(cooldown.remaining)}` 
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
                            text: `💼 *BEKERJA*\n\nPekerjaan: ${job.name}\n💰 +${coinsEarned} koin\n💰 Total: ${getCoins(userId)}\n\n━━━━━━━━━━━━━━━━━━━━\nKembali bekerja dalam 5 menit!` 
                        });
                        continue;
                    }
                    
                    // HUNT
                    if (command === '.hunt') {
                        const cooldown = checkCooldown(userId, 'hunt');
                        
                        if (cooldown.onCooldown) {
                            await sock.sendMessage(sender, { 
                                text: `⏳ *COOLDOWN!*\n\nKamu bisa berburu lagi dalam:\n${formatTime(cooldown.remaining)}` 
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
                            text: `🏹 *BERBURU*\n\nKamu berhasil menangkap: ${hunt.item}\n💰 +${coinsEarned} koin\n⭐ +${expEarned} EXP\n💰 Total: ${getCoins(userId)}${levelUpText}\n\n━━━━━━━━━━━━━━━━━━━━\nKembali berburu dalam 10 menit!` 
                        });
                        continue;
                    }
                    
                    // SHOP
                    if (command === '.shop') {
                        try {
                            const items = await getGameData('rpg_items');
                            
                            const shopText = 
                                '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                                '┃ 🛒 *TOKO ITEM* 🛒 ┃\n' +
                                '┃   (API Powered)    ┃\n' +
                                '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                                '💰 Koin kamu: ' + getCoins(userId) + '\n\n' +
                                'Gunakan: .beli [nomor]\n\n' +
                                items.map(item => 
                                    `${item.id}. ${item.name} - 💰 ${item.price} koin`
                                ).join('\n') +
                                '\n\n━━━━━━━━━━━━━━━━━━━━\n' +
                                '💡 Contoh: .beli 1';
                            
                            await sock.sendMessage(sender, { text: shopText });
                        } catch (error) {
                            console.error('Error getting shop items:', error);
                            await sock.sendMessage(sender, { 
                                text: '❌ Gagal memuat toko. Coba lagi nanti!' 
                            });
                        }
                        continue;
                    }
                    
                    // BELI ITEM
                    if (command === '.beli' && args[0]) {
                        try {
                            const itemId = parseInt(args[0]);
                            const items = await getGameData('rpg_items');
                            const item = items.find(i => i.id === itemId);
                            
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
                                text: `✅ *PEMBELIAN BERHASIL!*\n\nItem: ${item.name}\n💰 -${item.price} koin\n💰 Sisa: ${getCoins(userId)}\n\n📦 Item telah ditambahkan ke inventory!` 
                            });
                        } catch (error) {
                            console.error('Error buying item:', error);
                            await sock.sendMessage(sender, { 
                                text: '❌ Gagal membeli item. Coba lagi nanti!' 
                            });
                        }
                        continue;
                    }
                    
                    // INVENTORY
                    if (command === '.inventory' || command === '.inv') {
                        const inventory = getInventory(userId);
                        
                        const invText = 
                            '┏━━━━━━━━━━━━━━━━━━━━┓\n' +
                            '┃ 📦 *INVENTORY* 📦 ┃\n' +
                            '┗━━━━━━━━━━━━━━━━━━━━┛\n\n' +
                            `💰 Koin: ${getCoins(userId)}\n` +
                            `📊 Total item: ${inventory.length}\n\n` +
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
                        const cooldown = checkCooldown(userId, 'spin');
                        
                        if (cooldown.onCooldown) {
                            await sock.sendMessage(sender, { 
                                text: `⏳ *COOLDOWN!*\n\nKamu bisa spin lagi dalam:\n${formatTime(cooldown.remaining)}` 
                            });
                            continue;
                        }
                        
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
                        
                        try {
                            const items = await getGameData('gacha_items');
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
                                      `${rewardText}\n` +
                                      `💰 Total koin: ${getCoins(userId)}\n\n` +
                                      `━━━━━━━━━━━━━━━━━━━━\n` +
                                      `💡 Spin lagi? .spin` 
                            });
                        } catch (error) {
                            console.error('Error spinning:', error);
                            await sock.sendMessage(sender, { 
                                text: '❌ Gagal memutar spin. Coba lagi nanti!' 
                            });
                        }
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
                        
                        try {
                            const pets = await getGameData('pet_types');
                            const pet = pets[Math.floor(Math.random() * pets.length)];
                            
                            deductCoins(userId, adoptCost);
                            
                            gameStates.petProfiles.set(userId, {
                                name: pet.name,
                                type: pet.type,
                                rarity: pet.rarity,
                                level: 1,
                                exp: 0,
                                happiness: 100,
                                lastFed: Date.now(),
                                lastTrained: 0,
                                adopted: Date.now()
                            });
                            
                            await sock.sendMessage(sender, { 
                                text: `🐾 *ADOPT SUKSES!*\n\nKamu mengadopsi: ${pet.name}\n⭐ Rarity: ${pet.rarity}\n💰 -${adoptCost} koin\n💰 Sisa: ${getCoins(userId)}\n\n💡 Rawat pet-mu dengan:\n.feed - Kasih makan\n.train - Latih pet\n.pet - Lihat status pet` 
                            });
                        } catch (error) {
                            console.error('Error adopting pet:', error);
                            await sock.sendMessage(sender, { 
                                text: '❌ Gagal mengadopsi pet. Coba lagi nanti!' 
                            });
                        }
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
                            `⭐ Rarity: ${pet.rarity}\n` +
                            `📊 Level: ${pet.level}\n` +
                            `📈 EXP: ${pet.exp}/${pet.level * 100}\n` +
                            `😊 Happiness: ${pet.happiness}/100\n` +
                            `📅 Diadopsi: ${new Date(pet.adopted).toLocaleDateString('id-ID')}\n\n` +
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
                        const feedCost = 10;
                        const coins = getCoins(userId);
                        
                        if (coins < feedCost) {
                            await sock.sendMessage(sender, { 
                                text: `❌ Koin tidak cukup!\n\nKoin kamu: ${coins}\nBiaya feed: ${feedCost}` 
                            });
                            continue;
                        }
                        
                        deductCoins(userId, feedCost);
                        pet.lastFed = Date.now();
                        pet.happiness = Math.min(100, pet.happiness + 10);
                        
                        await sock.sendMessage(sender, { 
                            text: `🍗 *FEED PET*\n\n${pet.name} sudah diberi makan!\n😊 Happiness: +10\n💰 -${feedCost} koin\n💰 Sisa: ${getCoins(userId)}\n\n💡 Happiness sekarang: ${pet.happiness}/100` 
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
                                leaderboardText += `${medal} @${userId.split('@')[0]} - ${points} poin\n`;
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
                            `┃ 🌐 API: ${GAME_API_BASE}\n` +
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
                            `┃ 🎮 Game Mode: Dynamic API\n` +
                            `┃ 🌐 API: ${GAME_API_BASE}\n` +
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