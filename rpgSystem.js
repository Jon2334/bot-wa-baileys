// rpgSystem.js
import { MongoClient } from 'mongodb';

class RPGSystem {
    constructor() {
        this.uri = process.env.MONGODB_URI;
        this.dbName = 'whatsapp_bot_rpg';
        this.client = null;
        this.db = null;
        this.cooldowns = new Map();
    }

    async connect() {
        if (!this.client) {
            this.client = new MongoClient(this.uri);
            await this.client.connect();
            this.db = this.client.db(this.dbName);
            console.log('✅ Connected to RPG MongoDB');
        }
        return this.db;
    }

    async getUser(userId) {
        const db = await this.connect();
        const users = db.collection('users');
        
        let user = await users.findOne({ userId });
        
        if (!user) {
            // Create new user
            user = {
                userId,
                username: `User_${userId.substring(0, 5)}`,
                level: 1,
                exp: 0,
                expNeeded: 100,
                coins: 100,
                dailyStreak: 0,
                lastDaily: null,
                lastWork: null,
                lastHunt: null,
                inventory: [],
                pet: null,
                stats: {
                    gamesWon: 0,
                    gamesPlayed: 0,
                    totalCoins: 100
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            await users.insertOne(user);
        }
        
        return user;
    }

    async updateUser(userId, updates) {
        const db = await this.connect();
        const users = db.collection('users');
        
        updates.updatedAt = new Date();
        await users.updateOne(
            { userId },
            { $set: updates }
        );
        
        return await this.getUser(userId);
    }

    async addCoins(userId, amount) {
        const user = await this.getUser(userId);
        const newCoins = user.coins + amount;
        
        await this.updateUser(userId, {
            coins: newCoins,
            'stats.totalCoins': user.stats.totalCoins + amount
        });
        
        return newCoins;
    }

    async addExp(userId, exp) {
        const user = await this.getUser(userId);
        let newExp = user.exp + exp;
        let newLevel = user.level;
        let levelUp = false;
        
        while (newExp >= user.expNeeded) {
            newExp -= user.expNeeded;
            newLevel++;
            levelUp = true;
            user.expNeeded = Math.floor(user.expNeeded * 1.5);
        }
        
        await this.updateUser(userId, {
            exp: newExp,
            level: newLevel,
            expNeeded: user.expNeeded
        });
        
        return { levelUp, newLevel, newExp };
    }

    async claimDaily(userId) {
        const user = await this.getUser(userId);
        const now = new Date();
        const lastDaily = user.lastDaily ? new Date(user.lastDaily) : null;
        
        // Check cooldown
        if (lastDaily) {
            const diffHours = (now - lastDaily) / (1000 * 60 * 60);
            if (diffHours < 24) {
                const hoursLeft = Math.ceil(24 - diffHours);
                return { success: false, hoursLeft };
            }
        }
        
        // Calculate streak
        let newStreak = user.dailyStreak;
        if (lastDaily) {
            const diffDays = Math.floor((now - lastDaily) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                newStreak++;
            } else if (diffDays > 1) {
                newStreak = 1;
            }
        } else {
            newStreak = 1;
        }
        
        // Calculate reward
        const baseReward = 100;
        const streakBonus = Math.min(newStreak * 10, 100);
        const totalReward = baseReward + streakBonus;
        
        // Update user
        await this.addCoins(userId, totalReward);
        await this.addExp(userId, 50);
        
        await this.updateUser(userId, {
            dailyStreak: newStreak,
            lastDaily: now
        });
        
        return {
            success: true,
            coins: totalReward,
            streak: newStreak,
            exp: 50
        };
    }

    async work(userId) {
        const user = await this.getUser(userId);
        const now = new Date();
        const lastWork = user.lastWork ? new Date(user.lastWork) : null;
        
        // Check cooldown (5 minutes)
        if (lastWork) {
            const diffMinutes = (now - lastWork) / (1000 * 60);
            if (diffMinutes < 5) {
                const minutesLeft = Math.ceil(5 - diffMinutes);
                return { success: false, minutesLeft };
            }
        }
        
        // Calculate earnings
        const baseEarning = 50 + (user.level * 10);
        const coinsEarned = Math.floor(Math.random() * baseEarning) + baseEarning;
        const expEarned = Math.floor(coinsEarned / 10);
        
        // Update user
        await this.addCoins(userId, coinsEarned);
        await this.addExp(userId, expEarned);
        
        await this.updateUser(userId, {
            lastWork: now
        });
        
        return {
            success: true,
            coins: coinsEarned,
            exp: expEarned,
            job: this.getRandomJob()
        };
    }

    async hunt(userId) {
        const user = await this.getUser(userId);
        const now = new Date();
        const lastHunt = user.lastHunt ? new Date(user.lastHunt) : null;
        
        // Check cooldown (10 minutes)
        if (lastHunt) {
            const diffMinutes = (now - lastHunt) / (1000 * 60);
            if (diffMinutes < 10) {
                const minutesLeft = Math.ceil(10 - diffMinutes);
                return { success: false, minutesLeft };
            }
        }
        
        // Hunting results
        const successRate = 0.7; // 70% success
        const isSuccess = Math.random() < successRate;
        
        if (isSuccess) {
            const items = [
                { name: '🐰 Kelinci', value: 30 },
                { name: '🦌 Rusa', value: 50 },
                { name: '🐗 Babi Hutan', value: 80 },
                { name: '🐉 Naga Mini', value: 150, rare: true }
            ];
            
            const item = Math.random() < 0.1 ? items[3] : // 10% rare
                        items[Math.floor(Math.random() * 3)];
            
            // Add to inventory
            const inventory = [...user.inventory, item];
            
            // Calculate coins
            const coinsEarned = item.value;
            const expEarned = Math.floor(coinsEarned / 5);
            
            await this.addCoins(userId, coinsEarned);
            await this.addExp(userId, expEarned);
            
            await this.updateUser(userId, {
                lastHunt: now,
                inventory: inventory
            });
            
            return {
                success: true,
                caught: true,
                item: item.name,
                coins: coinsEarned,
                exp: expEarned,
                rare: item.rare || false
            };
        } else {
            await this.updateUser(userId, {
                lastHunt: now
            });
            
            return {
                success: true,
                caught: false,
                message: 'Kamu tidak mendapatkan apa-apa!'
            };
        }
    }

    async fight(player1Id, player2Id) {
        const player1 = await this.getUser(player1Id);
        const player2 = await this.getUser(player2Id);
        
        // Calculate win chance based on level
        const p1Power = player1.level + (player1.coins / 1000);
        const p2Power = player2.level + (player2.coins / 1000);
        const totalPower = p1Power + p2Power;
        
        const p1WinChance = p1Power / totalPower;
        const p1Wins = Math.random() < p1WinChance;
        
        const winnerId = p1Wins ? player1Id : player2Id;
        const loserId = p1Wins ? player2Id : player1Id;
        
        const betAmount = 50;
        
        // Transfer coins
        await this.addCoins(winnerId, betAmount);
        await this.addCoins(loserId, -betAmount);
        
        // Add exp
        await this.addExp(winnerId, 30);
        await this.addExp(loserId, 10);
        
        // Update stats
        const winner = await this.getUser(winnerId);
        const loser = await this.getUser(loserId);
        
        await this.updateUser(winnerId, {
            'stats.gamesWon': winner.stats.gamesWon + 1,
            'stats.gamesPlayed': winner.stats.gamesPlayed + 1
        });
        
        await this.updateUser(loserId, {
            'stats.gamesPlayed': loser.stats.gamesPlayed + 1
        });
        
        return {
            winner: winnerId,
            loser: loserId,
            coins: betAmount,
            exp: { winner: 30, loser: 10 }
        };
    }

    async getLeaderboard(type = 'coins', limit = 10) {
        const db = await this.connect();
        const users = db.collection('users');
        
        let sortField = '';
        switch(type) {
            case 'coins': sortField = 'coins'; break;
            case 'level': sortField = 'level'; break;
            case 'streak': sortField = 'dailyStreak'; break;
            default: sortField = 'coins';
        }
        
        const topUsers = await users.find({})
            .sort({ [sortField]: -1 })
            .limit(limit)
            .toArray();
        
        return topUsers.map((user, index) => ({
            rank: index + 1,
            username: user.username,
            userId: user.userId,
            coins: user.coins,
            level: user.level,
            streak: user.dailyStreak
        }));
    }

    getRandomJob() {
        const jobs = [
            '💼 Kasir',
            '👨‍🍳 Koki',
            '👨‍💻 Programmer',
            '👷 Buruh',
            '👨‍🏫 Guru',
            '👨‍⚕️ Dokter',
            '🚒 Pemadam Kebakaran',
            '👮 Polisi'
        ];
        return jobs[Math.floor(Math.random() * jobs.length)];
    }

    async getProfile(userId) {
        const user = await this.getUser(userId);
        
        const profile = {
            username: user.username,
            level: user.level,
            exp: user.exp,
            expNeeded: user.expNeeded,
            expPercent: Math.floor((user.exp / user.expNeeded) * 100),
            coins: user.coins,
            dailyStreak: user.dailyStreak,
            stats: user.stats,
            pet: user.pet,
            inventoryCount: user.inventory.length
        };
        
        return profile;
    }
}

export default RPGSystem;