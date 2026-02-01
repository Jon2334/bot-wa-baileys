// gameSystem.js
import axios from 'axios';

const GAME_API_BASE = 'https://your-game-api.com'; // Ganti dengan API Anda

class GameSystem {
    constructor(sock) {
        this.sock = sock;
        this.activeGames = new Map();
    }

    // 1) Tebak Kata / Susun Kata
    async startTebakKata(jid) {
        try {
            const response = await axios.get(`${GAME_API_BASE}/game/tebak-kata`);
            const gameData = response.data;
            
            const game = {
                type: 'tebak-kata',
                kata: gameData.kata,
                kataAcak: gameData.kata_acak,
                answer: gameData.answer,
                timer: 30,
                attempts: 3,
                score: 100,
                startTime: Date.now(),
                players: new Map()
            };
            
            this.activeGames.set(jid, game);
            
            const message = 
                `🎮 *TEBAK KATA*\n\n` +
                `Susun kata: *${gameData.kata_acak}*\n\n` +
                `⏰ Waktu: 30 detik\n` +
                `🎯 Kesempatan: 3 kali\n` +
                `🏆 Poin: 100\n\n` +
                `Ketik jawabanmu sekarang!`;
            
            await this.sock.sendMessage(jid, { text: message });
            
            // Start timer
            setTimeout(() => {
                if (this.activeGames.has(jid)) {
                    this.endGame(jid, '⏰ Waktu habis! Game berakhir.');
                }
            }, 30000);
            
            return game;
        } catch (error) {
            console.error('Error starting tebak kata:', error);
            return null;
        }
    }

    // 2) Tebak Gambar
    async startTebakGambar(jid, difficulty = 'easy') {
        try {
            const response = await axios.get(`${GAME_API_BASE}/game/tebak-gambar?mode=${difficulty}`);
            const gameData = response.data;
            
            const game = {
                type: 'tebak-gambar',
                imageUrl: gameData.image_url,
                answer: gameData.answer,
                hint: gameData.hint,
                points: difficulty === 'easy' ? 50 : difficulty === 'medium' ? 100 : 150,
                startTime: Date.now(),
                players: new Map()
            };
            
            this.activeGames.set(jid, game);
            
            // Download and send image
            const imageBuffer = await this.downloadMedia(gameData.image_url);
            
            const message = 
                `🖼️ *TEBAK GAMBAR*\n\n` +
                `Mode: ${difficulty.toUpperCase()}\n` +
                `🏆 Poin: ${game.points}\n\n` +
                `Apa yang ada di gambar ini?\n` +
                `💡 Hint: ${gameData.hint}`;
            
            await this.sock.sendMessage(jid, {
                image: imageBuffer,
                caption: message
            });
            
            return game;
        } catch (error) {
            console.error('Error starting tebak gambar:', error);
            return null;
        }
    }

    // 3) Quiz / Kuis Cepat
    async startQuiz(jid, category = 'random') {
        try {
            const response = await axios.get(`${GAME_API_BASE}/game/quiz?category=${category}`);
            const quizData = response.data;
            
            const game = {
                type: 'quiz',
                question: quizData.question,
                options: quizData.options,
                answer: quizData.answer,
                timeLimit: 30,
                points: quizData.points || 100,
                startTime: Date.now(),
                answered: new Set()
            };
            
            this.activeGames.set(jid, game);
            
            const optionsText = quizData.options.map((opt, idx) => 
                `${String.fromCharCode(65 + idx)}. ${opt}`
            ).join('\n');
            
            const message = 
                `📚 *KUIS*\n\n` +
                `${quizData.question}\n\n` +
                `${optionsText}\n\n` +
                `⏰ Waktu: 30 detik\n` +
                `🏆 Poin: ${game.points}\n\n` +
                `Jawab dengan huruf (A/B/C/D)`;
            
            await this.sock.sendMessage(jid, { text: message });
            
            setTimeout(() => {
                if (this.activeGames.has(jid)) {
                    this.endGame(jid, `⏰ Waktu habis!\nJawaban: ${quizData.answer}`);
                }
            }, 30000);
            
            return game;
        } catch (error) {
            console.error('Error starting quiz:', error);
            return null;
        }
    }

    // 4) Truth or Dare
    async getTruthOrDare(type) {
        try {
            const response = await axios.get(`${GAME_API_BASE}/game/${type}`);
            return response.data;
        } catch (error) {
            // Fallback
            const fallback = {
                truth: [
                    "Apa rahasia terbesar yang belum pernah kamu ceritakan?",
                    "Kapan terakhir kali kamu menangis dan kenapa?",
                    "Apa hal paling memalukan yang pernah terjadi padamu?"
                ],
                dare: [
                    "Kirim voice note menyanyikan lagu anak-anak!",
                    "Ganti foto profil WA selama 1 jam!",
                    "Telepon kontak terakhir di HP selama 30 detik!"
                ]
            };
            const data = fallback[type];
            return { text: data[Math.floor(Math.random() * data.length)] };
        }
    }

    // 5) Tebak Lagu
    async startTebakLagu(jid) {
        try {
            const response = await axios.get(`${GAME_API_BASE}/game/tebak-lagu`);
            const songData = response.data;
            
            const game = {
                type: 'tebak-lagu',
                audioUrl: songData.audio_url,
                answer: songData.answer,
                hint: songData.hint,
                points: 150,
                startTime: Date.now(),
                usedHint: false
            };
            
            this.activeGames.set(jid, game);
            
            // Download and send audio
            const audioBuffer = await this.downloadMedia(songData.audio_url);
            
            const message = 
                `🎵 *TEBAK LAGU*\n\n` +
                `Putar audio berikut dan tebak judul lagunya!\n` +
                `🏆 Poin: ${game.points}\n` +
                `💡 Ketik .hint untuk mendapatkan clue`;
            
            await this.sock.sendMessage(jid, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                caption: message
            });
            
            return game;
        } catch (error) {
            console.error('Error starting tebak lagu:', error);
            return null;
        }
    }

    // 6) Tebak Bendera
    async startTebakBendera(jid) {
        try {
            const response = await axios.get(`${GAME_API_BASE}/game/tebak-bendera`);
            const flagData = response.data;
            
            const game = {
                type: 'tebak-bendera',
                flagUrl: flagData.flag_url,
                answer: flagData.country,
                clue: flagData.clue,
                points: 100,
                startTime: Date.now()
            };
            
            this.activeGames.set(jid, game);
            
            // Download and send flag image
            const imageBuffer = await this.downloadMedia(flagData.flag_url);
            
            const message = 
                `🇺🇳 *TEBAK BENDERA*\n\n` +
                `Negara apakah ini?\n` +
                `💡 Clue: ${flagData.clue}\n` +
                `🏆 Poin: ${game.points}`;
            
            await this.sock.sendMessage(jid, {
                image: imageBuffer,
                caption: message
            });
            
            return game;
        } catch (error) {
            console.error('Error starting tebak bendera:', error);
            return null;
        }
    }

    // 7) Tebak Emoji
    async startTebakEmoji(jid) {
        try {
            const response = await axios.get(`${GAME_API_BASE}/game/tebak-emoji`);
            const emojiData = response.data;
            
            const game = {
                type: 'tebak-emoji',
                emoji: emojiData.emoji,
                answer: emojiData.answer,
                points: 80,
                startTime: Date.now()
            };
            
            this.activeGames.set(jid, game);
            
            const message = 
                `😊 *TEBAK EMOJI*\n\n` +
                `${emojiData.emoji}\n\n` +
                `Apa arti dari emoji di atas?\n` +
                `🏆 Poin: ${game.points}`;
            
            await this.sock.sendMessage(jid, { text: message });
            
            return game;
        } catch (error) {
            console.error('Error starting tebak emoji:', error);
            return null;
        }
    }

    // 8) Tebak Lirik / Sambung Lirik
    async startTebakLirik(jid) {
        try {
            const response = await axios.get(`${GAME_API_BASE}/game/tebak-lirik`);
            const lyricData = response.data;
            
            const game = {
                type: 'tebak-lirik',
                lyric: lyricData.lyric,
                answer: lyricData.next_line,
                song: lyricData.song,
                points: 120,
                startTime: Date.now()
            };
            
            this.activeGames.set(jid, game);
            
            const message = 
                `🎶 *SAM BUNG LIRIK*\n\n` +
                `Lanjutkan lirik berikut:\n\n` +
                `"${lyricData.lyric}"\n\n` +
                `🏆 Poin: ${game.points}\n` +
                `🎵 Lagu: ${lyricData.song}`;
            
            await this.sock.sendMessage(jid, { text: message });
            
            return game;
        } catch (error) {
            console.error('Error starting tebak lirik:', error);
            return null;
        }
    }

    // 9) Math Battle
    async startMathBattle(jid) {
        try {
            const response = await axios.get(`${GAME_API_BASE}/game/math-battle`);
            const mathData = response.data;
            
            const game = {
                type: 'math-battle',
                question: mathData.question,
                answer: mathData.answer,
                points: mathData.points || 100,
                startTime: Date.now(),
                winner: null
            };
            
            this.activeGames.set(jid, game);
            
            const message = 
                `🧮 *MATH BATTLE*\n\n` +
                `${mathData.question}\n\n` +
                `🏆 Poin: ${game.points}\n` +
                `⚡ Yang cepat yang dapat poin!`;
            
            await this.sock.sendMessage(jid, { text: message });
            
            setTimeout(() => {
                if (this.activeGames.has(jid) && !game.winner) {
                    this.endGame(jid, `⏰ Waktu habis!\nJawaban: ${mathData.answer}`);
                }
            }, 15000);
            
            return game;
        } catch (error) {
            console.error('Error starting math battle:', error);
            return null;
        }
    }

    // 10) Suit (Batu Gunting Kertas)
    async playSuit(jid, playerChoice) {
        const choices = ['batu', 'gunting', 'kertas'];
        const botChoice = choices[Math.floor(Math.random() * 3)];
        
        let result = '';
        let winner = '';
        
        if (playerChoice === botChoice) {
            result = 'SERI!';
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
        
        const message = 
            `✊✌️✋ *SUIT*\n\n` +
            `Kamu: ${this.getSuitEmoji(playerChoice)}\n` +
            `Bot: ${this.getSuitEmoji(botChoice)}\n\n` +
            `🏆 ${result}\n\n` +
            `Main lagi? .suit [batu/gunting/kertas]`;
        
        return { message, winner, botChoice };
    }
    
    getSuitEmoji(choice) {
        switch(choice) {
            case 'batu': return '✊ Batu';
            case 'gunting': return '✌️ Gunting';
            case 'kertas': return '✋ Kertas';
            default: return '❓';
        }
    }

    // 11) Tebak Angka
    async startTebakAngka(jid) {
        const number = Math.floor(Math.random() * 100) + 1;
        
        const game = {
            type: 'tebak-angka',
            number: number,
            attempts: 0,
            maxAttempts: 10,
            points: 200,
            startTime: Date.now(),
            hints: []
        };
        
        this.activeGames.set(jid, game);
        
        const message = 
            `🔢 *TEBAK ANGKA*\n\n` +
            `Saya memilih angka antara 1-100\n` +
            `🎯 Tebak angka saya!\n` +
            `💡 Saya akan kasih petunjuk\n` +
            `🏆 Poin: ${game.points}\n` +
            `📊 Kesempatan: ${game.maxAttempts} kali`;
        
        await this.sock.sendMessage(jid, { text: message });
        
        return game;
    }

    // Helper Methods
    async downloadMedia(url) {
        try {
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'arraybuffer',
                timeout: 30000
            });
            return Buffer.from(response.data);
        } catch (error) {
            throw new Error(`Failed to download media: ${error.message}`);
        }
    }

    checkAnswer(game, answer) {
        switch(game.type) {
            case 'tebak-kata':
                return answer.toLowerCase() === game.answer.toLowerCase();
            case 'tebak-gambar':
                return answer.toLowerCase() === game.answer.toLowerCase();
            case 'quiz':
                // Check for letter or full answer
                const letter = answer.toUpperCase();
                if (['A','B','C','D'].includes(letter)) {
                    const idx = letter.charCodeAt(0) - 65;
                    return game.options[idx].toLowerCase() === game.answer.toLowerCase();
                }
                return answer.toLowerCase() === game.answer.toLowerCase();
            case 'tebak-lagu':
                return answer.toLowerCase() === game.answer.toLowerCase();
            case 'tebak-bendera':
                return answer.toLowerCase() === game.country.toLowerCase();
            case 'tebak-emoji':
                return answer.toLowerCase() === game.answer.toLowerCase();
            case 'tebak-lirik':
                return answer.toLowerCase() === game.answer.toLowerCase();
            case 'math-battle':
                return parseInt(answer) === game.answer;
            case 'tebak-angka':
                const guess = parseInt(answer);
                if (isNaN(guess)) return false;
                return guess === game.number;
            default:
                return false;
        }
    }

    getHint(game) {
        switch(game.type) {
            case 'tebak-kata':
                const kata = game.kata;
                const hint = kata.substring(0, Math.ceil(kata.length / 2)) + '...';
                return `💡 Hint: ${hint}`;
            case 'tebak-gambar':
                return game.hint;
            case 'tebak-lagu':
                return game.hint;
            case 'tebak-bendera':
                return game.clue;
            default:
                return 'Tidak ada hint untuk game ini';
        }
    }

    async endGame(jid, message) {
        if (this.activeGames.has(jid)) {
            await this.sock.sendMessage(jid, { text: message });
            this.activeGames.delete(jid);
        }
    }

    getGame(jid) {
        return this.activeGames.get(jid);
    }

    removeGame(jid) {
        this.activeGames.delete(jid);
    }
}

export default GameSystem;