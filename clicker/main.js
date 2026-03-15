import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, orderBy, limit, onSnapshot, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

const BOSS_MAINTENANCE = false; 
const OFFLINE_MODE = localStorage.getItem('dev_offline_mode') === 'true';

// ==========================================
// 🛡️ ANTI-CHEAT: HASH GENERÁTOR
// ==========================================
const SECRET_SALT = "sigma_chad_unbreakable_2026_v5";

function generateHash(dataStr) {
    let hash = 0;
    for (let i = 0; i < dataStr.length; i++) {
        hash = Math.imul(31, hash) + dataStr.charCodeAt(i) | 0;
    }
    return hash + SECRET_SALT;
}

function saveGameData() {
    localStorage.setItem('meme_clicker_backup_total', game.totalScore);
    const str = JSON.stringify(game);
    const hash = generateHash(str);
    const payload = { d: str, h: hash };
    // Bezpečné uložení do Base64 bez rozbíjení znaků
    localStorage.setItem('meme_clicker_fb', btoa(encodeURIComponent(JSON.stringify(payload))));
}
// ==========================================

let cheatBuffer = "";
document.addEventListener('keydown', (e) => {
    if (e.key.length > 1) return; 
    
    cheatBuffer += e.key.toLowerCase();
    if (cheatBuffer.length > 20) cheatBuffer = cheatBuffer.substring(cheatBuffer.length - 20);

    if (cheatBuffer.includes('hesoyam')) {
        cheatBuffer = "";
        window.cheatActive = true; 
        
        let boost = 1000000000000000;
        game.score += boost; window._AC.s += boost;
        game.totalScore += boost; window._AC.t += boost;
        game.ascend.points += 100000;
        if (game.boss) game.boss.money += 100000000;
        
        playSound('ascend');
        showToast("🤑 HESOYAM AKTIVOVÁN! Účet nabuffován.");
        updateUI();
        if (typeof updateBossUI === 'function') updateBossUI();
        saveGameData();
    }

    if (cheatBuffer.includes('killboss')) {
        cheatBuffer = "";
        if (game.bossUnlocked && globalBoss) {
            let massiveDmg = globalBoss.maxHp;
            pendingBossDamage += massiveDmg;
            
            if(game.boss) {
                game.boss.totalDmg = (game.boss.totalDmg || 0) + massiveDmg;
                game.boss.currentBossDmg = (game.boss.currentBossDmg || 0) + massiveDmg;
            }
            
            playSound('crit');
            showToast("💀 KILLBOSS AKTIVOVÁN! Insta-DMG odesláno.");
            updateBossUI();
        } else {
            showToast("Boss ještě není odemčený!");
        }
    }

    if (cheatBuffer.includes('aezakmi')) {
        cheatBuffer = "";
        if (OFFLINE_MODE) {
            localStorage.removeItem('dev_offline_mode');
            alert("AEZAKMI: Offline mód VYPNUT. Hra se nyní restartuje do ONLINE módu.");
        } else {
            localStorage.setItem('dev_offline_mode', 'true');
            alert("AEZAKMI: Offline mód ZAPNUT. Hra se nyní restartuje do OFFLINE módu (bez ukládání na Firebase).");
        }
        window.location.reload();
    }
});

const badWords = ["kurv", "píč", "pic", "zmrd", "kokot", "kkt", "prdel", "jeb", "čurá", "curak", "mrd", "kretén", "kreten", "debil", "buzn", "buzik", "hovn", "srač", "srac", "fuck", "shit", "bitch", "asshole", "cunt", "dick", "slut", "whore", "nigger", "nigga", "nigg", "negr", "fag", "faggot", "retard", "rape"]; 

function censorName(name) {
    if (!name) return "";
    let safeName = String(name);
    badWords.forEach(word => {
        const regex = new RegExp(word, "gi");
        safeName = safeName.replace(regex, (match) => {
            if (match.length <= 2) return "***";
            const firstLetter = match.charAt(0);
            const lastLetter = match.charAt(match.length - 1);
            const stars = "*".repeat(match.length - 2);
            return firstLetter + stars + lastLetter;
        });
    });
    return safeName;
}

function playTone(freq, type = 'sine', duration = 0.1, vol = 0.1) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playSound(type) {
    switch(type) {
        case 'click_default': playTone(400 + Math.random() * 200, 'sine', 0.1, 0.2); break;
        case 'click_doge': playTone(800 + Math.random() * 100, 'triangle', 0.15, 0.2); break;
        case 'click_custom': playTone(300 + Math.random() * 300, 'sawtooth', 0.1, 0.1); break;
        case 'buy_upgrade': playTone(500, 'sine', 0.1, 0.1); setTimeout(() => playTone(700, 'sine', 0.15, 0.1), 100); break;
        case 'buy_cosmetic': playTone(800, 'triangle', 0.1, 0.1); setTimeout(() => playTone(1000, 'triangle', 0.1, 0.1), 100); setTimeout(() => playTone(1200, 'triangle', 0.2, 0.1), 200); break;
        case 'error': playTone(200, 'sawtooth', 0.3, 0.2); break;
        case 'achievement': playTone(400, 'sine', 0.1, 0.2); setTimeout(() => playTone(500, 'sine', 0.1, 0.2), 150); setTimeout(() => playTone(600, 'sine', 0.3, 0.2), 300); break;
        case 'submit': playTone(300, 'square', 0.5, 0.3); setTimeout(() => playTone(200, 'square', 1.0, 0.3), 100); break;
        case 'ascend': playTone(200, 'sine', 0.5, 0.3); setTimeout(() => playTone(400, 'sine', 0.5, 0.3), 200); setTimeout(() => playTone(800, 'sine', 1.0, 0.4), 400); break;
        case 'crash': playTone(150, 'sawtooth', 1.0, 0.3); setTimeout(() => playTone(100, 'sawtooth', 1.5, 0.3), 300); break;
        case 'spin': playTone(600, 'square', 0.05, 0.1); break;
        case 'hit': playTone(150 + Math.random() * 50, 'sawtooth', 0.1, 0.2); break; 
        case 'crit': playTone(250 + Math.random() * 50, 'square', 0.15, 0.3); setTimeout(() => playTone(150, 'sawtooth', 0.2, 0.3), 50); break; 
    }
}

document.body.addEventListener('click', () => { if (audioCtx.state === 'suspended') audioCtx.resume(); }, { once: true });

const firebaseConfig = {
    apiKey: "AIzaSyBnFQf-YQODWhZN-3scSbWIQIgr3poDIos",
    authDomain: "tetris-5e14c.firebaseapp.com",
    projectId: "tetris-5e14c",
    storageBucket: "tetris-5e14c.firebasestorage.app",
    messagingSenderId: "923778243713",
    appId: "1:923778243713:web:fb80a82f654d0b8c244180"
};

let db = null;
if (!OFFLINE_MODE) {
    try { 
        const app = initializeApp(firebaseConfig); 
        db = getFirestore(app); 
    } catch(e) { 
        console.error("Firebase se nepřipojil:", e); 
    }
} else {
    console.warn("⚠️ HRA BĚŽÍ V OFFLINE MÓDU. Živá databáze je odpojena.");
}

const bldKeys = ["auto", "factory", "mine", "ai", "tiktok", "elon", "matrix", "crypto", "metaverse", "alien"];
const bldNames = { click: "Klikání", click2: "Super Klik", klikator: "Klikátor", auto: "Trol", factory: "Farma", mine: "Důl", ai: "AI", tiktok: "TikTok", elon: "Elon", matrix: "Matrix", crypto: "Krypto", metaverse: "Metaverse", alien: "UFO" };
const bpsRates = { auto: 1.5, factory: 15, mine: 75, ai: 375, tiktok: 2250, elon: 15000, matrix: 75000, crypto: 450000, metaverse: 3000000, alien: 75000000 };

const impMilestones = [10, 25, 50, 100];
const impBonuses = [0, 0.10, 0.25, 0.50, 1.00];
const impLabels = [0, 10, 25, 50, 100]; 
const impClickBonuses = [0, 1.00, 2.00, 3.00, 4.00];
const impClickLabels = [0, 100, 200, 300, 400];
const impBaseCosts = { click: 100, click2: 1000, klikator: 5000, auto: 500, factory: 5000, mine: 30000, ai: 150000, tiktok: 1000000, elon: 10000000, matrix: 150000000, crypto: 1000000000, metaverse: 10000000000, alien: 500000000000 };

const skinMap = { 'default': { type: 'text', val: '🔴' }, 'doge': { type: 'img', val: 'https://upload.wikimedia.org/wikipedia/en/5/5f/Original_Doge_meme.jpg' }, 'custom': { type: 'custom', val: '' } };

const defaultState = {
    nick: "", score: 0, totalScore: 0, clicks: 0, clickPower: 1, click2Level: 0, click2Power: 0, klikatorCount: 0, casinoSpins: 0,
    bossUnlocked: false, season: 1,
    boss: { 
        money: 0, xp: 0, level: 1, totalDmg: 0,
        bossKills: 0, currentBossDmg: 0, lastSeenBossLevel: 1, 
        weaponDmg: 1, weaponCount: 1, enchantMult: 1, goldMult: 1, xpMult: 1, 
        critChance: 0, critDmg: 2.0, armorPen: 0, autoAttack: 0, 
        costs: { weaponDmg: 10, goldMult: 50, xpMult: 100, weaponCount: 500, enchantMult: 1000, critChance: 5000, critDmg: 10000, armorPen: 25000, autoAttack: 50000 } 
    },
    buildings: { auto: 0, factory: 0, mine: 0, ai: 0, tiktok: 0, elon: 0, matrix: 0, crypto: 0, metaverse: 0, alien: 0 },
    improvements: { click: 0, click2: 0, klikator: 0, auto: 0, factory: 0, mine: 0, ai: 0, tiktok: 0, elon: 0, matrix: 0, crypto: 0, metaverse: 0, alien: 0 },
    costs: { click: 10, click2: 100, klikator: 500, auto: 50, factory: 500, mine: 3000, ai: 15000, tiktok: 100000, elon: 1000000, matrix: 15000000, crypto: 100000000, metaverse: 1000000000, alien: 50000000000 },
    startTime: null, lastTime: Date.now(),
    cosmetics: { skinsUnlocked: ['default'], currentSkin: 'default', bgsUnlocked: ['default'], currentBg: 'default', customImage: null },
    unlockedAchievements: [],
    ascend: { points: 0, totalPointsClaimed: 0, upgrades: { click: 0, bps: 0, cryptoUnlocked: 0, casinoUnlocked: 0 } },
    crypto: { coins: 0, price: 100, history: [100], totalProfit: 0 },
    frenzy: { active: false, type: null, multiplier: 1, duration: 0, endTime: 0 }
};

let game = null;
const rawLocal = localStorage.getItem('meme_clicker_fb');

if (rawLocal) {
    try {
        if (rawLocal.startsWith('{')) {
            game = JSON.parse(rawLocal); 
        } else {
            const decodedStr = decodeURIComponent(atob(rawLocal));
            const payload = JSON.parse(decodedStr);
            
            if (payload.d && payload.h) {
                const expectedHash = generateHash(payload.d);
                if (payload.h === expectedHash) {
                    game = JSON.parse(payload.d);
                } else {
                    console.error("ANTI-CHEAT: Hash mismatch!");
                    alert("⚠️ ANTI-CHEAT DETEKCE ⚠️\nZjistili jsme nelegální úpravu Save souboru. Hra byla resetována do původního stavu.");
                    game = JSON.parse(JSON.stringify(defaultState));
                }
            } else {
                game = JSON.parse(decodedStr);
            }
        }
    } catch(e) {
        console.error("Save Error:", e);
        game = JSON.parse(JSON.stringify(defaultState));
    }
} else {
    game = JSON.parse(JSON.stringify(defaultState));
}

// 🛡️ STÍNOVÁ PAMĚŤ (SHADOW MEMORY) - Ochrana proti úpravám v F12 Konzoli
window._AC = { s: game.score || 0, t: game.totalScore || 0 };

let backupTotalScore = parseFloat(localStorage.getItem('meme_clicker_backup_total')) || 0;
if (game.totalScore < backupTotalScore) {
    game.totalScore = backupTotalScore; 
    window._AC.t = backupTotalScore;
}

if (!game.lastTime || isNaN(game.lastTime)) game.lastTime = Date.now();
if (isNaN(game.score) || game.score == null) game.score = 0;
if (isNaN(game.totalScore) || game.totalScore == null) game.totalScore = game.score;
if (isNaN(game.clicks) || game.clicks == null) game.clicks = 0;
if (isNaN(game.clickPower) || game.clickPower == null) game.clickPower = 1;
if (isNaN(game.click2Level) || game.click2Level == null) game.click2Level = 0;
if (isNaN(game.click2Power) || game.click2Power == null) game.click2Power = 0;
if (isNaN(game.klikatorCount) || game.klikatorCount == null) game.klikatorCount = 0;
if (isNaN(game.casinoSpins) || game.casinoSpins == null) game.casinoSpins = 0;
if (isNaN(game.season) || game.season == null) game.season = 1;

if (!game.buildings) game.buildings = {};
if (!game.improvements) game.improvements = {};
if (!game.costs) game.costs = {};
if (!game.unlockedAchievements) game.unlockedAchievements = [];
if (!game.cosmetics) game.cosmetics = defaultState.cosmetics;
if (!game.ascend) game.ascend = { points: 0, totalPointsClaimed: 0, upgrades: { click: 0, bps: 0, cryptoUnlocked: 0, casinoUnlocked: 0 } };
if (game.ascend.upgrades === undefined) game.ascend.upgrades = { click: 0, bps: 0, cryptoUnlocked: 0, casinoUnlocked: 0 };
if (game.ascend.upgrades.bps === undefined) game.ascend.upgrades.bps = 0;
if (game.ascend.upgrades.cryptoUnlocked === undefined) game.ascend.upgrades.cryptoUnlocked = 0;
if (game.ascend.upgrades.casinoUnlocked === undefined) game.ascend.upgrades.casinoUnlocked = 0;
if (!game.crypto) game.crypto = { coins: 0, price: 100, history: [100], totalProfit: 0 };
if (game.crypto.history === undefined) game.crypto.history = [game.crypto.price || 100];
if (game.crypto.totalProfit === undefined) game.crypto.totalProfit = 0;
if (!game.frenzy) game.frenzy = { active: false, type: null, multiplier: 1, duration: 0, endTime: 0 };

if (game.bossUnlocked === undefined) game.bossUnlocked = false;
if (!game.boss) {
    game.boss = JSON.parse(JSON.stringify(defaultState.boss));
} else {
    if (game.boss.xp === undefined) game.boss.xp = 0;
    if (game.boss.level === undefined) game.boss.level = 1;
    if (game.boss.totalDmg === undefined) game.boss.totalDmg = 0; 
    
    if (game.boss.bossKills === undefined) game.boss.bossKills = 0;
    if (game.boss.currentBossDmg === undefined) game.boss.currentBossDmg = 0;
    if (game.boss.lastSeenBossLevel === undefined) game.boss.lastSeenBossLevel = 1;

    if (game.boss.weaponDmg === undefined) game.boss.weaponDmg = game.boss.clickPower || 1;
    if (game.boss.weaponCount === undefined) game.boss.weaponCount = 1;
    if (game.boss.enchantMult === undefined) game.boss.enchantMult = 1;
    if (game.boss.goldMult === undefined) game.boss.goldMult = 1;
    if (game.boss.xpMult === undefined) game.boss.xpMult = 1;
    if (game.boss.critChance === undefined) game.boss.critChance = 0;
    if (game.boss.critDmg === undefined) game.boss.critDmg = 2.0;
    if (game.boss.armorPen === undefined) game.boss.armorPen = 0;
    if (game.boss.autoAttack === undefined) game.boss.autoAttack = 0;

    if (!game.boss.costs) {
        game.boss.costs = { weaponDmg: 10, goldMult: 50, xpMult: 100, weaponCount: 500, enchantMult: 1000, critChance: 5000, critDmg: 10000, armorPen: 25000, autoAttack: 50000 };
    } else {
        if (game.boss.costs.critChance === undefined) game.boss.costs.critChance = 5000;
        if (game.boss.costs.critDmg === undefined) game.boss.costs.critDmg = 10000;
        if (game.boss.costs.armorPen === undefined) game.boss.costs.armorPen = 25000;
        if (game.boss.costs.autoAttack === undefined) game.boss.costs.autoAttack = 50000;
    }
}

game.unlockedAchievements = game.unlockedAchievements.filter(a => !['easter_timer', 'easter_jicin', 'easter_sigma'].includes(a));
if (!game.cosmetics.customImage) game.cosmetics.customImage = null;
if (!skinMap[game.cosmetics.currentSkin]) game.cosmetics.currentSkin = 'default';
if (!game.startTime && game.score > 0) game.startTime = Date.now();
if (game.nick === undefined) game.nick = "";

if (isNaN(game.costs.click2) || game.costs.click2 == null) game.costs.click2 = 100;
if (isNaN(game.costs.klikator) || game.costs.klikator == null) game.costs.klikator = 500;
if (isNaN(game.improvements.click2) || game.improvements.click2 == null) game.improvements.click2 = 0;
if (isNaN(game.improvements.klikator) || game.improvements.klikator == null) game.improvements.klikator = 0;

for (const key of bldKeys) {
    if (isNaN(game.buildings[key])) game.buildings[key] = 0;
    if (isNaN(game.costs[key])) game.costs[key] = defaultState.costs[key];
    if (isNaN(game.improvements[key])) game.improvements[key] = 0;
}
if (isNaN(game.improvements.click)) game.improvements.click = 0;

let localLeaderboard = JSON.parse(localStorage.getItem('meme_lb_local')) || [];
let gameLoop;
let currentViewsLoaded = false;
let goldenTimer = 0;
let nextGolden = Math.random() * 60000 + 60000;
let cryptoTimer = 0;
let lastSaveTime = Date.now();

let globalBoss = JSON.parse(localStorage.getItem('meme_boss_local')) || { currentHp: 5000000, maxHp: 5000000, level: 1, lastUpdate: Date.now(), season: 1 };
let pendingBossDamage = 0;
let isBossSyncing = false;
let lastBossSyncTime = 0; 

if (game.boss && game.boss.lastSeenBossLevel === undefined) {
    game.boss.lastSeenBossLevel = globalBoss.level || 1;
}

const domTextCache = {};
function fastText(id, text) {
    if (domTextCache[id] !== text) {
        const el = document.getElementById(id);
        if (el) { el.textContent = text; domTextCache[id] = text; }
    }
}
function fastHTML(id, html) {
    if (domTextCache[id] !== html) {
        const el = document.getElementById(id);
        if (el) { el.innerHTML = html; domTextCache[id] = html; }
    }
}

const allAchievements = [
    { id: 'first', name: '👶 První krůčky (1 klik)', req: () => game.clicks >= 1 },
    { id: 'hundred', name: '💯 Tryhard (100 kliků)', req: () => game.clicks >= 100 },
    { id: 'click2_10', name: '🖱️ Silný klik (10x Super Klik)', req: () => (game.click2Level || 0) >= 10 },
    { id: 'click2_50', name: '🖱️ God klik (50x Super Klik)', req: () => (game.click2Level || 0) >= 50 },
    { id: 'click2_100', name: '🖱️ Titan klik (100x Super Klik)', req: () => (game.click2Level || 0) >= 100 },
    { id: 'klikator_10', name: '🤖 Pomocná ruka (10x Klikátor)', req: () => (game.klikatorCount || 0) >= 10 },
    { id: 'klikator_50', name: '🤖 Autoclicker armáda (50x Klikátor)', req: () => (game.klikatorCount || 0) >= 50 },
    { id: 'klikator_100', name: '🤖 Úl Klikátorů (100x Klikátor)', req: () => (game.klikatorCount || 0) >= 100 },
    { id: 'casino_10', name: '🎰 Gambler (10 zatočení)', req: () => (game.casinoSpins || 0) >= 10 },
    { id: 'casino_50', name: '🎰 Závislák (50 zatočení)', req: () => (game.casinoSpins || 0) >= 50 },
    { id: 'casino_100', name: '🎰 VIP Zákazník (100 zatočení)', req: () => (game.casinoSpins || 0) >= 100 },
    { id: '1k_score', name: '💸 Drobné (1k bodů)', req: () => game.score >= 1000 },
    { id: '10k_score', name: '💸 Kapesné (10k bodů)', req: () => game.score >= 10000 },
    { id: '100k_score', name: '💸 Výplata (100k bodů)', req: () => game.score >= 100000 },
    { id: 'rich', name: '💸 Bohatýr (1M bodů)', req: () => game.score >= 1000000 },
    { id: 'billionaire', name: '💰 Miliardář (1B bodů)', req: () => game.score >= 1000000000 },
    { id: 'trillionaire', name: '👑 Vládce Vesmíru (1T bodů)', req: () => game.score >= 1000000000000 },
    { id: 'collector', name: '🛍️ Shopaholik (Všechny skiny)', req: () => game.cosmetics.skinsUnlocked.length >= Object.keys(skinMap).length },
    { id: 'ascended', name: '🌌 Nanebevstoupení', req: () => game.ascend.totalPointsClaimed >= 1 },
    { id: 'ap_10', name: '🌌 Ascend Master (10 AP celkem)', req: () => game.ascend.totalPointsClaimed >= 10 },
    { id: 'ap_50', name: '🌌 Ascend God (50 AP celkem)', req: () => game.ascend.totalPointsClaimed >= 50 },
    { id: 'crypto_profit_1', name: '📈 Stonks (Zisk 1M z Krypto)', req: () => (game.crypto.totalProfit || 0) >= 1000000 },
    { id: 'crypto_profit_2', name: '🐺 Wolf of Wall Street (Zisk 1B z Krypto)', req: () => (game.crypto.totalProfit || 0) >= 1000000000 },
    { id: 'bld_auto_10', name: '🧌 Armáda Trolů (10x)', req: () => game.buildings.auto >= 10 },
    { id: 'bld_auto_50', name: '🧌 Generál Trolů (50x)', req: () => game.buildings.auto >= 50 },
    { id: 'bld_auto_100', name: '🧌 Král Trolů (100x)', req: () => game.buildings.auto >= 100 },
    { id: 'bld_factory_10', name: '🏭 Průmyslová revoluce (10x)', req: () => game.buildings.factory >= 10 },
    { id: 'bld_factory_50', name: '🏭 Průmyslový magnát (50x)', req: () => game.buildings.factory >= 50 },
    { id: 'bld_factory_100', name: '🏭 Monopol (100x)', req: () => game.buildings.factory >= 100 },
    { id: 'bld_mine_10', name: '⛏️ Trpaslík (10x Důl)', req: () => game.buildings.mine >= 10 },
    { id: 'bld_mine_50', name: '⛏️ Mistr kopáč (50x Důl)', req: () => game.buildings.mine >= 50 },
    { id: 'bld_mine_100', name: '⛏️ Vládce podzemí (100x Důl)', req: () => game.buildings.mine >= 100 },
    { id: 'bld_ai_10', name: '🤖 Skynet (10x AI)', req: () => game.buildings.ai >= 10 },
    { id: 'bld_ai_50', name: '🤖 Matrix (50x AI)', req: () => game.buildings.ai >= 50 },
    { id: 'bld_ai_100', name: '🤖 Bůh strojů (100x AI)', req: () => game.buildings.ai >= 100 },
    { id: 'bld_tiktok_10', name: '📱 Brainrot King (10x TikTok)', req: () => game.buildings.tiktok >= 10 },
    { id: 'bld_tiktok_50', name: '📱 Influencer (50x TikTok)', req: () => game.buildings.tiktok >= 50 },
    { id: 'bld_tiktok_100', name: '📱 Algoritmus (100x TikTok)', req: () => game.buildings.tiktok >= 100 },
    { id: 'bld_elon_10', name: '🐦 Chief Twit (10x Elon)', req: () => game.buildings.elon >= 10 },
    { id: 'bld_elon_50', name: '🐦 Space X (50x Elon)', req: () => game.buildings.elon >= 50 },
    { id: 'bld_elon_100', name: '🐦 Mars kolonie (100x Elon)', req: () => game.buildings.elon >= 100 },
    { id: 'bld_matrix_10', name: '💊 Neo (10x Matrix)', req: () => game.buildings.matrix >= 10 },
    { id: 'bld_matrix_50', name: '💊 Architekt (50x Matrix)', req: () => game.buildings.matrix >= 50 },
    { id: 'bld_matrix_100', name: '💊 Zdrojový kód (100x Matrix)', req: () => game.buildings.matrix >= 100 },
    { id: 'bld_crypto_10', name: '💎 Diamond Hands (10x Burza)', req: () => game.buildings.crypto >= 10 },
    { id: 'bld_crypto_50', name: '💎 Velryba (50x Burza)', req: () => game.buildings.crypto >= 50 },
    { id: 'bld_crypto_100', name: '💎 Satoshi (100x Burza)', req: () => game.buildings.crypto >= 100 },
    { id: 'bld_metaverse_10', name: '🕶️ Mark Z. (10x Metaverse)', req: () => game.buildings.metaverse >= 10 },
    { id: 'bld_metaverse_50', name: '🕶️ Virtuální bůh (50x Metaverse)', req: () => game.buildings.metaverse >= 50 },
    { id: 'bld_metaverse_100', name: '🕶️ Stvořitel (100x Metaverse)', req: () => game.buildings.metaverse >= 100 },
    { id: 'bld_alien_10', name: '🛸 Area 51 (10x UFO)', req: () => game.buildings.alien >= 10 },
    { id: 'bld_alien_50', name: '🛸 Mezigalaktický vládce (50x UFO)', req: () => game.buildings.alien >= 50 },
    { id: 'bld_alien_100', name: '🛸 Vládce multivesmíru (100x UFO)', req: () => game.buildings.alien >= 100 },
    { id: 'boss_unlock', name: '👹 Lovec monster (Odemkni Bosse)', req: () => game.bossUnlocked },
    { id: 'boss_dmg_1', name: '⚔️ První krev (10k Boss DMG)', req: () => (game.boss?.totalDmg || 0) >= 10000 },
    { id: 'boss_dmg_2', name: '⚔️ Drakobijec (1M Boss DMG)', req: () => (game.boss?.totalDmg || 0) >= 1000000 },
    { id: 'boss_kill_1', name: '💀 Úspěšný lov (Podíl na zabití 1 Bosse)', req: () => (game.boss?.bossKills || 0) >= 1 },
    { id: 'boss_kill_10', name: '💀 Kat Monster (Podíl na zabití 10 Bossů)', req: () => (game.boss?.bossKills || 0) >= 10 }
];

function getBossReqXp(level) {
    return Math.floor(100 * Math.pow(1.3, level - 1));
}

function calculatePendingAP() {
    let cumulativeScore = game.totalScore || 0;
    let ap = 0; let cost = 100000;
    while (cumulativeScore >= cost) { cumulativeScore -= cost; ap++; cost *= 1.25; }
    let pending = ap - (game.ascend.totalPointsClaimed || 0);
    return pending > 0 ? pending : 0;
}

function getNextAPScoreRequired() {
    let cumulativeScore = game.totalScore || 0;
    let ap = 0; let cost = 100000;
    while (cumulativeScore >= cost) { cumulativeScore -= cost; ap++; cost *= 1.25; }
    return cost - cumulativeScore; 
}

function getMultiplier() {
    let achCount = game.unlockedAchievements ? game.unlockedAchievements.length : 0;
    return 1 + (achCount * 0.01);
}

function getBPS() { 
    let total = 0;
    for(const key in game.buildings) {
        let count = game.buildings[key] || 0;
        let rate = bpsRates[key] || 0;
        let impLvl = game.improvements[key] || 0;
        let bldMult = 1 + (impBonuses[impLvl] || 0);
        total += (count * rate) * bldMult;
    }
    
    let ascendBpsLvl = game.ascend.upgrades.bps || 0;
    let ascendBpsMult = 1 + (ascendBpsLvl * 0.25);
    
    let bossBpsMult = 1 + ((game.boss?.bossKills || 0) * 0.10);
    
    let result = total * getMultiplier() * ascendBpsMult * bossBpsMult;
    
    if (game.frenzy && game.frenzy.active && game.frenzy.type === 'bps') {
        result *= game.frenzy.multiplier;
    }
    
    return result; 
}

function formatNumber(num) {
    if (isNaN(num) || num == null) return "0";
    if (num < 10000) return Math.floor(num).toString(); 

    const suffixes = ["", "k", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc", "Ud", "Dd", "Td", "Qad", "Qid", "Sxd", "Spd", "Ocd", "Nod", "Vg"];
    const tier = Math.floor(Math.log10(num) / 3);
    
    if (tier < suffixes.length) {
        const scale = Math.pow(10, tier * 3);
        return (num / scale).toFixed(2) + ' ' + suffixes[tier];
    } else {
        return num.toExponential(2);
    }
}

function formatTime(ms) {
    if (isNaN(ms) || ms < 0) return "00:00:00";
    let t = Math.floor(ms / 1000);
    return `${Math.floor(t/3600).toString().padStart(2,'0')}:${Math.floor((t%3600)/60).toString().padStart(2,'0')}:${(t%60).toString().padStart(2,'0')}`;
}

function showToast(msg) {
    const t = document.getElementById('toast');
    if(t) { 
        t.textContent = msg; 
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 3000); 
    }
}

function checkAchievements() {
    let changed = false;
    allAchievements.forEach(a => {
        if(!game.unlockedAchievements.includes(a.id) && a.req()) {
            game.unlockedAchievements.push(a.id);
            playSound('achievement');
            showToast(`🏆 Odemčeno: ${a.name}`);
            changed = true;
        }
    });
    if(changed) renderAchievements();
}

function renderAchievements() {
    const list = document.getElementById('achievements-list');
    if (!list) return;
    let html = '';
    allAchievements.forEach(a => {
        const unlocked = game.unlockedAchievements.includes(a.id);
        html += `<div class="achievement ${unlocked ? 'unlocked' : ''}">
            <span>${a.name}</span><span>${unlocked ? '✔️' : '🔒'}</span>
        </div>`;
    });
    fastHTML('achievements-list', html);
}

function renderCryptoChart() {
    const svg = document.getElementById('crypto-chart-polyline');
    if (!svg) return;
    const history = game.crypto.history || [100];
    if (history.length < 2) {
        svg.setAttribute('points', `0,40 300,40`);
        return;
    }
    
    const maxP = Math.max(...history) * 1.1;
    const minP = Math.min(...history) * 0.9;
    const range = maxP - minP || 1;
    
    let points = history.map((val, i) => {
        let x = (i / (history.length - 1)) * 300; 
        let y = 80 - (((val - minP) / range) * 80); 
        return `${x},${y}`;
    }).join(" ");
    
    svg.setAttribute('points', points);
    const isUp = history[history.length - 1] >= history[Math.max(0, history.length - 2)];
    svg.setAttribute('stroke', isUp ? '#2ecc71' : '#e74c3c');
}

function initImprovementsUI() {
    const list = document.getElementById('improvements-list');
    if (!list) return;
    let html = '';
    const keys = ["click", "click2", "klikator", ...bldKeys];
    
    for (const key of keys) {
        html += `<button class="btn buy-imp" id="imp-btn-${key}" data-key="${key}">
                    <span class="imp-name"></span> <span class="imp-cost" style="background:white; color:black; float:right; padding: 2px 6px; border-radius: 5px; font-size:12px;"></span>
                    <small class="imp-desc"></small>
                 </button>`;
    }
    list.innerHTML = html;
}

function updateImprovementsUI() {
    const keys = ["click", "click2", "klikator", ...bldKeys];
    for (const key of keys) {
        const btn = document.getElementById(`imp-btn-${key}`);
        if (!btn) continue;

        const currentLvl = game.improvements[key] || 0;
        let count = 0;
        if (key === 'click') count = game.clickPower;
        else if (key === 'click2') count = game.click2Level || 0;
        else if (key === 'klikator') count = game.klikatorCount || 0;
        else count = game.buildings[key] || 0;

        const nameEl = btn.querySelector('.imp-name');
        const costEl = btn.querySelector('.imp-cost');
        const descEl = btn.querySelector('.imp-desc');

        if (currentLvl < 4) {
            const reqAmount = impMilestones[currentLvl];
            const hasReq = count >= reqAmount;
            const cost = impBaseCosts[key] * Math.pow(10, currentLvl);
            const canAfford = game.score >= cost;

            if (btn.disabled !== (!hasReq || !canAfford)) btn.disabled = !hasReq || !canAfford;
            
            const newBg = hasReq ? "#f1c40f" : "#eee";
            if (btn.style.background !== newBg) btn.style.background = newBg;
            
            let currentLabel = (key === 'click' || key === 'click2' || key === 'klikator') ? impClickLabels[currentLvl + 1] : impLabels[currentLvl + 1];

            if (hasReq) {
                fastText(nameEl.id || (nameEl.id = `imp-name-${key}`), `${bldNames[key]} Vylepšení`);
                fastText(costEl.id || (costEl.id = `imp-cost-${key}`), formatNumber(cost));
                if (costEl.style.display !== 'inline-block') costEl.style.display = 'inline-block';
                fastHTML(descEl.id || (descEl.id = `imp-desc-${key}`), `Stav: ${currentLvl}/4 (+${currentLabel}% zisk)`);
            } else {
                fastText(nameEl.id || (nameEl.id = `imp-name-${key}`), `??? (Zamčeno)`);
                if (costEl.style.display !== 'none') costEl.style.display = 'none';
                fastHTML(descEl.id || (descEl.id = `imp-desc-${key}`), `<span style="color:#e74c3c; font-weight:bold;">Vyžaduje: ${reqAmount}x ${bldNames[key]}</span>`);
            }
        } else {
            if (!btn.disabled) btn.disabled = true;
            if (btn.style.background !== "#2ecc71") btn.style.background = "#2ecc71";
            
            let maxLabel = (key === 'click' || key === 'click2' || key === 'klikator') ? "400" : "100";
            fastText(nameEl.id || (nameEl.id = `imp-name-${key}`), `${bldNames[key]} Vylepšení`);
            fastText(costEl.id || (costEl.id = `imp-cost-${key}`), "MAX");
            if (costEl.style.background !== 'transparent') {
                costEl.style.display = 'inline-block';
                costEl.style.background = 'transparent';
                costEl.style.color = 'white';
                btn.style.color = 'white';
                btn.style.borderColor = '#27ae60';
            }
            fastHTML(descEl.id || (descEl.id = `imp-desc-${key}`), `Stav: 4/4 (+${maxLabel}% zisk)`);
        }
    }
}

function spawnParticle(x, y, text) {
    try {
        const p = document.createElement('div');
        p.className = 'particle'; 
        p.textContent = text;
        p.style.left = (x - 20 + Math.random()*40) + 'px'; 
        p.style.top = y + 'px';
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 1000);
    } catch(e) {}
}

function applyCosmetics() {
    const btn = document.getElementById('click-btn');
    const skinData = skinMap[game.cosmetics.currentSkin] || skinMap['default'];
    if (btn) {
        if (skinData.type === 'img') {
            if(btn.textContent !== '') btn.textContent = ''; 
            if(btn.style.backgroundImage !== `url('${skinData.val}')`) btn.style.backgroundImage = `url('${skinData.val}')`;
            btn.style.backgroundColor = 'transparent'; btn.style.border = 'none';
        } else if (skinData.type === 'custom') {
            if(btn.textContent !== '') btn.textContent = ''; 
            btn.style.backgroundImage = game.cosmetics.customImage ? `url('${game.cosmetics.customImage}')` : 'none';
            btn.style.backgroundColor = 'transparent'; btn.style.border = 'none';
        } else {
            if(btn.textContent !== skinData.val) btn.textContent = skinData.val; 
            btn.style.backgroundImage = 'none';
            btn.style.backgroundColor = 'var(--btn-color)'; btn.style.border = '5px solid #fff';
        }
    }

    const isFrenzy = document.body.classList.contains('frenzy-active');
    document.body.className = '';
    if(isFrenzy) document.body.classList.add('frenzy-active');
    
    if(game.cosmetics.currentBg === 'rainbow') document.body.classList.add('bg-rainbow');
    else if(game.cosmetics.currentBg === 'dark') document.body.classList.add('bg-dark');

    document.querySelectorAll('.buy-cosmetic').forEach(b => {
        const type = b.dataset.type, id = b.dataset.id, cost = parseInt(b.dataset.cost);
        const isUnlocked = type === 'skin' ? game.cosmetics.skinsUnlocked.includes(id) : game.cosmetics.bgsUnlocked.includes(id);
        const isEquipped = type === 'skin' ? game.cosmetics.currentSkin === id : game.cosmetics.currentBg === id;

        if (id === 'custom') {
            if (isEquipped) { fastText(b.id, 'Vybaveno'); b.disabled = false; }
            else if (isUnlocked) { fastText(b.id, 'Vybavit'); b.disabled = false; }
            else { fastText(b.id, formatNumber(cost)); b.disabled = game.score < cost; }
        } else {
            if (isEquipped) { fastText(b.id, 'Vybaveno'); b.disabled = false; }
            else if (isUnlocked) { fastText(b.id, 'Vybavit'); b.disabled = false; }
            else { fastText(b.id, formatNumber(cost)); b.disabled = game.score < cost; }
        }
    });
}

function spawnGoldenMeme() {
    try {
        const gm = document.createElement('div');
        gm.className = 'golden-meme';
        
        gm.style.left = Math.random() * (window.innerWidth - 100) + 'px';
        gm.style.top = Math.random() * (window.innerHeight - 100) + 'px';
        document.body.appendChild(gm);
        
        let clicked = false;
        gm.addEventListener('click', () => {
            if(clicked) return;
            clicked = true;
            gm.remove();
            playSound('achievement');
            
            if (Math.random() > 0.5) {
                game.frenzy = { active: true, type: 'click', multiplier: 4, duration: 30000, endTime: Date.now() + 30000 };
                showToast("🌟 CLICK FRENZY! Klikání x4 na 30 sekund!");
            } else {
                game.frenzy = { active: true, type: 'bps', multiplier: 3, duration: 30000, endTime: Date.now() + 30000 };
                showToast("🌟 BUILDING FRENZY! Budovy x3 na 30 sekund!");
            }
            document.body.classList.add('frenzy-active');
            updateUI();
            saveGameData();
        });

        setTimeout(() => {
            if (!clicked && gm.parentNode) gm.remove();
        }, 12000);
    } catch(e) {}
}

function updateBossUI() {
    if (!currentViewsLoaded) return;

    if (!game.bossUnlocked) {
        if (document.getElementById('boss-panel-locked')) document.getElementById('boss-panel-locked').style.display = 'block';
        if (document.getElementById('boss-panel-ui')) document.getElementById('boss-panel-ui').style.display = 'none';
    } else {
        if (document.getElementById('boss-panel-locked')) document.getElementById('boss-panel-locked').style.display = 'none';
        if (document.getElementById('boss-panel-ui')) document.getElementById('boss-panel-ui').style.display = 'block';
        
        const rawDef = (globalBoss.level - 1) * 15;
        const bossDef = Math.max(0, rawDef - (game.boss.armorPen || 0));
        const bpsBonus = (game.boss.bossKills || 0) * 10;

        fastText('boss-level', `Lvl ${globalBoss.level}`);
        let currentHp = Math.max(0, globalBoss.currentHp);
        fastText('boss-hp-text', `${formatNumber(currentHp)} / ${formatNumber(globalBoss.maxHp)}`);
        let pct = Math.max(0, (currentHp / globalBoss.maxHp) * 100);
        const bar = document.getElementById('boss-hp-bar');
        if (bar) bar.style.width = pct + '%';
        
        fastText('boss-def-text', formatNumber(bossDef));
        fastText('boss-kills-text', formatNumber(game.boss.bossKills || 0));
        fastText('boss-bps-bonus', `+${bpsBonus}%`);

        let sharePct = ((game.boss.currentBossDmg || 0) / globalBoss.maxHp) * 100;
        const shareEl = document.getElementById('boss-contribution-text');
        if (shareEl) {
            shareEl.innerText = `${sharePct.toFixed(1)}% ` + (sharePct >= 10 ? '(Odměna zajištěna!)' : '(Chybí do 10%)');
            shareEl.style.color = sharePct >= 10 ? '#2ecc71' : '#e74c3c';
        }

        fastText('player-boss-lvl', game.boss.level);
        const reqXp = getBossReqXp(game.boss.level);
        fastText('player-boss-xp', `${formatNumber(game.boss.xp)} / ${formatNumber(reqXp)}`);
        const xpBar = document.getElementById('player-boss-xp-bar');
        if (xpBar) xpBar.style.width = Math.min(100, (game.boss.xp / reqXp) * 100) + '%';

        fastText('boss-money', formatNumber(game.boss.money));
        
        const autoText = document.getElementById('boss-auto-dps-text');
        if (autoText) {
            autoText.style.display = (!BOSS_MAINTENANCE && game.boss.autoAttack > 0) ? 'block' : 'none';
        }

        const elStatDmg = document.getElementById('stat-boss-dmg');
        if (elStatDmg) {
            let rawDmgCalc = game.boss.weaponDmg * game.boss.weaponCount * game.boss.enchantMult;
            let critDmgCalc = rawDmgCalc * (game.boss.critDmg || 2.0);
            let goldDropCalc = 1 * game.boss.goldMult;
            let xpDropCalc = 1 * game.boss.xpMult;

            fastText('stat-boss-dmg', formatNumber(rawDmgCalc));
            fastText('stat-boss-crit', formatNumber(critDmgCalc));
            fastText('stat-boss-gold', formatNumber(goldDropCalc));
            fastText('stat-boss-xp', formatNumber(xpDropCalc));
        }

        const uDmg = document.getElementById('btn-boss-upg-dmg');
        if (uDmg) {
            fastText('boss-lvl-dmg', `[${game.boss.weaponDmg}]`);
            fastText('boss-cost-dmg', formatNumber(game.boss.costs.weaponDmg));
            uDmg.disabled = game.boss.money < game.boss.costs.weaponDmg;
            uDmg.style.opacity = uDmg.disabled ? '0.4' : '1';
            uDmg.style.cursor = uDmg.disabled ? 'not-allowed' : 'pointer';
        }

        const uGold = document.getElementById('btn-boss-upg-gold');
        if (uGold) {
            if (game.boss.level >= 2) {
                fastText('boss-lvl-gold', `[${game.boss.goldMult}]`);
                fastText('boss-cost-gold', formatNumber(game.boss.costs.goldMult));
                fastText('boss-req-gold', `Zisk mincí z bosse +1`);
                uGold.disabled = game.boss.money < game.boss.costs.goldMult;
            } else {
                fastText('boss-lvl-gold', `[🔒]`); fastText('boss-cost-gold', `Lvl 2`); fastText('boss-req-gold', `Vyžaduje tvůj level 2`); uGold.disabled = true;
            }
            uGold.style.opacity = uGold.disabled ? '0.4' : '1';
            uGold.style.cursor = uGold.disabled ? 'not-allowed' : 'pointer';
        }

        const uXp = document.getElementById('btn-boss-upg-xp');
        if (uXp) {
            if (game.boss.level >= 3) {
                fastText('boss-lvl-xp', `[${game.boss.xpMult}]`);
                fastText('boss-cost-xp', formatNumber(game.boss.costs.xpMult));
                fastText('boss-req-xp', `Zisk XP z bosse +1`);
                uXp.disabled = game.boss.money < game.boss.costs.xpMult;
            } else {
                fastText('boss-lvl-xp', `[🔒]`); fastText('boss-cost-xp', `Lvl 3`); fastText('boss-req-xp', `Vyžaduje tvůj level 3`); uXp.disabled = true;
            }
            uXp.style.opacity = uXp.disabled ? '0.4' : '1';
            uXp.style.cursor = uXp.disabled ? 'not-allowed' : 'pointer';
        }

        const uCount = document.getElementById('btn-boss-upg-count');
        if (uCount) {
            if (game.boss.level >= 5) {
                fastText('boss-lvl-count', `[${game.boss.weaponCount}]`);
                fastText('boss-cost-count', formatNumber(game.boss.costs.weaponCount));
                fastText('boss-req-count', `Počet útoků naráz +1`);
                uCount.disabled = game.boss.money < game.boss.costs.weaponCount;
            } else {
                fastText('boss-lvl-count', `[🔒]`); fastText('boss-cost-count', `Lvl 5`); fastText('boss-req-count', `Vyžaduje tvůj level 5`); uCount.disabled = true;
            }
            uCount.style.opacity = uCount.disabled ? '0.4' : '1';
            uCount.style.cursor = uCount.disabled ? 'not-allowed' : 'pointer';
        }
        
        const uCritC = document.getElementById('btn-boss-upg-crit-c');
        if (uCritC) {
            if (game.boss.level >= 8) {
                fastText('boss-lvl-crit-c', `[${game.boss.critChance}%]`);
                fastText('boss-cost-crit-c', formatNumber(game.boss.costs.critChance));
                fastText('boss-req-crit-c', `Šance na obří poškození +1%`);
                uCritC.disabled = game.boss.money < game.boss.costs.critChance;
            } else {
                fastText('boss-lvl-crit-c', `[🔒]`); fastText('boss-cost-crit-c', `Lvl 8`); fastText('boss-req-crit-c', `Vyžaduje tvůj level 8`); uCritC.disabled = true;
            }
            uCritC.style.opacity = uCritC.disabled ? '0.4' : '1';
            uCritC.style.cursor = uCritC.disabled ? 'not-allowed' : 'pointer';
        }

        const uEnchant = document.getElementById('btn-boss-upg-enchant');
        if (uEnchant) {
            if (game.boss.level >= 10) {
                fastText('boss-lvl-enchant', `[${game.boss.enchantMult}]`);
                fastText('boss-cost-enchant', formatNumber(game.boss.costs.enchantMult));
                fastText('boss-req-enchant', `Násobič celkového DMG +1x`);
                uEnchant.disabled = game.boss.money < game.boss.costs.enchantMult;
            } else {
                fastText('boss-lvl-enchant', `[🔒]`); fastText('boss-cost-enchant', `Lvl 10`); fastText('boss-req-enchant', `Vyžaduje tvůj level 10`); uEnchant.disabled = true;
            }
            uEnchant.style.opacity = uEnchant.disabled ? '0.4' : '1';
            uEnchant.style.cursor = uEnchant.disabled ? 'not-allowed' : 'pointer';
        }

        const uCritD = document.getElementById('btn-boss-upg-crit-d');
        if (uCritD) {
            if (game.boss.level >= 12) {
                fastText('boss-lvl-crit-d', `[${(game.boss.critDmg || 2).toFixed(1)}x]`);
                fastText('boss-cost-crit-d', formatNumber(game.boss.costs.critDmg));
                fastText('boss-req-crit-d', `Zvýší poškození CRITu o +0.5x`);
                uCritD.disabled = game.boss.money < game.boss.costs.critDmg;
            } else {
                fastText('boss-lvl-crit-d', `[🔒]`); fastText('boss-cost-crit-d', `Lvl 12`); fastText('boss-req-crit-d', `Vyžaduje tvůj level 12`); uCritD.disabled = true;
            }
            uCritD.style.opacity = uCritD.disabled ? '0.4' : '1';
            uCritD.style.cursor = uCritD.disabled ? 'not-allowed' : 'pointer';
        }

        const uPen = document.getElementById('btn-boss-upg-pen');
        if (uPen) {
            if (game.boss.level >= 15) {
                fastText('boss-lvl-pen', `[${game.boss.armorPen}]`);
                fastText('boss-cost-pen', formatNumber(game.boss.costs.armorPen));
                fastText('boss-req-pen', `Ignoruje 5 DEF z každé rány`);
                uPen.disabled = game.boss.money < game.boss.costs.armorPen;
            } else {
                fastText('boss-lvl-pen', `[🔒]`); fastText('boss-cost-pen', `Lvl 15`); fastText('boss-req-pen', `Vyžaduje tvůj level 15`); uPen.disabled = true;
            }
            uPen.style.opacity = uPen.disabled ? '0.4' : '1';
            uPen.style.cursor = uPen.disabled ? 'not-allowed' : 'pointer';
        }

        const uAuto = document.getElementById('btn-boss-upg-auto');
        if (uAuto) {
            if (game.boss.level >= 20) {
                fastText('boss-lvl-auto', `[${game.boss.autoAttack}]`);
                fastText('boss-cost-auto', formatNumber(game.boss.costs.autoAttack));
                fastText('boss-req-auto', `Pasivně střílí na Bosse (1x/s)`);
                uAuto.disabled = game.boss.money < game.boss.costs.autoAttack;
            } else {
                fastText('boss-lvl-auto', `[🔒]`); fastText('boss-cost-auto', `Lvl 20`); fastText('boss-req-auto', `Vyžaduje tvůj level 20`); uAuto.disabled = true;
            }
            uAuto.style.opacity = uAuto.disabled ? '0.4' : '1';
            uAuto.style.cursor = uAuto.disabled ? 'not-allowed' : 'pointer';
        }
    }
}

function updateUI() {
    if(!currentViewsLoaded) return;

    fastText('score', formatNumber(game.score));
    fastText('total-score-display', formatNumber(game.totalScore));
    fastText('bps', formatNumber(getBPS()));
    fastText('mult-val', getMultiplier().toFixed(3));
    fastText('total-clicks', formatNumber(game.clicks));

    const clickBtnUI = document.getElementById('upg-click');
    if (clickBtnUI) {
        fastText('cost-click', formatNumber(game.costs.click));
        fastText('lvl-click', `[${game.clickPower}]`);
        clickBtnUI.disabled = game.score < game.costs.click;
    }

    const click2BtnUI = document.getElementById('upg-click2');
    if (click2BtnUI) {
        fastText('cost-click2', formatNumber(game.costs.click2));
        fastText('lvl-click2', `[${game.click2Level || 0}]`);
        click2BtnUI.disabled = game.score < game.costs.click2;
    }

    const klikatorBtnUI = document.getElementById('upg-klikator');
    if (klikatorBtnUI) {
        fastText('cost-klikator', formatNumber(game.costs.klikator));
        fastText('count-klikator', `[${game.klikatorCount || 0}]`);
        klikatorBtnUI.disabled = game.score < game.costs.klikator;
    }

    const orbitContainer = document.getElementById('klikator-orbit-container');
    if (orbitContainer) {
        const currentKlikators = game.klikatorCount || 0;
        const visualCount = Math.min(currentKlikators, 10);
        const spawnedRounds = orbitContainer.querySelectorAll('.klikator-mini-hand').length;
        
        if (visualCount !== spawnedRounds) {
            orbitContainer.innerHTML = '';
            const radius = 135; 
            const center = 150; 

            for (let i = 0; i < visualCount; i++) {
                const hand = document.createElement('div');
                hand.className = 'klikator-mini-hand';
                hand.textContent = '🤖'; 
                
                const angle = (i / visualCount) * 2 * Math.PI;
                const x = center + radius * Math.cos(angle) - 15; 
                const y = center + radius * Math.sin(angle) - 15; 
                
                hand.style.left = x + 'px';
                hand.style.top = y + 'px';
                
                const degrees = angle * (180 / Math.PI) + 90; 
                hand.style.transform = `rotate(${degrees}deg)`;
                hand.dataset.baseTransform = `rotate(${degrees}deg)`;

                orbitContainer.appendChild(hand);
            }
        }
    }

    for(const key in game.buildings) {
        const btnEl = document.getElementById(`bld-${key}`);
        if(btnEl) { 
            fastText(`cost-${key}`, formatNumber(game.costs[key])); 
            btnEl.disabled = game.score < game.costs[key]; 
        }
        fastText(`count-${key}`, `[${game.buildings[key]}]`);
    }

    updateImprovementsUI();

    const pendingAP = calculatePendingAP();
    const remainingScore = getNextAPScoreRequired();

    fastText('ap-display', formatNumber(game.ascend.points));
    fastText('ap-pending', formatNumber(pendingAP));
    fastText('ap-next-req', formatNumber(remainingScore));

    const btnAscendReset = document.getElementById('btn-ascend-reset');
    if (btnAscendReset) btnAscendReset.disabled = pendingAP === 0;

    const clickLvl = game.ascend.upgrades.click || 0;
    const clickCost = Math.ceil(1 * Math.pow(1.5, clickLvl));
    const btnAscendClick = document.getElementById('buy-ascend-click');
    if (btnAscendClick) {
        fastText('cost-ascend-click', formatNumber(clickCost));
        fastText('lvl-ascend-click', clickLvl);
        btnAscendClick.disabled = game.ascend.points < clickCost;
    }

    const bpsLvl = game.ascend.upgrades.bps || 0;
    const bpsCost = Math.ceil(1 * Math.pow(1.5, bpsLvl));
    const btnAscendBps = document.getElementById('buy-ascend-bps');
    if (btnAscendBps) {
        fastText('cost-ascend-bps', formatNumber(bpsCost));
        fastText('lvl-ascend-bps', bpsLvl);
        btnAscendBps.disabled = game.ascend.points < bpsCost;
    }

    const cryptoPanel = document.getElementById('crypto-panel-ui');
    if (cryptoPanel) {
        if (game.ascend.upgrades.cryptoUnlocked) {
            if(cryptoPanel.style.display !== 'block') cryptoPanel.style.display = 'block';
            fastText('crypto-price', formatNumber(game.crypto.price));
            fastText('crypto-owned', formatNumber(game.crypto.coins));
            
            const profitEl = document.getElementById('crypto-profit');
            if (profitEl) {
                let prof = game.crypto.totalProfit || 0;
                profitEl.style.color = prof >= 0 ? '#2ecc71' : '#e74c3c';
                fastText('crypto-profit', (prof >= 0 ? '+' : '-') + formatNumber(Math.abs(prof)));
            }
        } else {
            if(cryptoPanel.style.display !== 'none') cryptoPanel.style.display = 'none';
        }
    }

    const btnAscendCrypto = document.getElementById('buy-ascend-crypto');
    if (btnAscendCrypto) {
        if (game.ascend.upgrades.cryptoUnlocked) {
            btnAscendCrypto.disabled = true;
            fastText('status-ascend-crypto', "Odemčeno");
        } else {
            btnAscendCrypto.disabled = game.ascend.points < 2;
        }
    }

    const casinoPanel = document.getElementById('casino-panel-ui');
    if (casinoPanel) {
        if (game.ascend.upgrades.casinoUnlocked) {
            if(casinoPanel.style.display !== 'block') casinoPanel.style.display = 'block';
        } else {
            if(casinoPanel.style.display !== 'none') casinoPanel.style.display = 'none';
        }
    }

    const btnAscendCasino = document.getElementById('buy-ascend-casino');
    if (btnAscendCasino) {
        if (game.ascend.upgrades.casinoUnlocked) {
            btnAscendCasino.disabled = true;
            fastText('status-ascend-casino', "Odemčeno");
        } else {
            btnAscendCasino.disabled = game.ascend.points < 2;
        }
    }

    applyCosmetics();
    updateBossUI();
}

async function fetchLeaderboard() {
    const tbody = document.getElementById('lb-body');
    if (!tbody) return;
    const now = Date.now();
    const cachedLB = JSON.parse(sessionStorage.getItem('cached_lb'));

    if (cachedLB && (now - cachedLB.timestamp < 300000)) {
        renderLeaderboardData(cachedLB.data);
        return;
    }

    if (db) {
        try {
            const q = query(collection(db, "clicker_leaderboard"), orderBy("score", "desc"), limit(10));
            const snapshot = await getDocs(q);
            if(snapshot.empty) { tbody.innerHTML = '<tr><td colspan="5">Firebase tabulka je prázdná.</td></tr>'; return; }
            let lbData = [];
            snapshot.forEach((doc) => lbData.push(doc.data()));
            sessionStorage.setItem('cached_lb', JSON.stringify({ timestamp: now, data: lbData }));
            renderLeaderboardData(lbData);
        } catch(e) { renderLocalLeaderboard(); }
    } else { renderLocalLeaderboard(); }
}

function renderLeaderboardData(data) {
    const tbody = document.getElementById('lb-body');
    if (!tbody) return;
    let html = '';
    data.forEach((d) => {
        const safeName = censorName(d.name);
        html += `<tr>
            <td>${safeName}</td>
            <td>${d.achievements || 0}</td>
            <td style="font-weight:bold;color:#e67e22;">${formatNumber(d.score)}</td>
            <td>${formatNumber(d.current || 0)}</td>
            <td style="font-weight:bold;color:#c0392b;">${formatNumber(d.bossDmg || 0)}</td>
        </tr>`;
    });
    fastHTML('lb-body', html);
}

function renderLocalLeaderboard() {
    const tbody = document.getElementById('lb-body');
    if (!tbody) return;
    let html = '';
    localLeaderboard.slice(0, 10).forEach(entry => {
        const safeName = censorName(entry.name);
        html += `<tr>
            <td>${safeName}</td>
            <td>${entry.achievements || 0}</td>
            <td style="font-weight:bold;color:#e67e22;">${formatNumber(entry.score)}</td>
            <td>${formatNumber(entry.current || 0)}</td>
            <td style="font-weight:bold;color:#c0392b;">${formatNumber(entry.bossDmg || 0)}</td>
        </tr>`;
    });
    if(localLeaderboard.length === 0) html = '<tr><td colspan="5">Žádná data. Zkus nahrát skóre!</td></tr>';
    fastHTML('lb-body', html);
}

function saveLocally(nick, score, timeStr, current) {
    let ach = game.unlockedAchievements ? game.unlockedAchievements.length : 0;
    let bDmg = game.boss && game.boss.totalDmg ? game.boss.totalDmg : 0;
    let existing = localLeaderboard.find(entry => entry.name === nick);
    if (existing) {
        if (score > existing.score) {
            existing.score = score; existing.time = timeStr; existing.current = current; existing.achievements = ach; existing.bossDmg = bDmg;
        }
    } else {
        localLeaderboard.push({ name: nick, score: score, time: timeStr, current: current, achievements: ach, bossDmg: bDmg });
    }
    localLeaderboard.sort((a,b) => b.score - a.score);
    localStorage.setItem('meme_lb_local', JSON.stringify(localLeaderboard));
}

document.addEventListener('change', (e) => {
    if (e.target.id === 'hide-changelog-checkbox') {
        if (e.target.checked) {
            localStorage.setItem('meme_changelog_v2_2', 'true');
        } else {
            localStorage.removeItem('meme_changelog_v2_2');
        }
    }

    if (e.target.id === 'custom-image-upload') {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(readerEvent) {
                game.cosmetics.customImage = readerEvent.target.result;
                applyCosmetics();
                saveGameData();
            }
            reader.readAsDataURL(file);
        }
    }
    
    if (e.target.id === 'import-save-upload') {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            const contents = evt.target.result.trim();
            let importedGame = null;

            try {
                const decodedStr = decodeURIComponent(atob(contents));
                const payload = JSON.parse(decodedStr);
                if (payload.d && payload.h) {
                    const expectedHash = generateHash(payload.d);
                    if (payload.h === expectedHash) {
                        importedGame = JSON.parse(payload.d);
                    }
                } else {
                    importedGame = JSON.parse(decodedStr);
                }
            } catch(err) {
                try { importedGame = JSON.parse(contents); } catch(e2) {}
            }

            if (importedGame && importedGame.score !== undefined) {
                game = importedGame;
                
                let backupTotalScore = parseFloat(localStorage.getItem('meme_clicker_backup_total')) || 0;
                if (game.totalScore < backupTotalScore) {
                    game.totalScore = backupTotalScore;
                }
                
                window._AC.s = game.score;
                window._AC.t = game.totalScore;

                saveGameData();
                playSound('achievement');
                alert("✅ Save úspěšně načten!");
                window.location.reload();
            } else {
                playSound('error');
                alert("❌ Neplatný nebo upravený save soubor (Anti-Cheat)!");
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }
});

document.addEventListener('click', async (e) => {
    
    if (BOSS_MAINTENANCE && (e.target.closest('#boss-click-btn') || e.target.closest('[id^="btn-boss-upg"]') || e.target.closest('#btn-unlock-boss') || e.target.closest('#btn-refresh-boss'))) {
        playSound('error');
        showToast("⚠️ Boss minihra je do zítra pozastavena (údržba DB).");
        return;
    }

    if (e.target.closest('#btn-changelog')) { 
        document.getElementById('changelog-modal').style.display = 'flex'; 
        const cb = document.getElementById('hide-changelog-checkbox');
        if (cb) cb.checked = (localStorage.getItem('meme_changelog_v2_2') === 'true');
        return; 
    }
    if (e.target.closest('#close-changelog') || e.target === document.getElementById('changelog-modal')) { document.getElementById('changelog-modal').style.display = 'none'; return; }
    if (e.target.closest('#btn-open-ascend')) { document.getElementById('ascend-modal').style.display = 'flex'; updateUI(); return; }
    if (e.target.closest('#close-ascend') || e.target === document.getElementById('ascend-modal')) { document.getElementById('ascend-modal').style.display = 'none'; return; }

    if (e.target.closest('#btn-export-save')) {
        playSound('buy_upgrade');
        game.frenzy.active = false;
        saveGameData();
        const saveString = localStorage.getItem('meme_clicker_fb');
        const blob = new Blob([saveString], {type: "text/plain;charset=utf-8"});
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "meme_clicker_save_2026.txt";
        a.click();
        showToast("📥 Save úspěšně stažen!");
        return;
    }

    if (e.target.closest('#btn-import-save')) {
        document.getElementById('import-save-upload').click();
        return;
    }

    if (e.target.closest('#btn-refresh-boss')) {
        const btn = e.target.closest('#btn-refresh-boss');
        btn.innerHTML = "⏳";
        btn.disabled = true;

        if (db) {
            try {
                const bossRef = doc(db, "global_events", "boss");
                const docSnap = await getDoc(bossRef);
                if (docSnap.exists()) {
                    let data = docSnap.data();
                    let now = Date.now();
                    let lastUpdate = data.lastUpdate || now;
                    let missedSeconds = (now - lastUpdate) / 1000;
                    let missedHeal = (data.maxHp * 0.01 / 3600) * missedSeconds;
                    
                    globalBoss.level = data.level;
                    globalBoss.maxHp = data.maxHp;
                    globalBoss.currentHp = Math.min(data.maxHp, data.currentHp + missedHeal);
                    globalBoss.lastUpdate = now;

                    localStorage.setItem('meme_boss_local', JSON.stringify(globalBoss));
                    updateBossUI();
                    showToast("✅ Boss data aktualizována!");
                }
            } catch(err) {
                showToast("❌ Chyba při aktualizaci!");
            }
        }

        setTimeout(() => {
            btn.innerHTML = "🔄 Aktualizovat";
            btn.disabled = false;
        }, 1000);
        return;
    }

    if (e.target.closest('#btn-unlock-boss')) {
        if (game.score >= 1000000) {
            game.score -= 1000000; window._AC.s -= 1000000;
            game.bossUnlocked = true;
            playSound('achievement');
            updateUI();
            saveGameData();
        } else {
            playSound('error');
            showToast("Nemáš dostatek bodů (1M)!");
        }
        return;
    }

    if (e.target.closest('#boss-click-btn')) {
        let rawDmg = game.boss.weaponDmg * game.boss.weaponCount * game.boss.enchantMult;
        
        let isCrit = false;
        if (game.boss.critChance > 0 && (Math.random() * 100) < game.boss.critChance) {
            rawDmg *= (game.boss.critDmg || 2.0);
            isCrit = true;
        }

        const rawDef = (globalBoss.level - 1) * 15;
        const bossDef = Math.max(0, rawDef - (game.boss.armorPen || 0));
        
        let effectiveDmg = 0;
        if (isCrit) {
            effectiveDmg = rawDmg; 
        } else {
            effectiveDmg = Math.max(0, rawDmg - bossDef);
        }

        const moneyDrop = 1 * game.boss.goldMult;
        const xpDrop = 1 * game.boss.xpMult;

        game.boss.money += moneyDrop;
        game.boss.xp += xpDrop;
        game.boss.totalDmg = (game.boss.totalDmg || 0) + effectiveDmg;
        
        let reqXp = getBossReqXp(game.boss.level);
        while (game.boss.xp >= reqXp) {
            game.boss.xp -= reqXp;
            game.boss.level++;
            reqXp = getBossReqXp(game.boss.level);
            playSound('achievement');
            showToast(`🔥 Level UP! Jsi na Boss Lvl ${game.boss.level}`);
        }

        if (effectiveDmg > 0) {
            pendingBossDamage += effectiveDmg;
            game.boss.currentBossDmg = (game.boss.currentBossDmg || 0) + effectiveDmg; 
            globalBoss.currentHp -= effectiveDmg; 
            if (isCrit) playSound('crit'); else playSound('hit');
        } else {
            playSound('error');
        }
        
        const btnNode = document.getElementById('boss-click-btn');
        btnNode.style.transform = 'scale(0.85)';
        setTimeout(() => btnNode.style.transform = 'scale(1)', 50);

        const rect = btnNode.getBoundingClientRect();
        if (effectiveDmg > 0) {
            let dmgText = isCrit ? `💥 CRIT! -${formatNumber(effectiveDmg)}` : `⚔️ -${formatNumber(effectiveDmg)}`;
            spawnParticle(rect.left + window.scrollX + rect.width/2, rect.top + window.scrollY + rect.height/2, dmgText);
        } else {
            spawnParticle(rect.left + window.scrollX + rect.width/2, rect.top + window.scrollY + rect.height/2, `🛡️ BLOK (${formatNumber(bossDef)} DEF)`);
        }

        if (Math.random() > 0.5) spawnParticle(rect.left + window.scrollX + rect.width/2, rect.top + window.scrollY + rect.height/2 + 20, `💰 +${formatNumber(moneyDrop)}`);
        if (Math.random() > 0.5) spawnParticle(rect.left + window.scrollX + rect.width/2, rect.top + window.scrollY + rect.height/2 - 20, `✨ +${formatNumber(xpDrop)}`);
        
        updateBossUI();
        return;
    }

    if (e.target.closest('#btn-boss-upg-dmg')) {
        if (game.boss.money >= game.boss.costs.weaponDmg) {
            game.boss.money -= game.boss.costs.weaponDmg;
            game.boss.weaponDmg += 1;
            game.boss.costs.weaponDmg = Math.floor(game.boss.costs.weaponDmg * 1.5);
            playSound('buy_upgrade'); updateBossUI(); saveGameData();
        } else { playSound('error'); }
        return;
    }

    if (e.target.closest('#btn-boss-upg-gold') && game.boss.level >= 2) {
        if (game.boss.money >= game.boss.costs.goldMult) {
            game.boss.money -= game.boss.costs.goldMult;
            game.boss.goldMult += 1;
            game.boss.costs.goldMult = Math.floor(game.boss.costs.goldMult * 2);
            playSound('buy_upgrade'); updateBossUI(); saveGameData();
        } else { playSound('error'); }
        return;
    }

    if (e.target.closest('#btn-boss-upg-xp') && game.boss.level >= 3) {
        if (game.boss.money >= game.boss.costs.xpMult) {
            game.boss.money -= game.boss.costs.xpMult;
            game.boss.xpMult += 1;
            game.boss.costs.xpMult = Math.floor(game.boss.costs.xpMult * 2);
            playSound('buy_upgrade'); updateBossUI(); saveGameData();
        } else { playSound('error'); }
        return;
    }

    if (e.target.closest('#btn-boss-upg-count') && game.boss.level >= 5) {
        if (game.boss.money >= game.boss.costs.weaponCount) {
            game.boss.money -= game.boss.costs.weaponCount;
            game.boss.weaponCount += 1;
            game.boss.costs.weaponCount = Math.floor(game.boss.costs.weaponCount * 3);
            playSound('buy_upgrade'); updateBossUI(); saveGameData();
        } else { playSound('error'); }
        return;
    }

    if (e.target.closest('#btn-boss-upg-crit-c') && game.boss.level >= 8) {
        if (game.boss.money >= game.boss.costs.critChance) {
            game.boss.money -= game.boss.costs.critChance;
            game.boss.critChance += 1;
            game.boss.costs.critChance = Math.floor(game.boss.costs.critChance * 2);
            playSound('buy_upgrade'); updateBossUI(); saveGameData();
        } else { playSound('error'); }
        return;
    }

    if (e.target.closest('#btn-boss-upg-enchant') && game.boss.level >= 10) {
        if (game.boss.money >= game.boss.costs.enchantMult) {
            game.boss.money -= game.boss.costs.enchantMult;
            game.boss.enchantMult += 1;
            game.boss.costs.enchantMult = Math.floor(game.boss.costs.enchantMult * 5);
            playSound('buy_upgrade'); updateBossUI(); saveGameData();
        } else { playSound('error'); }
        return;
    }

    if (e.target.closest('#btn-boss-upg-crit-d') && game.boss.level >= 12) {
        if (game.boss.money >= game.boss.costs.critDmg) {
            game.boss.money -= game.boss.costs.critDmg;
            game.boss.critDmg += 0.5;
            game.boss.costs.critDmg = Math.floor(game.boss.costs.critDmg * 2.5);
            playSound('buy_upgrade'); updateBossUI(); saveGameData();
        } else { playSound('error'); }
        return;
    }

    if (e.target.closest('#btn-boss-upg-pen') && game.boss.level >= 15) {
        if (game.boss.money >= game.boss.costs.armorPen) {
            game.boss.money -= game.boss.costs.armorPen;
            game.boss.armorPen += 5;
            game.boss.costs.armorPen = Math.floor(game.boss.costs.armorPen * 2.5);
            playSound('buy_upgrade'); updateBossUI(); saveGameData();
        } else { playSound('error'); }
        return;
    }

    if (e.target.closest('#btn-boss-upg-auto') && game.boss.level >= 20) {
        if (game.boss.money >= game.boss.costs.autoAttack) {
            game.boss.money -= game.boss.costs.autoAttack;
            game.boss.autoAttack += 1;
            game.boss.costs.autoAttack = Math.floor(game.boss.costs.autoAttack * 3);
            playSound('buy_upgrade'); updateBossUI(); saveGameData();
        } else { playSound('error'); }
        return;
    }

    const impBtn = e.target.closest('.buy-imp');
    if (impBtn) {
        const key = impBtn.dataset.key;
        const currentLvl = game.improvements[key] || 0;
        if (currentLvl < 4) {
            const cost = impBaseCosts[key] * Math.pow(10, currentLvl);
            if (game.score >= cost) {
                game.score -= cost; window._AC.s -= cost;
                game.improvements[key] = currentLvl + 1;
                playSound('buy_upgrade');
                updateUI();
                saveGameData(); 
            } else { playSound('error'); }
        }
        return;
    }

    if (e.target.closest('#btn-ascend-reset')) {
        const pending = calculatePendingAP();
        if (pending > 0) {
            if (confirm(`Opravdu chceš udělat Ascend Reset? Ztratíš budovy a aktuální skóre, ale získáš ${pending} AP pro Ascend Tree!`)) {
                playSound('ascend');
                game.ascend.points += pending;
                game.ascend.totalPointsClaimed += pending;
                
                const savedAscend = game.ascend; 
                const savedNick = game.nick;
                const savedCosmetics = game.cosmetics; 
                const savedAch = game.unlockedAchievements; 
                const savedTotal = game.totalScore;
                const savedCrypto = game.crypto;
                const savedFrenzy = game.frenzy;
                const savedSpins = game.casinoSpins;
                const savedBoss = game.boss;
                const savedBossUnlocked = game.bossUnlocked;
                
                game = JSON.parse(JSON.stringify(defaultState));
                
                game.ascend = savedAscend; 
                game.nick = savedNick; 
                game.cosmetics = savedCosmetics; 
                game.unlockedAchievements = savedAch; 
                game.totalScore = savedTotal;
                game.crypto = savedCrypto;
                game.frenzy = savedFrenzy;
                game.casinoSpins = savedSpins;
                game.boss = savedBoss;
                game.bossUnlocked = savedBossUnlocked;
                
                window._AC.s = game.score; window._AC.t = game.totalScore;
                
                saveGameData(); 
                document.getElementById('ascend-modal').style.display = 'none';
                updateUI();
            }
        }
        return;
    }

    if (e.target.closest('#buy-ascend-crypto')) {
        if (!game.ascend.upgrades.cryptoUnlocked && game.ascend.points >= 2) {
            game.ascend.points -= 2;
            game.ascend.upgrades.cryptoUnlocked = 1;
            playSound('buy_upgrade'); updateUI(); saveGameData(); 
        } else { playSound('error'); }
        return;
    }

    if (e.target.closest('#buy-ascend-casino')) {
        if (!game.ascend.upgrades.casinoUnlocked && game.ascend.points >= 2) {
            game.ascend.points -= 2;
            game.ascend.upgrades.casinoUnlocked = 1;
            playSound('buy_upgrade'); updateUI(); saveGameData(); 
        } else { playSound('error'); }
        return;
    }

    if (e.target.closest('#buy-ascend-click')) {
        const lvl = game.ascend.upgrades.click || 0;
        const cost = Math.ceil(1 * Math.pow(1.5, lvl));
        if (game.ascend.points >= cost) {
            game.ascend.points -= cost;
            game.ascend.upgrades.click = lvl + 1;
            playSound('buy_upgrade'); updateUI(); saveGameData(); 
        } else { playSound('error'); }
        return;
    }

    if (e.target.closest('#buy-ascend-bps')) {
        const lvl = game.ascend.upgrades.bps || 0;
        const cost = Math.ceil(1 * Math.pow(1.5, lvl));
        if (game.ascend.points >= cost) {
            game.ascend.points -= cost;
            game.ascend.upgrades.bps = lvl + 1;
            playSound('buy_upgrade'); updateUI(); saveGameData(); 
        } else { playSound('error'); }
        return;
    }

    if (e.target.closest('#btn-crypto-buy')) {
        if (game.score >= game.crypto.price) {
            game.score -= game.crypto.price; window._AC.s -= game.crypto.price;
            game.crypto.coins += 1; 
            game.crypto.totalProfit -= game.crypto.price; 
            playSound('buy_upgrade'); updateUI(); saveGameData(); 
        } else { playSound('error'); }
        return;
    }
    if (e.target.closest('#btn-crypto-buy-max')) {
        const amount = Math.floor(game.score / game.crypto.price);
        if (amount > 0) {
            const cost = amount * game.crypto.price;
            game.score -= cost; window._AC.s -= cost;
            game.crypto.coins += amount; 
            game.crypto.totalProfit -= cost; 
            playSound('buy_upgrade'); updateUI(); saveGameData(); 
        } else { playSound('error'); }
        return;
    }
    if (e.target.closest('#btn-crypto-sell')) {
        if (game.crypto.coins > 0) {
            const gain = game.crypto.coins * game.crypto.price;
            game.score += gain; window._AC.s += gain;
            game.crypto.totalProfit += gain; 
            game.crypto.coins = 0; 
            playSound('buy_cosmetic'); updateUI(); saveGameData(); 
        } else { playSound('error'); }
        return;
    }

    if (e.target.closest('#btn-bet-10')) { document.getElementById('casino-bet').value = Math.floor(game.score * 0.1); return; }
    if (e.target.closest('#btn-bet-50')) { document.getElementById('casino-bet').value = Math.floor(game.score * 0.5); return; }
    if (e.target.closest('#btn-bet-max')) { document.getElementById('casino-bet').value = Math.floor(game.score); return; }

    if (e.target.closest('#btn-casino-spin')) {
        const betInput = document.getElementById('casino-bet');
        let bet = parseInt(betInput.value);
        if (isNaN(bet) || bet <= 0 || bet > game.score) {
            playSound('error');
            showToast("Neplatná sázka nebo nemáš dost bodů!");
            return;
        }

        game.casinoSpins = (game.casinoSpins || 0) + 1;
        game.score -= bet; window._AC.s -= bet;
        updateUI();
        saveGameData(); 
        playSound('buy_upgrade');

        const btn = document.getElementById('btn-casino-spin');
        btn.disabled = true;

        const rand = Math.random();
        let mult = 0;
        let symbols = ['💩', '💩', '🤡'];

        if (rand < 0.01) { mult = 10; symbols = ['💎', '💎', '💎']; } 
        else if (rand < 0.05) { mult = 5; symbols = ['🚀', '🚀', '🚀']; } 
        else if (rand < 0.20) { mult = 2; symbols = ['🐸', '🐸', '🐸']; } 
        else {
            const pool = ['💩', '🤡', '💀', '📉'];
            symbols = [pool[Math.floor(Math.random()*pool.length)], pool[Math.floor(Math.random()*pool.length)], pool[Math.floor(Math.random()*pool.length)]];
            if(symbols[0] === symbols[1] && symbols[1] === symbols[2]) symbols[2] = '💀'; 
        }

        const reels = document.getElementById('slot-reels');
        let spins = 0;
        const pool = ['💩', '🤡', '💀', '📉', '🐸', '🚀', '💎'];
        const interval = setInterval(() => {
            reels.innerHTML = `<span>${pool[Math.floor(Math.random()*pool.length)]}</span><span>${pool[Math.floor(Math.random()*pool.length)]}</span><span>${pool[Math.floor(Math.random()*pool.length)]}</span>`;
            playSound('spin');
            spins++;
            
            if (spins > 10) {
                clearInterval(interval);
                reels.innerHTML = `<span>${symbols[0]}</span><span>${symbols[1]}</span><span>${symbols[2]}</span>`;
                btn.disabled = false;

                if (mult > 0) {
                    const win = bet * mult;
                    game.score += win; window._AC.s += win;
                    playSound('achievement');
                    showToast(`🎰 VÝHRA! Získáváš ${formatNumber(win)} bodů!`);
                } else {
                    playSound('error');
                    showToast(`🎰 Prohra... Zkus to znovu!`);
                }
                updateUI();
                saveGameData(); 
            }
        }, 100);
        return;
    }

    const clickBtn = e.target.closest('#click-btn');
    if (clickBtn) {
        if (!game.startTime) game.startTime = Date.now();

        // 🛡️ AGRESIVNÍ ANTI-AUTOCLICKER 🛡️
        if (!window.clickData) window.clickData = { time: Date.now(), count: 0 };
        const nowClick = Date.now();
        
        if (window.clickData.banUntil && nowClick < window.clickData.banUntil) return; // Je zabanován
        
        if (nowClick - window.clickData.time > 1000) {
            window.clickData.time = nowClick;
            window.clickData.count = 0;
        }
        window.clickData.count++;
        
        if (window.clickData.count > 30) {
            window.clickData.banUntil = nowClick + 5000; // 5 sekund ban na klikání
            showToast("🛑 DETEKOVÁN AUTOCLICKER! Klikání zablokováno na 5 vteřin.");
            playSound('error');
            return;
        }
        // ---------------------------------

        const frenzyMult = (game.frenzy && game.frenzy.active && game.frenzy.type === 'click') ? game.frenzy.multiplier : 1;
        const globalMult = getMultiplier();
        const ascendClickMult = 1 + ((game.ascend.upgrades.click || 0) * 0.50);
        const totalMult = globalMult * ascendClickMult * frenzyMult;

        const clickImpLvl = game.improvements.click || 0;
        const clickImpMult = 1 + (impClickBonuses[clickImpLvl] || 0); 
        
        const click2ImpLvl = game.improvements.click2 || 0;
        const click2ImpMult = 1 + (impClickBonuses[click2ImpLvl] || 0); 

        const playerBasePower = (game.clickPower * clickImpMult) + ((game.click2Power || 0) * click2ImpMult);
        const playerGain = playerBasePower * totalMult;
        
        const klikatorCount = game.klikatorCount || 0;
        const klikatorImpLvl = game.improvements.klikator || 0;
        const klikatorImpMult = 1 + (impClickBonuses[klikatorImpLvl] || 0);
        
        const klikatorSingleGain = playerBasePower * klikatorImpMult * totalMult;
        const klikatorTotalGain = klikatorCount * klikatorSingleGain;

        const gain = playerGain + klikatorTotalGain;
        
        game.score += gain; game.totalScore += gain;
        window._AC.s += gain; window._AC.t += gain; // Stínová paměť
        game.clicks++;
        
        let soundKey = 'click_' + game.cosmetics.currentSkin;
        if(game.cosmetics.currentSkin === 'custom') soundKey = 'click_custom';
        if(!['click_default', 'click_doge', 'click_custom'].includes(soundKey)) soundKey = 'click_default';
        playSound(soundKey);
        
        const rect = clickBtn.getBoundingClientRect();
        const texts = ['BOOP', 'STONKS', 'SHEESH', 'W', 'FR FR', 'CHAD'];
        spawnParticle(rect.left + window.scrollX + rect.width/2, rect.top + window.scrollY + rect.height/2, texts[Math.floor(Math.random()*texts.length)] + ' +'+formatNumber(playerGain));

        const miniHands = document.querySelectorAll('.klikator-mini-hand');
        miniHands.forEach((hand) => {
            const base = hand.dataset.baseTransform;
            hand.style.transform = base + ' scale(1.5)';
            setTimeout(() => { if(hand) hand.style.transform = base; }, 50);

            if (klikatorCount <= 10 || Math.random() < (10 / klikatorCount)) {
                 const handRect = hand.getBoundingClientRect();
                 spawnParticle(handRect.left + window.scrollX + handRect.width/2, handRect.top + window.scrollY + handRect.height/2, '🤖 +'+formatNumber(klikatorSingleGain));
            }
        });

        updateUI();
        return;
    }

    const bldBtn = e.target.closest('.upgrades-container .btn[id^="bld-"]');
    if (bldBtn) {
        const id = bldBtn.id.replace('bld-', '');
        if (game.score >= game.costs[id]) {
            game.score -= game.costs[id]; window._AC.s -= game.costs[id];
            game.buildings[id]++; game.costs[id] = Math.floor(game.costs[id] * 1.15);
            playSound('buy_upgrade'); updateUI(); saveGameData(); 
        } else { playSound('error'); }
        return;
    }

    if (e.target.closest('#upg-click')) {
        if (game.score >= game.costs.click) {
            game.score -= game.costs.click; window._AC.s -= game.costs.click;
            game.clickPower += 1; game.costs.click = Math.floor(game.costs.click * 1.15);
            playSound('buy_upgrade'); updateUI(); saveGameData(); 
        } else { playSound('error'); }
        return;
    }

    if (e.target.closest('#upg-click2')) {
        if (game.score >= game.costs.click2) {
            game.score -= game.costs.click2; window._AC.s -= game.costs.click2;
            game.click2Level = (game.click2Level || 0) + 1; 
            game.click2Power = (game.click2Power || 0) + 5;
            game.costs.click2 = Math.floor(game.costs.click2 * 1.15);
            playSound('buy_upgrade'); updateUI(); saveGameData(); 
        } else { playSound('error'); }
        return;
    }

    if (e.target.closest('#upg-klikator')) {
        if (game.score >= game.costs.klikator) {
            game.score -= game.costs.klikator; window._AC.s -= game.costs.klikator;
            game.klikatorCount = (game.klikatorCount || 0) + 1;
            game.costs.klikator = Math.floor(game.costs.klikator * 1.15);
            playSound('buy_upgrade'); updateUI(); saveGameData(); 
        } else { playSound('error'); }
        return;
    }

    const cosmeticBtn = e.target.closest('.buy-cosmetic');
    if (cosmeticBtn) {
        const type = cosmeticBtn.dataset.type, id = cosmeticBtn.dataset.id, cost = parseInt(cosmeticBtn.dataset.cost);
        const unlockedList = type === 'skin' ? game.cosmetics.skinsUnlocked : game.cosmetics.bgsUnlocked;
        
        if (id === 'custom') {
            if (unlockedList.includes(id)) {
                game.cosmetics.currentSkin = id;
                document.getElementById('custom-image-upload')?.click();
                playSound('buy_cosmetic');
                saveGameData(); 
            } else if (game.score >= cost) {
                game.score -= cost; window._AC.s -= cost;
                unlockedList.push(id); game.cosmetics.currentSkin = id;
                document.getElementById('custom-image-upload')?.click();
                playSound('buy_cosmetic');
                saveGameData(); 
            } else { playSound('error'); }
        } else {
            if (unlockedList.includes(id)) {
                if (type === 'skin') game.cosmetics.currentSkin = id; else game.cosmetics.currentBg = id;
                playSound('buy_cosmetic');
                saveGameData(); 
            } else if (game.score >= cost) {
                game.score -= cost; window._AC.s -= cost;
                unlockedList.push(id);
                if (type === 'skin') game.cosmetics.currentSkin = id; else game.cosmetics.currentBg = id;
                playSound('buy_cosmetic');
                saveGameData(); 
            } else { playSound('error'); }
        }
        updateUI();
        return;
    }

    if (e.target.closest('#btn-submit')) {
        if(game.totalScore < 100) { playSound('error'); alert('Nahraj aspoň 100 celkových bodů kámo.'); return; }
        
        const MAX_LEGIT_SCORE = 100000000000000000000;
        if (game.totalScore > MAX_LEGIT_SCORE || game.score > MAX_LEGIT_SCORE) {
            playSound('error');
            alert('☠️ ANTI-CHEAT DETEKCE ☠️\nTvé skóre je matematicky nemožné. Odeslání do Leaderboardu bylo zablokováno.');
            return; 
        }

        playSound('submit');
        let nick = game.nick;
        if (!nick || nick.trim() === '') {
            const inputNick = prompt("Zadej svůj nick:");
            if(inputNick && inputNick.trim() !== '') { nick = inputNick.substring(0,15); game.nick = nick; } else return;
        }
        const elapsed = game.startTime ? (Date.now() - game.startTime) : 0;
        const timeStr = formatTime(elapsed);
        const finalTotalScore = game.totalScore; const finalCurrentScore = game.score;
        let ach = game.unlockedAchievements ? game.unlockedAchievements.length : 0;
        const btn = document.getElementById('btn-submit');
        btn.disabled = true; fastText('btn-submit', "⏳ ODESÍLÁM...");

        if(db) {
            try {
                const docRef = doc(db, "clicker_leaderboard", nick);
                await setDoc(docRef, { name: nick, score: finalTotalScore, current: finalCurrentScore, time: timeStr, achievements: ach, bossDmg: game.boss.totalDmg || 0, timestamp: Date.now() });
                showToast('Zapsáno do Firebase! Ostatní uvidí tvůj celkový i nynější zisk.');
            } catch(err) { showToast("Chyba při zápisu, ukládám lokálně."); saveLocally(nick, finalTotalScore, timeStr, finalCurrentScore); }
        } else { saveLocally(nick, finalTotalScore, timeStr, finalCurrentScore); }
        
        saveGameData();
        btn.disabled = false; fastText('btn-submit', "🚀 SUBMIT DO LEADERBOARDU 🚀");
        document.getElementById('btn-refresh-lb')?.click();
        return;
    }

    if (e.target.closest('#btn-refresh-lb')) {
        fastText('loading-lb', "⏳ Načítám...");
        sessionStorage.removeItem('cached_lb'); 
        fetchLeaderboard().then(() => {
            fastText('loading-lb', db ? "(Připojeno)" : "(Lokální mód)");
        });
        return;
    }

    if (e.target.closest('#btn-hard-reset')) {
        if(confirm('Chceš fakt smazat i skóre a lokální data? Není cesty zpět!')) {
            clearInterval(gameLoop);
            localStorage.removeItem('meme_clicker_backup_total'); 
            localStorage.removeItem('meme_boss_local');
            game = JSON.parse(JSON.stringify(defaultState));
            localStorage.removeItem('meme_clicker_fb'); localStorage.removeItem('meme_lb_local'); 
            if (OFFLINE_MODE) localStorage.removeItem('dev_offline_mode');
            window.location.reload();
        }
        return;
    }
});

async function loadHTML() {
    try {
        const [upgradesHTML, clickerHTML, impHTML, shopHTML, cryptoHTML, casinoHTML, bossHTML] = await Promise.all([
            fetch('views/upgrades.html').then(res => res.text()),
            fetch('views/clicker.html').then(res => res.text()),
            fetch('views/improvements.html').then(res => res.text()),
            fetch('views/shop.html').then(res => res.text()),
            fetch('views/crypto.html').then(res => res.text()),
            fetch('views/casino.html').then(res => res.text()),
            fetch('views/boss.html').then(res => res.text())
        ]);

        document.getElementById('wrapper-upgrades').innerHTML = upgradesHTML;
        document.getElementById('wrapper-clicker').innerHTML = clickerHTML;
        document.getElementById('wrapper-improvements').innerHTML = impHTML;
        document.getElementById('wrapper-shop').innerHTML = shopHTML;
        document.getElementById('wrapper-crypto').innerHTML = cryptoHTML;
        
        const casinoWrapper = document.getElementById('wrapper-casino');
        if (casinoWrapper) casinoWrapper.innerHTML = casinoHTML;
        
        const bossWrapper = document.getElementById('wrapper-boss');
        if (bossWrapper) bossWrapper.innerHTML = bossHTML;
        
        currentViewsLoaded = true;

        if (document.getElementById('loading-lb')) {
            fastText('loading-lb', db ? "(Připojeno)" : "(Lokální mód)");
            document.getElementById('loading-lb').style.color = db ? "#2ecc71" : "#e74c3c";
        }

        setInterval(() => {
            sessionStorage.removeItem('cached_lb');
            fetchLeaderboard();
        }, 6 * 60 * 60 * 1000); 

        if (db && !BOSS_MAINTENANCE) {
            onSnapshot(doc(db, "global_events", "boss"), (docSnap) => {
                if (docSnap.exists()) {
                    let data = docSnap.data();

                    if (data.level === 1 && data.maxHp === 1000000) {
                        updateDoc(doc(db, "global_events", "boss"), { maxHp: 5000000, currentHp: data.currentHp + 4000000 }).catch(() => {});
                        return;
                    }

                    let now = Date.now();
                    let lastUpdate = data.lastUpdate || now;
                    let missedSeconds = (now - lastUpdate) / 1000;
                    let missedHeal = (data.maxHp * 0.01 / 3600) * missedSeconds;
                    
                    globalBoss.level = data.level;
                    globalBoss.maxHp = data.maxHp;
                    globalBoss.currentHp = Math.min(data.maxHp, data.currentHp + missedHeal);
                    globalBoss.lastUpdate = now;

                    localStorage.setItem('meme_boss_local', JSON.stringify(globalBoss));

                    if (globalBoss.currentHp <= 0 && !isBossSyncing) {
                        isBossSyncing = true;
                        const newLevel = globalBoss.level + 1;
                        const newMax = 5000000 * Math.pow(1.5, newLevel - 1);
                        updateDoc(doc(db, "global_events", "boss"), {
                            level: newLevel, maxHp: newMax, currentHp: newMax, lastUpdate: Date.now()
                        }).then(() => { isBossSyncing = false; }).catch(() => isBossSyncing = false);
                    }
                    updateBossUI();
                } else {
                    setDoc(doc(db, "global_events", "boss"), { level: 1, maxHp: 5000000, currentHp: 5000000, lastUpdate: Date.now() }).catch(() => {});
                }
            });
        }

        initImprovementsUI();
        fetchLeaderboard();
        renderAchievements();
        applyCosmetics();
        updateUI();

        if (localStorage.getItem('meme_changelog_v2_2') !== 'true') {
            setTimeout(() => {
                const modal = document.getElementById('changelog-modal');
                if (modal) {
                    modal.style.display = 'flex';
                    const cb = document.getElementById('hide-changelog-checkbox');
                    if (cb) cb.checked = false;
                }
            }, 500);
        }

        gameLoop = setInterval(async () => {
            try {
                const now = Date.now();
                fastText('timer', formatTime(now - game.startTime));
                
                let realDt = (now - game.lastTime) / 1000;
                if (isNaN(realDt)) realDt = 0.1; 
                if (realDt > 86400) realDt = 86400;
                if (realDt < 0) realDt = 0;

                game.lastTime = now;
                
                // 🛡️ SHADOW MEMORY VALIDACE 🛡️
                // Pevná tolerance pro float čísla (např. kvůli nepřesnému násobení)
                if (Math.abs(game.score - window._AC.s) > 10 || Math.abs(game.totalScore - window._AC.t) > 10) {
                    if (!window.cheatActive) {
                        game.score = window._AC.s; // Navrátíme ukradené skóre zpět!
                        game.totalScore = window._AC.t;
                        playSound('error');
                        showToast("☠️ ANTI-CHEAT: Nelegální úprava paměti!");
                        console.warn("Nezákonná úprava proměnné game.score zablokována.");
                    } else {
                        window.cheatActive = false; // Výjimka pro HESOYAM
                    }
                }
                
                const gain = getBPS() * realDt;
                if (gain > 0 && !isNaN(gain)) { 
                    game.score += gain; 
                    game.totalScore += gain;
                    window._AC.s += gain; // Ukládáme legitimní výnos do stínu
                    window._AC.t += gain;
                }

                let regenPerSec = globalBoss.maxHp * 0.01 / 3600;
                if (globalBoss.currentHp < globalBoss.maxHp && globalBoss.currentHp > 0) {
                    globalBoss.currentHp = Math.min(globalBoss.maxHp, globalBoss.currentHp + regenPerSec * realDt);
                }

                if (!BOSS_MAINTENANCE && globalBoss.level > game.boss.lastSeenBossLevel) {
                    let oldLevel = game.boss.lastSeenBossLevel;
                    let oldMaxHp = 5000000 * Math.pow(1.5, oldLevel - 1);
                    let percentDealt = ((game.boss.currentBossDmg || 0) / oldMaxHp) * 100;
                    
                    if (percentDealt >= 10) {
                        game.boss.bossKills = (game.boss.bossKills || 0) + 1;
                        
                        let goldReward = Math.floor(1000 * Math.pow(1.6, oldLevel) * game.boss.goldMult);
                        let xpReward = Math.floor(500 * Math.pow(1.4, oldLevel) * game.boss.xpMult);
                        
                        game.boss.money += goldReward;
                        game.boss.xp += xpReward;
                        
                        let reqXp = getBossReqXp(game.boss.level);
                        while (game.boss.xp >= reqXp) {
                            game.boss.xp -= reqXp;
                            game.boss.level++;
                            reqXp = getBossReqXp(game.boss.level);
                        }
                        
                        showToast(`🎉 Boss Lvl ${oldLevel} padl! Tvá odměna: 💰${formatNumber(goldReward)} ✨${formatNumber(xpReward)}`);
                        playSound('achievement');
                    } else if (game.boss.currentBossDmg > 0) {
                        showToast(`💀 Boss padl, ale tvůj podíl byl jen ${percentDealt.toFixed(1)}%. Bez odměny! (Nutno 10%)`);
                    }
                    
                    game.boss.currentBossDmg = 0;
                    game.boss.lastSeenBossLevel = globalBoss.level;
                    saveGameData();
                    updateBossUI();
                }

                if (!BOSS_MAINTENANCE && game.bossUnlocked && game.boss.autoAttack > 0) {
                    let autoHits = game.boss.autoAttack * realDt;
                    if (autoHits > 0) {
                        const rawDmg = game.boss.weaponDmg * game.boss.enchantMult;
                        const bossDef = Math.max(0, ((globalBoss.level - 1) * 15) - (game.boss.armorPen || 0));
                        
                        let critChance = game.boss.critChance || 0;
                        let critDmg = game.boss.critDmg || 2;
                        let nonCritChance = Math.max(0, 100 - critChance) / 100;
                        let critProb = critChance / 100;
                        
                        let nonCritDmg = Math.max(0, rawDmg - bossDef);
                        let expectedHitDmg = (nonCritDmg * nonCritChance) + (rawDmg * critDmg * critProb); 

                        const totalAutoDmg = expectedHitDmg * autoHits;

                        if (totalAutoDmg > 0 && !isNaN(totalAutoDmg)) {
                            pendingBossDamage += totalAutoDmg;
                            game.boss.totalDmg = (game.boss.totalDmg || 0) + totalAutoDmg;
                            game.boss.currentBossDmg = (game.boss.currentBossDmg || 0) + totalAutoDmg;
                            globalBoss.currentHp -= totalAutoDmg;
                            
                            let moneyDrop = (1 * game.boss.goldMult) * autoHits;
                            let xpDrop = (1 * game.boss.xpMult) * autoHits;
                            game.boss.money += moneyDrop;
                            game.boss.xp += xpDrop;
                            
                            let reqXp = getBossReqXp(game.boss.level);
                            while (game.boss.xp >= reqXp) {
                                game.boss.xp -= reqXp;
                                game.boss.level++;
                                reqXp = getBossReqXp(game.boss.level);
                                playSound('achievement');
                                showToast(`🔥 Level UP (Auto)! Jsi na Boss Lvl ${game.boss.level}`);
                            }
                        }
                    }
                }

                cryptoTimer += 100;
                if (cryptoTimer >= 5000) {
                    cryptoTimer = 0;
                    if (game.ascend.upgrades.cryptoUnlocked) {
                        window.cheatActive = true; 
                        if (Math.random() < 0.001) { 
                            game.crypto.coins = 0; window._AC.s -= game.crypto.coins; // sync stínu
                            game.crypto.price = 10;
                            showToast("📉 KRYPTO BURZA ZKRACHOVALA! Všechny tvé MemeCoiny jsou pryč!");
                            playSound('crash');
                            saveGameData();
                        } else {
                            let change = (Math.random() * 0.35) - 0.15;
                            game.crypto.price = Math.max(10, Math.floor(game.crypto.price * (1 + change)));
                        }
                        
                        if (!game.crypto.history) game.crypto.history = [];
                        game.crypto.history.push(game.crypto.price);
                        if (game.crypto.history.length > 20) game.crypto.history.shift();
                        
                        renderCryptoChart();
                    }
                }

                goldenTimer += 100;
                if (goldenTimer >= nextGolden) {
                    goldenTimer = 0;
                    nextGolden = Math.random() * 60000 + 60000; 
                    spawnGoldenMeme();
                }

                if (!BOSS_MAINTENANCE && pendingBossDamage > 0 && db && !isBossSyncing && (now - lastBossSyncTime > 5000)) {
                    isBossSyncing = true;
                    lastBossSyncTime = now;
                    let dmgToSend = pendingBossDamage;
                    pendingBossDamage = 0;
                    try {
                        await updateDoc(doc(db, "global_events", "boss"), {
                            currentHp: increment(-dmgToSend),
                            lastUpdate: Date.now()
                        });
                    } catch(e) {
                        pendingBossDamage += dmgToSend; 
                    }
                    isBossSyncing = false;
                } else if (!BOSS_MAINTENANCE && pendingBossDamage > 0 && !db) {
                    globalBoss.currentHp -= pendingBossDamage;
                    pendingBossDamage = 0;
                    if (globalBoss.currentHp <= 0) {
                        globalBoss.level += 1;
                        globalBoss.maxHp = 5000000 * Math.pow(1.5, globalBoss.level - 1);
                        globalBoss.currentHp = globalBoss.maxHp;
                        globalBoss.lastUpdate = Date.now();
                    }
                    localStorage.setItem('meme_boss_local', JSON.stringify(globalBoss));
                    updateBossUI();
                }

                const fd = document.getElementById('frenzy-display');
                if (game.frenzy && game.frenzy.active) {
                    if (now > game.frenzy.endTime) {
                        game.frenzy.active = false;
                        game.frenzy.multiplier = 1;
                        document.body.classList.remove('frenzy-active');
                        if(fd) fd.style.display = 'none';
                        showToast("Frenzy skončilo!");
                        saveGameData();
                    } else {
                        document.body.classList.add('frenzy-active');
                        if(fd) {
                            fd.style.display = 'block';
                            fastText('frenzy-name', game.frenzy.type === 'click' ? '🌟 CLICK FRENZY 🌟' : '🌟 BUILDING FRENZY 🌟');
                            let timeLeft = game.frenzy.endTime - now;
                            fastText('frenzy-time', (timeLeft / 1000).toFixed(1) + 's');
                            document.getElementById('frenzy-bar').style.width = (timeLeft / game.frenzy.duration * 100) + '%';
                        }
                    }
                } else {
                    document.body.classList.remove('frenzy-active');
                    if(fd) fd.style.display = 'none';
                }

                updateUI();
                if(!db) updateBossUI();
                
                if (now - lastSaveTime > 3000) {
                    saveGameData();
                    lastSaveTime = now;
                }
            } catch (err) {
                console.error("Kritická chyba v herní smyčce:", err);
            }
        }, 100);

    } catch (error) {
        console.error("Chyba při načítání UI:", error);
    }
}

document.addEventListener('DOMContentLoaded', loadHTML);