// gameSystem.js - COMPLETE VERSION WITH WEB API INTEGRATION
import axios from 'axios';

class GameSystem {
    constructor(sock) {
        this.sock = sock;
        this.activeGames = new Map();
        
        // Konfigurasi API - SEMUA DARI ENVIRONMENT VARIABLES
        this.API_CONFIG = {
            // API untuk berbagai jenis game - BISA DIUBAH DI HEROKU CONFIG
            WORD_API: process.env.WORD_API || 'https://random-word-api.herokuapp.com',
            TRIVIA_API: process.env.TRIVIA_API || 'https://opentdb.com',
            COUNTRY_API: process.env.COUNTRY_API || 'https://restcountries.com',
            JOKE_API: process.env.JOKE_API || 'https://v2.jokeapi.dev',
            IMAGE_API: process.env.IMAGE_API || 'https://source.unsplash.com',
            LYRICS_API: process.env.LYRICS_API || 'https://api.lyrics.ovh',
            CUSTOM_GAME_API: process.env.CUSTOM_GAME_API || '', // API custom Anda
            
            // API keys (jika perlu)
            RAPIDAPI_KEY: process.env.RAPIDAPI_KEY || '',
            UNSPLASH_KEY: process.env.UNSPLASH_KEY || ''
        };
        
        // Fallback data minimal - HANYA JIKA API SEMUA GAGAL
        this.fallbackData = {
            words: ['digital', 'program', 'mobile', 'python', 'server'],
            countries: [
                { name: 'Indonesia', capital: 'Jakarta', region: 'Asia' },
                { name: 'Malaysia', capital: 'Kuala Lumpur', region: 'Asia' },
                { name: 'Singapore', capital: 'Singapore', region: 'Asia' },
                { name: 'Japan', capital: 'Tokyo', region: 'Asia' },
                { name: 'USA', capital: 'Washington DC', region: 'Americas' }
            ],
            emojiCombos: [
                { emoji: '🍜🔥', meaning: 'mie pedas' },
                { emoji: '🐱💻', meaning: 'koding kucing' },
                { emoji: '📱💥', meaning: 'hp meledak' },
                { emoji: '🌧️☔', meaning: 'hujan deras' },
                { emoji: '🎮🏆', meaning: 'juara game' }
            ]
        };
    }

    // ==================== UTILITY METHODS ====================

    // Generate random number dengan range
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Shuffle array
    shuffleArray(array) {
        return array.sort(() => Math.random() - 0.5);
    }

    // Decode HTML entities
    decodeHtmlEntities(text) {
        if (!text) return '';
        return text
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
    }

    // Get flag emoji from country code
    getFlagEmoji(countryCode) {
        if (!countryCode || countryCode.length !== 2) return '🏳️';
        const codePoints = countryCode
            .toUpperCase()
            .split('')
            .map(char => 127397 + char.charCodeAt());
        return String.fromCodePoint(...codePoints);
    }

    // ==================== API CALL METHODS ====================

    // Fetch random word from API
    async fetchRandomWord() {
        try {
            if (this.API_CONFIG.CUSTOM_GAME_API) {
                const response = await axios.get(`${this.API_CONFIG.CUSTOM_GAME_API}/word/random`);
                return response.data;
            }
            
            const response = await axios.get(`${this.API_CONFIG.WORD_API}/word?length=${this.randomInt(4, 8)}`);
            const word = response.data[0];
            return {
                word: word,
                scrambled: this.shuffleArray(word.split('')).join('').toUpperCase(),
                length: word.length
            };
        } catch (error) {
            console.log('Word API failed, using fallback');
            const word = this.fallbackData.words[Math.floor(Math.random() * this.fallbackData.words.length)];
            return {
                word: word,
                scrambled: this.shuffleArray(word.split('')).join('').toUpperCase(),
                length: word.length
            };
        }
    }

    // Fetch trivia question from API
    async fetchTriviaQuestion() {
        try {
            if (this.API_CONFIG.CUSTOM_GAME_API) {
                const response = await axios.get(`${this.API_CONFIG.CUSTOM_GAME_API}/trivia/random`);
                return response.data;
            }
            
            const response = await axios.get(`${this.API_CONFIG.TRIVIA_API}/api.php?amount=1&type=multiple`);
            const trivia = response.data.results[0];
            
            const allAnswers = this.shuffleArray([
                ...trivia.incorrect_answers.map(ans => this.decodeHtmlEntities(ans)),
                this.decodeHtmlEntities(trivia.correct_answer)
            ]);
            
            return {
                question: this.decodeHtmlEntities(trivia.question),
                correctAnswer: this.decodeHtmlEntities(trivia.correct_answer),
                allAnswers: allAnswers,
                category: trivia.category,
                difficulty: trivia.difficulty
            };
        } catch (error) {
            console.log('Trivia API failed, using fallback');
            return this.generateFallbackTrivia();
        }
    }

    // Fetch random country from API
    async fetchRandomCountry() {
        try {
            if (this.API_CONFIG.CUSTOM_GAME_API) {
                const response = await axios.get(`${this.API_CONFIG.CUSTOM_GAME_API}/country/random`);
                return response.data;
            }
            
            const response = await axios.get(`${this.API_CONFIG.COUNTRY_API}/v3.1/all`);
            const countries = response.data;
            const country = countries[Math.floor(Math.random() * countries.length)];
            
            return {
                name: country.name?.common || 'Unknown',
                capital: country.capital?.[0] || 'Unknown',
                region: country.region || 'Unknown',
                flag: country.flags?.png || '',
                code: country.cca2 || ''
            };
        } catch (error) {
            console.log('Country API failed, using fallback');
            const country = this.fallbackData.countries[Math.floor(Math.random() * this.fallbackData.countries.length)];
            return {
                ...country,
                flag: '',
                code: 'ID'
            };
        }
    }

    // Fetch random joke from API
    async fetchRandomJoke(type = 'single') {
        try {
            if (this.API_CONFIG.CUSTOM_GAME_API) {
                const response = await axios.get(`${this.API_CONFIG.CUSTOM_GAME_API}/joke/random`);
                return response.data;
            }
            
            const response = await axios.get(`${this.API_CONFIG.JOKE_API}/joke/Any?type=${type}`);
            const joke = response.data;
            
            if (joke.type === 'twopart') {
                return `${joke.setup}\n\n${joke.delivery}`;
            } else {
                return joke.joke;
            }
        } catch (error) {
            console.log('Joke API failed, using fallback');
            return "Kenapa programmer tidak bisa tidur?\nKarena ada bug di kasurnya! 🐛";
        }
    }

    // Fetch random image from API
    async fetchRandomImage(keyword = 'object') {
        try {
            if (this.API_CONFIG.CUSTOM_GAME_API) {
                const response = await axios.get(`${this.API_CONFIG.CUSTOM_GAME_API}/image/random`);
                return response.data.url;
            }
            
            // Using Unsplash API
            const url = `${this.API_CONFIG.IMAGE_API}/random/400x400?${keyword}`;
            return url;
        } catch (error) {
            console.log('Image API failed');
            return null;
        }
    }

    // Fetch lyrics from API
    async fetchLyrics() {
        try {
            if (this.API_CONFIG.CUSTOM_GAME_API) {
                const response = await axios.get(`${this.API_CONFIG.CUSTOM_GAME_API}/lyrics/random`);
                return response.data;
            }
            
            // Since lyrics.ovh doesn't have random endpoint, we'll use fallback
            return this.generateFallbackLyrics();
        } catch (error) {
            console.log('Lyrics API failed, using fallback');
            return this.generateFallbackLyrics();
        }
    }

    // ==================== GAME METHODS ====================

    // 1) TEBAK KATA / SUSUN KATA
    async startTebakKata(jid) {
        try {
            const wordData = await this.fetchRandomWord();
            
            const game = {
                type: 'tebak-kata',
                kata: wordData.word.toLowerCase(),
                kataAcak: wordData.scrambled,
                answer: wordData.word.toLowerCase(),
                attempts: 0,
                maxAttempts: 3,
                points: 100,
                startTime: Date.now(),
                timer: 30
            };
            
            this.activeGames.set(jid, game);
            
            const message = 
                `🎮 *TEBAK KATA*\n\n` +
                `Susun kata: *${wordData.scrambled}*\n\n` +
                `📏 Panjang: ${wordData.length} huruf\n` +
                `⏰ Waktu: ${game.timer} detik\n` +
                `🎯 Kesempatan: ${game.maxAttempts} kali\n` +
                `🏆 Poin: ${game.points}\n\n` +
                `Ketik jawabanmu sekarang!`;
            
            await this.sock.sendMessage(jid, { text: message });
            
            // Set timer
            setTimeout(() => {
                if (this.activeGames.has(jid)) {
                    const currentGame = this.activeGames.get(jid);
                    if (currentGame.type === 'tebak-kata') {
                        this.sock.sendMessage(jid, { 
                            text: `⏰ Waktu habis!\nKata yang benar: *${currentGame.kata.toUpperCase()}*` 
                        });
                        this.activeGames.delete(jid);
                    }
                }
            }, game.timer * 1000);
            
            return game;
            
        } catch (error) {
            console.error('Error starting tebak kata:', error);
            await this.sock.sendMessage(jid, { 
                text: '❌ Gagal memulai game. Coba lagi nanti!' 
            });
            return null;
        }
    }

    // 2) TEBAK GAMBAR
    async startTebakGambar(jid, difficulty = 'easy') {
        try {
            const difficulties = {
                easy: { points: 50, keywords: ['animal', 'food', 'object'], time: 45 },
                medium: { points: 100, keywords: ['landmark', 'art', 'technology'], time: 35 },
                hard: { points: 150, keywords: ['abstract', 'microscopic', 'pattern'], time: 25 }
            };
            
            const diff = difficulties[difficulty] || difficulties.easy;
            const keyword = diff.keywords[Math.floor(Math.random() * diff.keywords.length)];
            
            // In real implementation, you would have image URLs with known answers
            // For now, we'll simulate with text
            const imageAnswers = {
                'animal': ['kucing', 'anjing', 'burung', 'ikan', 'kelinci'],
                'food': ['pizza', 'burger', 'nasi', 'mie', 'roti'],
                'object': ['meja', 'kursi', 'lampu', 'buku', 'telepon']
            };
            
            const possibleAnswers = imageAnswers[keyword] || ['benda'];
            const answer = possibleAnswers[Math.floor(Math.random() * possibleAnswers.length)];
            
            const game = {
                type: 'tebak-gambar',
                difficulty: difficulty,
                keyword: keyword,
                answer: answer,
                points: diff.points,
                startTime: Date.now(),
                timer: diff.time,
                hintUsed: false
            };
            
            this.activeGames.set(jid, game);
            
            const message = 
                `🖼️ *TEBAK GAMBAR*\n\n` +
                `Mode: *${difficulty.toUpperCase()}*\n` +
                `Kategori: *${keyword.toUpperCase()}*\n` +
                `⏰ Waktu: ${diff.time} detik\n` +
                `🏆 Poin: ${diff.points}\n\n` +
                `Apa yang ada di gambar ini?\n` +
                `💡 Ketik .hint untuk mendapatkan clue`;
            
            await this.sock.sendMessage(jid, { text: message });
            
            // Set timer
            setTimeout(() => {
                if (this.activeGames.has(jid)) {
                    const currentGame = this.activeGames.get(jid);
                    if (currentGame.type === 'tebak-gambar') {
                        this.sock.sendMessage(jid, { 
                            text: `⏰ Waktu habis!\nJawaban: *${currentGame.answer.toUpperCase()}*` 
                        });
                        this.activeGames.delete(jid);
                    }
                }
            }, diff.time * 1000);
            
            return game;
            
        } catch (error) {
            console.error('Error starting tebak gambar:', error);
            await this.sock.sendMessage(jid, { 
                text: '❌ Gagal memulai game. Coba lagi nanti!' 
            });
            return null;
        }
    }

    // 3) QUIZ / KUIS CEPAT
    async startQuiz(jid, category = 'general') {
        try {
            const trivia = await this.fetchTriviaQuestion();
            
            const game = {
                type: 'quiz',
                question: trivia.question,
                options: trivia.allAnswers,
                correctAnswer: trivia.correctAnswer.toLowerCase(),
                answer: trivia.correctAnswer.toLowerCase(),
                category: trivia.category,
                difficulty: trivia.difficulty,
                points: this.calculateQuizPoints(trivia.difficulty),
                startTime: Date.now(),
                timer: 30,
                answered: new Set()
            };
            
            this.activeGames.set(jid, game);
            
            const optionsText = trivia.allAnswers.map((opt, idx) => 
                `${String.fromCharCode(65 + idx)}. ${opt}`
            ).join('\n');
            
            const message = 
                `📚 *KUIS* (${trivia.category})\n\n` +
                `${trivia.question}\n\n` +
                `${optionsText}\n\n` +
                `📊 Kesulitan: ${trivia.difficulty}\n` +
                `⏰ Waktu: 30 detik\n` +
                `🏆 Poin: ${game.points}\n\n` +
                `Jawab dengan huruf (A/B/C/D) atau teks`;
            
            await this.sock.sendMessage(jid, { text: message });
            
            // Set timer
            setTimeout(() => {
                if (this.activeGames.has(jid)) {
                    const currentGame = this.activeGames.get(jid);
                    if (currentGame.type === 'quiz') {
                        this.sock.sendMessage(jid, { 
                            text: `⏰ Waktu habis!\nJawaban: *${currentGame.correctAnswer.toUpperCase()}*` 
                        });
                        this.activeGames.delete(jid);
                    }
                }
            }, 30000);
            
            return game;
            
        } catch (error) {
            console.error('Error starting quiz:', error);
            await this.sock.sendMessage(jid, { 
                text: '❌ Gagal memulai kuis. Coba lagi nanti!' 
            });
            return null;
        }
    }

    // 4) TRUTH OR DARE
    async getTruthOrDare(type) {
        try {
            if (type === 'truth') {
                const truths = [
                    "Apa rahasia terbesar yang belum pernah kamu ceritakan ke siapapun?",
                    "Kapan terakhir kali kamu menangis dan apa penyebabnya?",
                    "Apa hal paling memalukan yang pernah terjadi padamu di depan umum?",
                    "Siapa orang yang pernah kamu sakiti dan belum kamu minta maaf?",
                    "Apa kebohongan terbesar yang pernah kamu katakan kepada orang tuamu?"
                ];
                
                return { 
                    text: truths[Math.floor(Math.random() * truths.length)],
                    type: 'truth'
                };
                
            } else if (type === 'dare') {
                const joke = await this.fetchRandomJoke();
                
                return { 
                    text: `DARE: ${joke}\n\n⚡ Lakukan dalam 5 menit!`,
                    type: 'dare'
                };
            }
            
            return { text: 'Pilih truth atau dare!', type: 'unknown' };
            
        } catch (error) {
            console.error('Error getting truth/dare:', error);
            return { 
                text: type === 'truth' 
                    ? 'Apa makanan favoritmu yang paling aneh?' 
                    : 'Kirim sticker lucu ke grup ini!',
                type: type
            };
        }
    }

    // 5) TEBAK LAGU
    async startTebakLagu(jid) {
        try {
            // In real implementation, you would have audio snippets
            // For now, we'll simulate with text clues
            const songs = [
                { 
                    title: 'Indonesia Raya', 
                    clue: 'Lagu kebangsaan negara kita',
                    hint: 'Diciptakan oleh Wage Rudolf Supratman'
                },
                { 
                    title: 'Despacito', 
                    clue: 'Lagu latin yang viral di seluruh dunia',
                    hint: 'Dinyanyikan oleh Luis Fonsi'
                },
                { 
                    title: 'Bohemian Rhapsody', 
                    clue: 'Lagu legendaris dari band Queen',
                    hint: 'Ada bagian operanya'
                }
            ];
            
            const song = songs[Math.floor(Math.random() * songs.length)];
            
            const game = {
                type: 'tebak-lagu',
                title: song.title,
                answer: song.title.toLowerCase(),
                clue: song.clue,
                hint: song.hint,
                points: 150,
                startTime: Date.now(),
                timer: 40,
                hintUsed: false
            };
            
            this.activeGames.set(jid, game);
            
            const message = 
                `🎵 *TEBAK LAGU*\n\n` +
                `Clue: *${song.clue}*\n\n` +
                `⏰ Waktu: 40 detik\n` +
                `🏆 Poin: ${game.points}\n` +
                `💡 Ketik .hint untuk clue tambahan\n\n` +
                `Tebak judul lagu!`;
            
            await this.sock.sendMessage(jid, { text: message });
            
            // Set timer
            setTimeout(() => {
                if (this.activeGames.has(jid)) {
                    const currentGame = this.activeGames.get(jid);
                    if (currentGame.type === 'tebak-lagu') {
                        this.sock.sendMessage(jid, { 
                            text: `⏰ Waktu habis!\nJudul lagu: *${currentGame.title}*` 
                        });
                        this.activeGames.delete(jid);
                    }
                }
            }, 40000);
            
            return game;
            
        } catch (error) {
            console.error('Error starting tebak lagu:', error);
            await this.sock.sendMessage(jid, { 
                text: '❌ Gagal memulai game. Coba lagi nanti!' 
            });
            return null;
        }
    }

    // 6) TEBAK BENDERA
    async startTebakBendera(jid) {
        try {
            const country = await this.fetchRandomCountry();
            const flagEmoji = this.getFlagEmoji(country.code);
            
            const game = {
                type: 'tebak-bendera',
                country: country.name,
                answer: country.name.toLowerCase(),
                capital: country.capital,
                region: country.region,
                flagEmoji: flagEmoji,
                points: 100,
                startTime: Date.now(),
                timer: 30
            };
            
            this.activeGames.set(jid, game);
            
            const message = 
                `🇺🇳 *TEBAK BENDERA*\n\n` +
                `${flagEmoji} ${flagEmoji} ${flagEmoji}\n\n` +
                `💡 Clue:\n` +
                `• Ibu kota: ${country.capital}\n` +
                `• Region: ${country.region}\n\n` +
                `⏰ Waktu: 30 detik\n` +
                `🏆 Poin: ${game.points}\n\n` +
                `Negara apakah ini?`;
            
            await this.sock.sendMessage(jid, { text: message });
            
            // Set timer
            setTimeout(() => {
                if (this.activeGames.has(jid)) {
                    const currentGame = this.activeGames.get(jid);
                    if (currentGame.type === 'tebak-bendera') {
                        this.sock.sendMessage(jid, { 
                            text: `⏰ Waktu habis!\nNegara: *${currentGame.country.toUpperCase()}*` 
                        });
                        this.activeGames.delete(jid);
                    }
                }
            }, 30000);
            
            return game;
            
        } catch (error) {
            console.error('Error starting tebak bendera:', error);
            await this.sock.sendMessage(jid, { 
                text: '❌ Gagal memulai game. Coba lagi nanti!' 
            });
            return null;
        }
    }

    // 7) TEBAK EMOJI
    async startTebakEmoji(jid) {
        try {
            const emojiCombo = this.fallbackData.emojiCombos[
                Math.floor(Math.random() * this.fallbackData.emojiCombos.length)
            ];
            
            const game = {
                type: 'tebak-emoji',
                emoji: emojiCombo.emoji,
                answer: emojiCombo.meaning,
                points: 80,
                startTime: Date.now(),
                timer: 25,
                attempts: 0,
                maxAttempts: 3
            };
            
            this.activeGames.set(jid, game);
            
            const message = 
                `😊 *TEBAK EMOJI*\n\n` +
                `${emojiCombo.emoji}\n\n` +
                `⏰ Waktu: 25 detik\n` +
                `🎯 Kesempatan: 3 kali\n` +
                `🏆 Poin: ${game.points}\n\n` +
                `Apa arti dari kombinasi emoji di atas?`;
            
            await this.sock.sendMessage(jid, { text: message });
            
            // Set timer
            setTimeout(() => {
                if (this.activeGames.has(jid)) {
                    const currentGame = this.activeGames.get(jid);
                    if (currentGame.type === 'tebak-emoji') {
                        this.sock.sendMessage(jid, { 
                            text: `⏰ Waktu habis!\nArti: *${currentGame.answer.toUpperCase()}*` 
                        });
                        this.activeGames.delete(jid);
                    }
                }
            }, 25000);
            
            return game;
            
        } catch (error) {
            console.error('Error starting tebak emoji:', error);
            await this.sock.sendMessage(jid, { 
                text: '❌ Gagal memulai game. Coba lagi nanti!' 
            });
            return null;
        }
    }

    // 8) TEBAK LIRIK / SAMBUNG LIRIK
    async startTebakLirik(jid) {
        try {
            const lyricsData = await this.fetchLyrics();
            
            const game = {
                type: 'tebak-lirik',
                lyric: lyricsData.lyric,
                nextLine: lyricsData.nextLine,
                answer: lyricsData.nextLine.toLowerCase(),
                song: lyricsData.song,
                points: 120,
                startTime: Date.now(),
                timer: 35
            };
            
            this.activeGames.set(jid, game);
            
            const message = 
                `🎶 *SAM BUNG LIRIK*\n\n` +
                `Lanjutkan lirik berikut:\n\n` +
                `"${lyricsData.lyric}"\n\n` +
                `🎵 Lagu: ${lyricsData.song}\n` +
                `⏰ Waktu: 35 detik\n` +
                `🏆 Poin: ${game.points}\n\n` +
                `Lanjutkan liriknya!`;
            
            await this.sock.sendMessage(jid, { text: message });
            
            // Set timer
            setTimeout(() => {
                if (this.activeGames.has(jid)) {
                    const currentGame = this.activeGames.get(jid);
                    if (currentGame.type === 'tebak-lirik') {
                        this.sock.sendMessage(jid, { 
                            text: `⏰ Waktu habis!\nLanjutan: "${currentGame.nextLine}"` 
                        });
                        this.activeGames.delete(jid);
                    }
                }
            }, 35000);
            
            return game;
            
        } catch (error) {
            console.error('Error starting tebak lirik:', error);
            await this.sock.sendMessage(jid, { 
                text: '❌ Gagal memulai game. Coba lagi nanti!' 
            });
            return null;
        }
    }

    // 9) MATH BATTLE
    async startMathBattle(jid) {
        try {
            const operations = ['+', '-', '×', '÷'];
            const operation = operations[Math.floor(Math.random() * operations.length)];
            
            let num1, num2, answer;
            
            switch(operation) {
                case '+':
                    num1 = this.randomInt(10, 50);
                    num2 = this.randomInt(10, 50);
                    answer = num1 + num2;
                    break;
                case '-':
                    num1 = this.randomInt(50, 100);
                    num2 = this.randomInt(10, 49);
                    answer = num1 - num2;
                    break;
                case '×':
                    num1 = this.randomInt(2, 12);
                    num2 = this.randomInt(2, 12);
                    answer = num1 * num2;
                    break;
                case '÷':
                    num2 = this.randomInt(2, 10);
                    answer = this.randomInt(2, 10);
                    num1 = num2 * answer;
                    break;
            }
            
            const game = {
                type: 'math-battle',
                question: `${num1} ${operation} ${num2}`,
                answer: answer,
                points: 100,
                startTime: Date.now(),
                timer: 15,
                winner: null
            };
            
            this.activeGames.set(jid, game);
            
            const message = 
                `🧮 *MATH BATTLE*\n\n` +
                `${num1} ${operation} ${num2} = ?\n\n` +
                `⚡ *YANG CEPAT MENANG!*\n` +
                `⏰ Waktu: 15 detik\n` +
                `🏆 Poin: ${game.points}\n\n` +
                `Jawab sekarang!`;
            
            await this.sock.sendMessage(jid, { text: message });
            
            // Set timer
            setTimeout(() => {
                if (this.activeGames.has(jid)) {
                    const currentGame = this.activeGames.get(jid);
                    if (currentGame.type === 'math-battle' && !currentGame.winner) {
                        this.sock.sendMessage(jid, { 
                            text: `⏰ Waktu habis!\nJawaban: *${currentGame.answer}*` 
                        });
                        this.activeGames.delete(jid);
                    }
                }
            }, 15000);
            
            return game;
            
        } catch (error) {
            console.error('Error starting math battle:', error);
            await this.sock.sendMessage(jid, { 
                text: '❌ Gagal memulai game. Coba lagi nanti!' 
            });
            return null;
        }
    }

    // 10) SUIT (BATU GUNTING KERTAS)
    async playSuit(jid, playerChoice) {
        const choices = ['batu', 'gunting', 'kertas'];
        
        if (!choices.includes(playerChoice)) {
            return {
                valid: false,
                message: '❌ Pilihan tidak valid!\nGunakan: .suit [batu/gunting/kertas]'
            };
        }
        
        const botChoice = choices[Math.floor(Math.random() * 3)];
        
        let result, winner;
        
        if (playerChoice === botChoice) {
            result = 'SERI! 🤝';
            winner = 'draw';
        } else if (
            (playerChoice === 'batu' && botChoice === 'gunting') ||
            (playerChoice === 'gunting' && botChoice === 'kertas') ||
            (playerChoice === 'kertas' && botChoice === 'batu')
        ) {
            result = 'KAMU MENANG! 🎉';
            winner = 'player';
        } else {
            result = 'BOT MENANG! 🤖';
            winner = 'bot';
        }
        
        const emojiMap = {
            'batu': '✊',
            'gunting': '✌️',
            'kertas': '✋'
        };
        
        const message = 
            `✊✌️✋ *SUIT*\n\n` +
            `Kamu: ${emojiMap[playerChoice]} ${playerChoice}\n` +
            `Bot: ${emojiMap[botChoice]} ${botChoice}\n\n` +
            `🏆 ${result}\n\n` +
            `Main lagi? .suit [batu/gunting/kertas]`;
        
        return {
            valid: true,
            message: message,
            winner: winner,
            playerChoice: playerChoice,
            botChoice: botChoice
        };
    }

    // 11) TEBAK ANGKA
    async startTebakAngka(jid) {
        try {
            const number = this.randomInt(1, 100);
            
            const game = {
                type: 'tebak-angka',
                number: number,
                attempts: 0,
                maxAttempts: 10,
                points: 200,
                startTime: Date.now(),
                lastGuess: null,
                range: [1, 100]
            };
            
            this.activeGames.set(jid, game);
            
            const message = 
                `🔢 *TEBAK ANGKA*\n\n` +
                `Saya memilih angka antara 1-100\n` +
                `🎯 Tebak angka saya!\n` +
                `💡 Saya akan kasih petunjuk\n` +
                `🏆 Poin: ${game.points}\n` +
                `📊 Kesempatan: ${game.maxAttempts} kali\n\n` +
                `Mulai menebak!`;
            
            await this.sock.sendMessage(jid, { text: message });
            
            return game;
            
        } catch (error) {
            console.error('Error starting tebak angka:', error);
            await this.sock.sendMessage(jid, { 
                text: '❌ Gagal memulai game. Coba lagi nanti!' 
            });
            return null;
        }
    }

    // 12) HINT SYSTEM
    getHint(game) {
        if (!game) return 'Tidak ada game yang aktif!';
        
        switch(game.type) {
            case 'tebak-kata':
                const firstLetter = game.kata[0].toUpperCase();
                const lastLetter = game.kata[game.kata.length - 1].toUpperCase();
                return `💡 Huruf pertama: ${firstLetter}, Huruf terakhir: ${lastLetter}`;
                
            case 'tebak-gambar':
                if (game.hintUsed) {
                    return `💡 Jawaban dimulai dengan huruf: ${game.answer[0].toUpperCase()}`;
                }
                game.hintUsed = true;
                return `💡 Kategori: ${game.keyword.toUpperCase()}`;
                
            case 'tebak-lagu':
                if (game.hintUsed) {
                    return `💡 Jawaban terdiri dari ${game.title.split(' ').length} kata`;
                }
                game.hintUsed = true;
                return `💡 ${game.hint}`;
                
            case 'tebak-bendera':
                return `💡 Negara ini berada di benua ${game.region}`;
                
            case 'tebak-emoji':
                const words = game.answer.split(' ');
                return `💡 Terdiri dari ${words.length} kata`;
                
            case 'tebak-lirik':
                const wordsCount = game.nextLine.split(' ').length;
                return `💡 Lanjutan terdiri dari ${wordsCount} kata`;
                
            case 'tebak-angka':
                const mid = Math.floor((game.range[0] + game.range[1]) / 2);
                return `💡 Angka berada di antara ${game.range[0]} dan ${game.range[1]}`;
                
            case 'quiz':
                const correctIndex = game.options.findIndex(
                    opt => opt.toLowerCase() === game.correctAnswer
                );
                const letter = String.fromCharCode(65 + correctIndex);
                return `💡 Jawaban yang benar adalah pilihan ${letter}`;
                
            default:
                return 'Tidak ada hint tersedia untuk game ini';
        }
    }

    // ==================== GAME LOGIC METHODS ====================

    // Check answer for active game
    checkAnswer(game, userAnswer) {
        if (!game || !userAnswer) return false;
        
        const answer = userAnswer.toLowerCase().trim();
        
        switch(game.type) {
            case 'tebak-kata':
                return answer === game.answer;
                
            case 'tebak-gambar':
                return answer === game.answer;
                
            case 'quiz':
                // Check letter answer (A, B, C, D)
                const letter = answer.toUpperCase();
                if (['A', 'B', 'C', 'D'].includes(letter)) {
                    const idx = letter.charCodeAt(0) - 65;
                    return game.options[idx]?.toLowerCase() === game.correctAnswer;
                }
                // Check text answer
                return answer === game.correctAnswer;
                
            case 'tebak-lagu':
                return answer === game.answer;
                
            case 'tebak-bendera':
                return answer === game.answer;
                
            case 'tebak-emoji':
                return answer === game.answer;
                
            case 'tebak-lirik':
                return answer === game.answer;
                
            case 'math-battle':
                const numAnswer = parseInt(answer);
                return !isNaN(numAnswer) && numAnswer === game.answer;
                
            case 'tebak-angka':
                const guess = parseInt(answer);
                if (isNaN(guess)) return false;
                
                game.attempts++;
                game.lastGuess = guess;
                
                if (guess < game.number) {
                    game.range[0] = Math.max(game.range[0], guess + 1);
                } else if (guess > game.number) {
                    game.range[1] = Math.min(game.range[1], guess - 1);
                }
                
                return guess === game.number;
                
            default:
                return false;
        }
    }

    // Calculate points based on difficulty
    calculateQuizPoints(difficulty) {
        const points = {
            'easy': 50,
            'medium': 100,
            'hard': 150
        };
        return points[difficulty] || 100;
    }

    // Process game response
    async processGameResponse(jid, userId, userAnswer, rpgSystem) {
        const game = this.activeGames.get(jid);
        if (!game) return null;
        
        const isCorrect = this.checkAnswer(game, userAnswer);
        
        if (isCorrect) {
            // Give rewards
            const coinsEarned = game.points || 50;
            const expEarned = Math.floor(coinsEarned / 10);
            
            if (rpgSystem) {
                await rpgSystem.addCoins(userId, coinsEarned);
                await rpgSystem.addExp(userId, expEarned);
            }
            
            let victoryMessage = `✅ *BENAR!*\n\n🏆 +${coinsEarned} coins\n⭐ +${expEarned} EXP\n\n🎉 Selamat!`;
            
            // Type-specific victory messages
            switch(game.type) {
                case 'tebak-kata':
                    victoryMessage += `\nKata: *${game.kata.toUpperCase()}*`;
                    break;
                case 'tebak-angka':
                    victoryMessage += `\nAngka: *${game.number}* (${game.attempts} tebakan)`;
                    break;
                case 'math-battle':
                    victoryMessage += `\nJawaban: *${game.answer}*`;
                    game.winner = userId;
                    break;
            }
            
            this.activeGames.delete(jid);
            return {
                success: true,
                message: victoryMessage,
                coins: coinsEarned,
                exp: expEarned
            };
            
        } else {
            // Wrong answer handling
            let response = '❌ Salah! Coba lagi.';
            
            switch(game.type) {
                case 'tebak-angka':
                    if (game.lastGuess) {
                        const hint = game.lastGuess < game.number ? 'KECIL' : 'BESAR';
                        response = `📉 Tebakanmu terlalu ${hint}!\nRange: ${game.range[0]}-${game.range[1]}\nSisa: ${game.maxAttempts - game.attempts} tebakan`;
                        
                        if (game.attempts >= game.maxAttempts) {
                            response = `💀 GAME OVER!\nAngka: *${game.number}*\n${game.attempts} tebakan digunakan`;
                            this.activeGames.delete(jid);
                        }
                    }
                    break;
                    
                case 'tebak-kata':
                    game.attempts++;
                    if (game.attempts >= game.maxAttempts) {
                        response = `💀 GAME OVER!\nKata: *${game.kata.toUpperCase()}*`;
                        this.activeGames.delete(jid);
                    } else {
                        response = `❌ Salah! Sisa: ${game.maxAttempts - game.attempts} kesempatan`;
                    }
                    break;
            }
            
            return {
                success: false,
                message: response,
                attempts: game.attempts,
                maxAttempts: game.maxAttempts
            };
        }
    }

    // ==================== FALLBACK GENERATORS ====================

    generateFallbackTrivia() {
        const fallbackQuestions = [
            {
                question: "Ibu kota Indonesia adalah?",
                correctAnswer: "Jakarta",
                allAnswers: ["Jakarta", "Bandung", "Surabaya", "Medan"],
                category: "Geografi",
                difficulty: "easy"
            },
            {
                question: "Planet terbesar di tata surya?",
                correctAnswer: "Jupiter",
                allAnswers: ["Jupiter", "Saturnus", "Bumi", "Mars"],
                category: "Astronomi",
                difficulty: "medium"
            },
            {
                question: "Warna campuran merah dan biru?",
                correctAnswer: "Ungu",
                allAnswers: ["Ungu", "Hijau", "Kuning", "Orange"],
                category: "Seni",
                difficulty: "easy"
            }
        ];
        
        return fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
    }

    generateFallbackLyrics() {
        const lyricsList = [
            {
                lyric: "Kulihat awan di langit",
                nextLine: "Semakin biru di pagi hari",
                song: "Gelora Asmara"
            },
            {
                lyric: "Bintang kejora",
                nextLine: "Di langit yang tinggi",
                song: "Bintang Kejora"
            },
            {
                lyric: "Halo-halo Bandung",
                nextLine: "Ibu kota periangan",
                song: "Halo-Halo Bandung"
            }
        ];
        
        return lyricsList[Math.floor(Math.random() * lyricsList.length)];
    }

    // ==================== GETTER METHODS ====================

    getGame(jid) {
        return this.activeGames.get(jid);
    }

    hasActiveGame(jid) {
        return this.activeGames.has(jid);
    }

    removeGame(jid) {
        this.activeGames.delete(jid);
    }

    getAllActiveGames() {
        return Array.from(this.activeGames.entries());
    }

    // ==================== ADMIN METHODS ====================

    async forceEndGame(jid, reason = 'Game dihentikan oleh sistem') {
        if (this.activeGames.has(jid)) {
            const game = this.activeGames.get(jid);
            await this.sock.sendMessage(jid, { 
                text: `🛑 *GAME DIHENTIKAN*\n\n${reason}\n\nTipe: ${game.type}` 
            });
            this.activeGames.delete(jid);
            return true;
        }
        return false;
    }

    async listActiveGames(jid) {
        const games = this.getAllActiveGames();
        if (games.length === 0) {
            await this.sock.sendMessage(jid, { text: 'Tidak ada game yang aktif.' });
            return;
        }
        
        let list = `🎮 *GAME AKTIF* (${games.length})\n\n`;
        
        games.forEach(([gameJid, game], index) => {
            const timeElapsed = Math.floor((Date.now() - game.startTime) / 1000);
            list += `${index + 1}. ${game.type.toUpperCase()}\n`;
            list += `   ⏰ ${timeElapsed}s | 🎯 ${game.points} poin\n`;
            if (game.type === 'tebak-angka') {
                list += `   🔢 ${game.attempts}/${game.maxAttempts} tebakan\n`;
            }
            list += `   📍 ${gameJid}\n\n`;
        });
        
        await this.sock.sendMessage(jid, { text: list });
    }
}

export default GameSystem;