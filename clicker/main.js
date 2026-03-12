import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

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
try { const app = initializeApp(firebaseConfig); db = getFirestore(app); } catch(e) {}

const bldKeys = ["auto", "factory", "mine", "ai", "tiktok", "elon", "matrix", "crypto", "metaverse", "alien"];
const bldNames = { click: "Klikání", click2: "Super Klik", auto: "Trol", factory: "Farma", mine: "Důl", ai: "AI", tiktok: "TikTok", elon: "Elon", matrix: "Matrix", crypto: "Krypto", metaverse: "Metaverse", alien: "UFO" };
const bpsRates = { auto: 1, factory: 10, mine: 50, ai: 250, tiktok: 1500, elon: 10000, matrix: 50000, crypto: 300000, metaverse: 2000000, alien: 50000000 };

const impMilestones = [10, 25, 50, 100];
const impBonuses = [0, 0.10, 0.25, 0.50, 1.00];
const impLabels = [0, 10, 25, 50, 100]; 
const impClickBonuses = [0, 1.00, 2.00, 3.00, 4.00];
const impClickLabels = [0, 100, 200, 300, 400];
const impBaseCosts = { click: 100, click2: 1000, auto: 500, factory: 5000, mine: 30000, ai: 150000, tiktok: 1000000, elon: 10000000, matrix: 150000000, crypto: 1000000000, metaverse: 10000000000, alien: 500000000000 };

const defaultState = {
    nick: "", score: 0, totalScore: 0, clicks: 0, clickPower: 1, click2Level: 0, click2Power: 0,
    buildings: { auto: 0, factory: 0, mine: 0, ai: 0, tiktok: 0, elon: 0, matrix: 0, crypto: 0, metaverse: 0, alien: 0 },
    improvements: { click: 0, click2: 0, auto: 0, factory: 0, mine: 0, ai: 0, tiktok: 0, elon: 0, matrix: 0, crypto: 0, metaverse: 0, alien: 0 },
    costs: { click: 10, click2: 100, auto: 50, factory: 500, mine: 3000, ai: 15000, tiktok: 100000, elon: 1000000, matrix: 15000000, crypto: 100000000, metaverse: 1000000000, alien: 50000000000 },
    startTime: null, lastTime: Date.now(),
    cosmetics: { skinsUnlocked: ['default'], currentSkin: 'default', bgsUnlocked: ['default'], currentBg: 'default', customImage: null },
    unlockedAchievements: [],
    ascend: { points: 0, totalPointsClaimed: 0, upgrades: { click: 0, bps: 0, cryptoUnlocked: 0 } },
    crypto: { coins: 0, price: 100 },
    frenzy: { active: false, type: null, multiplier: 1, duration: 0, endTime: 0 },
    checksum: ""
};

const skinMap = { 'default': { type: 'text', val: '🔴' }, 'doge': { type: 'img', val: 'https://upload.wikimedia.org/wikipedia/en/5/5f/Original_Doge_meme.jpg' }, 'custom': { type: 'custom', val: '' } };

const SECRET_SALT = "sigma_chad_2026_anticheat_v2";
function generateChecksum(score, total) { return btoa(Math.floor(score) + "_" + Math.floor(total) + "_" + SECRET_SALT); }

let game = JSON.parse(localStorage.getItem('meme_clicker_fb')) || JSON.parse(JSON.stringify(defaultState));

if (game.score > 0 || game.totalScore > 0) {
    if (game.checksum !== generateChecksum(game.score, game.totalScore)) {
        console.warn("⚠️ Zjištěna manuální úprava LocalStorage. Skóre zresetováno.");
        game.score = 0; game.totalScore = 0;
    }
}

if (isNaN(game.score) || game.score == null) game.score = 0;
if (isNaN(game.totalScore) || game.totalScore == null) game.totalScore = game.score;
if (isNaN(game.clicks) || game.clicks == null) game.clicks = 0;
if (isNaN(game.clickPower) || game.clickPower == null) game.clickPower = 1;
if (isNaN(game.click2Level) || game.click2Level == null) game.click2Level = 0;
if (isNaN(game.click2Power) || game.click2Power == null) game.click2Power = 0;
if (!game.buildings) game.buildings = {};
if (!game.improvements) game.improvements = {};
if (!game.costs) game.costs = {};
if (!game.unlockedAchievements) game.unlockedAchievements = [];
if (!game.cosmetics) game.cosmetics = defaultState.cosmetics;

if (!game.ascend) game.ascend = { points: 0, totalPointsClaimed: 0, upgrades: { click: 0, bps: 0, cryptoUnlocked: 0 } };
if (game.ascend.upgrades === undefined) game.ascend.upgrades = { click: 0, bps: 0, cryptoUnlocked: 0 };
if (game.ascend.upgrades.bps === undefined) game.ascend.upgrades.bps = 0;
if (game.ascend.upgrades.cryptoUnlocked === undefined) game.ascend.upgrades.cryptoUnlocked = 0;

if (!game.crypto) game.crypto = { coins: 0, price: 100 };
if (!game.frenzy) game.frenzy = { active: false, type: null, multiplier: 1, duration: 0, endTime: 0 };

game.unlockedAchievements = game.unlockedAchievements.filter(a => !['easter_timer', 'easter_jicin', 'easter_sigma'].includes(a));
if (!game.cosmetics.customImage) game.cosmetics.customImage = null;
if (!skinMap[game.cosmetics.currentSkin]) game.cosmetics.currentSkin = 'default';
if (!game.startTime && game.score > 0) game.startTime = Date.now();
if (game.nick === undefined) game.nick = "";

if (isNaN(game.costs.click2) || game.costs.click2 == null) game.costs.click2 = 100;
if (isNaN(game.improvements.click2) || game.improvements.click2 == null) game.improvements.click2 = 0;

for (const key of bldKeys) {
    if (isNaN(game.buildings[key])) game.buildings[key] = 0;
    if (isNaN(game.costs[key])) game.costs[key] = defaultState.costs[key];
    if (isNaN(game.improvements[key])) game.improvements[key] = 0;
}
if (isNaN(game.improvements.click)) game.improvements.click = 0;

let expectedScore = game.score;
let expectedTotalScore = game.totalScore;
let clickTimes = [];
let localLeaderboard = JSON.parse(localStorage.getItem('meme_lb_local')) || [];
let gameLoop;
let currentViewsLoaded = false;
let goldenTimer = 0;
let nextGolden = Math.random() * 60000 + 60000;
let cryptoTimer = 0;

const allAchievements = [
    { id: 'first', name: '👶 První krůčky (1 klik)', req: () => game.clicks >= 1 },
    { id: 'hundred', name: '💯 Tryhard (100 kliků)', req: () => game.clicks >= 100 },
    { id: 'click2_10', name: '🖱️ Silný klik (10x Super Klik)', req: () => (game.click2Level || 0) >= 10 },
    { id: 'click2_50', name: '🖱️ God klik (50x Super Klik)', req: () => (game.click2Level || 0) >= 50 },
    { id: 'click2_100', name: '🖱️ Titan klik (100x Super Klik)', req: () => (game.click2Level || 0) >= 100 },
    { id: '1k_score', name: '💸 Drobné (1k bodů)', req: () => game.score >= 1000 },
    { id: '10k_score', name: '💸 Kapesné (10k bodů)', req: () => game.score >= 10000 },
    { id: '100k_score', name: '💸 Výplata (100k bodů)', req: () => game.score >= 100000 },
    { id: 'rich', name: '💸 Bohatýr (1M bodů)', req: () => game.score >= 1000000 },
    { id: 'billionaire', name: '💰 Miliardář (1B bodů)', req: () => game.score >= 1000000000 },
    { id: 'trillionaire', name: '👑 Vládce Vesmíru (1T bodů)', req: () => game.score >= 1000000000000 },
    { id: 'collector', name: '🛍️ Shopaholik (Všechny skiny)', req: () => game.cosmetics.skinsUnlocked.length >= Object.keys(skinMap).length },
    { id: 'ascended', name: '🌌 Nanebevstoupení', req: () => game.ascend.totalPointsClaimed >= 1 },
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
    { id: 'skin_doge_unlocked', name: '🐕 Wow Such Click (Doge Skin)', req: () => game.cosmetics.skinsUnlocked.includes('doge') },
    { id: 'skin_custom_unlocked', name: '🎨 Umělec (Vlastní Skin)', req: () => game.cosmetics.skinsUnlocked.includes('custom') },
    { id: 'bg_rainbow_unlocked', name: '🌈 Párty (RGB Pozadí)', req: () => game.cosmetics.bgsUnlocked.includes('rainbow') },
    { id: 'bg_dark_unlocked', name: '🕶️ Hacker (Dark Pozadí)', req: () => game.cosmetics.bgsUnlocked.includes('dark') }
];

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
    
    let result = total * getMultiplier() * ascendBpsMult;
    
    if (game.frenzy && game.frenzy.active && game.frenzy.type === 'bps') {
        result *= game.frenzy.multiplier;
    }
    
    return result; 
}

function formatNumber(num) {
    if (isNaN(num)) return "0";
    if (num >= 1000000000000) return (num / 1000000000000).toFixed(2) + ' T';
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + ' B';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + ' M';
    if (num >= 10000) return (num / 1000).toFixed(1) + ' k';
    return Math.floor(num);
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
    list.innerHTML = '';
    allAchievements.forEach(a => {
        const unlocked = game.unlockedAchievements.includes(a.id);
        list.innerHTML += `<div class="achievement ${unlocked ? 'unlocked' : ''}">
            <span>${a.name}</span><span>${unlocked ? '✔️' : '🔒'}</span>
        </div>`;
    });
}

function generateImprovementsHTML() {
    const list = document.getElementById('improvements-list');
    if (!list) return;
    let html = '';
    const keys = ["click", "click2", ...bldKeys];
    
    for (const key of keys) {
        const currentLvl = game.improvements[key] || 0;
        
        let count = 0;
        if (key === 'click') count = game.clickPower;
        else if (key === 'click2') count = game.click2Level || 0;
        else count = game.buildings[key] || 0;
        
        if (currentLvl < 4) {
            const reqAmount = impMilestones[currentLvl];
            const hasReq = count >= reqAmount;
            const cost = impBaseCosts[key] * Math.pow(10, currentLvl);
            const canAfford = game.score >= cost;
            
            let btnClass = "btn buy-imp";
            let btnStyle = hasReq ? "" : "background: #eee; color: #999; border-color: #ddd; cursor: not-allowed;";
            
            let currentLabel = (key === 'click' || key === 'click2') ? impClickLabels[currentLvl + 1] : impLabels[currentLvl + 1];
            
            let btnContent = "";
            if (hasReq) {
                btnContent = `${bldNames[key]} Vylepšení <span>${formatNumber(cost)}</span>
                              <small>Stav: ${currentLvl}/4 (+${currentLabel}% zisk)</small>`;
            } else {
                btnContent = `??? (Zamčeno) <span style="background:transparent; color:#999;">🔒</span>
                              <small style="color:#e74c3c; font-weight:bold;">Vyžaduje: ${reqAmount}x ${bldNames[key]}</small>`;
            }
            html += `<button class="${btnClass}" data-key="${key}" style="${btnStyle}" ${(!hasReq || !canAfford) ? 'disabled' : ''}>${btnContent}</button>`;
        } else {
            let maxLabel = (key === 'click' || key === 'click2') ? "400" : "100";
            html += `<button class="btn" style="background: #27ae60; color: white; border-color: #1e8449;" disabled>
                        ${bldNames[key]} Vylepšení <span style="background:transparent; color:white;">MAX</span>
                        <small>Stav: 4/4 (+${maxLabel}% zisk)</small>
                     </button>`;
        }
    }
    list.innerHTML = html;
}

function spawnParticle(x, y, text) {
    const p = document.createElement('div');
    p.className = 'particle'; 
    p.textContent = text;
    p.style.left = (x - 20 + Math.random()*40) + 'px'; 
    p.style.top = y + 'px';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1000);
}

function applyCosmetics() {
    const btn = document.getElementById('click-btn');
    const skinData = skinMap[game.cosmetics.currentSkin] || skinMap['default'];
    if (btn) {
        if (skinData.type === 'img') {
            btn.textContent = ''; btn.style.backgroundImage = `url('${skinData.val}')`;
            btn.style.backgroundColor = 'transparent'; btn.style.border = 'none';
        } else if (skinData.type === 'custom') {
            btn.textContent = ''; btn.style.backgroundImage = game.cosmetics.customImage ? `url('${game.cosmetics.customImage}')` : 'none';
            btn.style.backgroundColor = 'transparent'; btn.style.border = 'none';
        } else {
            btn.textContent = skinData.val; btn.style.backgroundImage = 'none';
            btn.style.backgroundColor = 'var(--secondary)'; btn.style.border = '6px solid #fff';
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
            if (isEquipped) { b.textContent = 'Vybaveno'; b.disabled = false; }
            else if (isUnlocked) { b.textContent = 'Vybavit'; b.disabled = false; }
            else { b.textContent = formatNumber(cost); b.disabled = game.score < cost; }
        } else {
            if (isEquipped) { b.textContent = 'Vybaveno'; b.disabled = false; }
            else if (isUnlocked) { b.textContent = 'Vybavit'; b.disabled = false; }
            else { b.textContent = formatNumber(cost); b.disabled = game.score < cost; }
        }
    });
}

function spawnGoldenMeme() {
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
    });

    setTimeout(() => {
        if (!clicked && gm.parentNode) gm.remove();
    }, 12000);
}

function updateUI() {
    if(!currentViewsLoaded) return;

    const scoreEl = document.getElementById('score');
    if (scoreEl) scoreEl.textContent = formatNumber(game.score);
    
    const totalScoreEl = document.getElementById('total-score-display');
    if (totalScoreEl) totalScoreEl.textContent = formatNumber(game.totalScore);
    
    const bpsEl = document.getElementById('bps');
    if (bpsEl) bpsEl.textContent = formatNumber(getBPS());

    const multEl = document.getElementById('mult-val');
    if (multEl) multEl.textContent = getMultiplier().toFixed(3);

    const clickCostEl = document.getElementById('cost-click');
    if (clickCostEl) {
        clickCostEl.textContent = formatNumber(game.costs.click);
        document.getElementById('lvl-click').textContent = `[${game.clickPower}]`;
        document.getElementById('upg-click').disabled = game.score < game.costs.click;
    }

    const click2CostEl = document.getElementById('cost-click2');
    if (click2CostEl) {
        click2CostEl.textContent = formatNumber(game.costs.click2);
        document.getElementById('lvl-click2').textContent = `[${game.click2Level || 0}]`;
        document.getElementById('upg-click2').disabled = game.score < game.costs.click2;
    }

    for(const key in game.buildings) {
        const costEl = document.getElementById(`cost-${key}`);
        const btnEl = document.getElementById(`bld-${key}`);
        const countEl = document.getElementById(`count-${key}`);
        if(costEl && btnEl) { 
            costEl.textContent = formatNumber(game.costs[key]); 
            btnEl.disabled = game.score < game.costs[key]; 
        }
        if(countEl) countEl.textContent = `[${game.buildings[key]}]`;
    }

    generateImprovementsHTML();

    const pendingAP = calculatePendingAP();
    const remainingScore = getNextAPScoreRequired();

    const apDisplay = document.getElementById('ap-display');
    if (apDisplay) apDisplay.textContent = formatNumber(game.ascend.points);

    const apPendingEl = document.getElementById('ap-pending');
    if (apPendingEl) apPendingEl.textContent = formatNumber(pendingAP);

    const btnAscendReset = document.getElementById('btn-ascend-reset');
    if (btnAscendReset) btnAscendReset.disabled = pendingAP === 0;

    const apNextReq = document.getElementById('ap-next-req');
    if (apNextReq) apNextReq.textContent = formatNumber(remainingScore);

    const clickLvl = game.ascend.upgrades.click || 0;
    const clickCost = Math.ceil(1 * Math.pow(1.5, clickLvl));
    const btnAscendClick = document.getElementById('buy-ascend-click');
    if (btnAscendClick) {
        document.getElementById('cost-ascend-click').textContent = formatNumber(clickCost);
        document.getElementById('lvl-ascend-click').textContent = clickLvl;
        btnAscendClick.disabled = game.ascend.points < clickCost;
    }

    const bpsLvl = game.ascend.upgrades.bps || 0;
    const bpsCost = Math.ceil(1 * Math.pow(1.5, bpsLvl));
    const btnAscendBps = document.getElementById('buy-ascend-bps');
    if (btnAscendBps) {
        document.getElementById('cost-ascend-bps').textContent = formatNumber(bpsCost);
        document.getElementById('lvl-ascend-bps').textContent = bpsLvl;
        btnAscendBps.disabled = game.ascend.points < bpsCost;
    }

    const cryptoPanel = document.getElementById('crypto-panel-ui');
    if (cryptoPanel) {
        cryptoPanel.style.display = game.ascend.upgrades.cryptoUnlocked ? 'block' : 'none';
        document.getElementById('crypto-price').textContent = formatNumber(game.crypto.price);
        document.getElementById('crypto-owned').textContent = formatNumber(game.crypto.coins);
    }

    const btnAscendCrypto = document.getElementById('buy-ascend-crypto');
    if (btnAscendCrypto) {
        if (game.ascend.upgrades.cryptoUnlocked) {
            btnAscendCrypto.disabled = true;
            document.getElementById('status-ascend-crypto').textContent = "Odemčeno";
        } else {
            btnAscendCrypto.disabled = game.ascend.points < 2;
        }
    }

    applyCosmetics();
    checkAchievements();
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
            if(snapshot.empty) { tbody.innerHTML = '<tr><td colspan="3">Firebase tabulka je prázdná.</td></tr>'; return; }
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
    tbody.innerHTML = '';
    data.forEach((d) => {
        tbody.innerHTML += `<tr>
            <td>${d.name}</td>
            <td style="font-weight:bold;color:#e67e22;">${formatNumber(d.score)}</td>
            <td>${formatNumber(d.current || 0)}</td>
        </tr>`;
    });
}

function renderLocalLeaderboard() {
    const tbody = document.getElementById('lb-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    localLeaderboard.slice(0, 10).forEach(entry => {
        tbody.innerHTML += `<tr>
            <td>${entry.name}</td>
            <td>${formatNumber(entry.score)}</td>
            <td>${formatNumber(entry.current || 0)}</td>
        </tr>`;
    });
    if(localLeaderboard.length === 0) tbody.innerHTML = '<tr><td colspan="3">Žádná data. Zkus nahrát skóre!</td></tr>';
}

function saveLocally(nick, score, timeStr, current) {
    let existing = localLeaderboard.find(entry => entry.name === nick);
    if (existing) {
        if (score > existing.score) {
            existing.score = score; existing.time = timeStr; existing.current = current;
        }
    } else {
        localLeaderboard.push({ name: nick, score: score, time: timeStr, current: current });
    }
    localLeaderboard.sort((a,b) => b.score - a.score);
    localStorage.setItem('meme_lb_local', JSON.stringify(localLeaderboard));
}

window.loadView = function(viewName) {
    document.getElementById('wrapper-clicker').style.display = viewName === 'clicker.html' ? 'block' : 'none';
    document.getElementById('wrapper-upgrades').style.display = viewName === 'upgrades.html' ? 'block' : 'none';
    document.getElementById('wrapper-improvements').style.display = viewName === 'improvements.html' ? 'block' : 'none';
    document.getElementById('wrapper-shop').style.display = viewName === 'shop.html' ? 'block' : 'none';
    if (viewName === 'shop.html') fetchLeaderboard();
};

document.addEventListener('click', async (e) => {
    if (e.target.closest('#btn-changelog')) { document.getElementById('changelog-modal').style.display = 'flex'; return; }
    if (e.target.closest('#close-changelog') || e.target === document.getElementById('changelog-modal')) { document.getElementById('changelog-modal').style.display = 'none'; return; }
    if (e.target.closest('#btn-open-ascend')) { document.getElementById('ascend-modal').style.display = 'flex'; updateUI(); return; }
    if (e.target.closest('#close-ascend') || e.target === document.getElementById('ascend-modal')) { document.getElementById('ascend-modal').style.display = 'none'; return; }

    const impBtn = e.target.closest('.buy-imp');
    if (impBtn) {
        const key = impBtn.dataset.key;
        const currentLvl = game.improvements[key] || 0;
        if (currentLvl < 4) {
            const cost = impBaseCosts[key] * Math.pow(10, currentLvl);
            if (game.score >= cost) {
                game.score -= cost;
                expectedScore -= cost;
                game.improvements[key] = currentLvl + 1;
                playSound('buy_upgrade');
                updateUI();
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
                
                game = JSON.parse(JSON.stringify(defaultState));
                
                game.ascend = savedAscend; 
                game.nick = savedNick; 
                game.cosmetics = savedCosmetics; 
                game.unlockedAchievements = savedAch; 
                game.totalScore = savedTotal;
                game.crypto = savedCrypto;
                game.frenzy = savedFrenzy;
                
                expectedScore = 0; 
                expectedTotalScore = game.totalScore; 
                
                game.checksum = generateChecksum(game.score, game.totalScore);
                localStorage.setItem('meme_clicker_fb', JSON.stringify(game));
                
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
            playSound('buy_upgrade'); updateUI();
        } else { playSound('error'); }
        return;
    }

    if (e.target.closest('#buy-ascend-click')) {
        const lvl = game.ascend.upgrades.click || 0;
        const cost = Math.ceil(1 * Math.pow(1.5, lvl));
        if (game.ascend.points >= cost) {
            game.ascend.points -= cost;
            game.ascend.upgrades.click = lvl + 1;
            playSound('buy_upgrade'); updateUI();
        } else { playSound('error'); }
        return;
    }

    if (e.target.closest('#buy-ascend-bps')) {
        const lvl = game.ascend.upgrades.bps || 0;
        const cost = Math.ceil(1 * Math.pow(1.5, lvl));
        if (game.ascend.points >= cost) {
            game.ascend.points -= cost;
            game.ascend.upgrades.bps = lvl + 1;
            playSound('buy_upgrade'); updateUI();
        } else { playSound('error'); }
        return;
    }

    // KRYPTO
    if (e.target.closest('#btn-crypto-buy')) {
        if (game.score >= game.crypto.price) {
            game.score -= game.crypto.price;
            expectedScore -= game.crypto.price;
            game.crypto.coins += 1;
            playSound('buy_upgrade'); updateUI();
        } else { playSound('error'); }
        return;
    }
    if (e.target.closest('#btn-crypto-buy-max')) {
        const amount = Math.floor(game.score / game.crypto.price);
        if (amount > 0) {
            game.score -= (amount * game.crypto.price);
            expectedScore -= (amount * game.crypto.price);
            game.crypto.coins += amount;
            playSound('buy_upgrade'); updateUI();
        } else { playSound('error'); }
        return;
    }
    if (e.target.closest('#btn-crypto-sell')) {
        if (game.crypto.coins > 0) {
            const gain = game.crypto.coins * game.crypto.price;
            game.score += gain;
            game.totalScore += gain;
            expectedScore += gain;
            expectedTotalScore += gain;
            game.crypto.coins = 0;
            playSound('buy_cosmetic'); updateUI();
        } else { playSound('error'); }
        return;
    }

    const clickBtn = e.target.closest('#click-btn');
    if (clickBtn) {
        const now = Date.now();
        clickTimes = clickTimes.filter(t => now - t < 1000);
        
        let limit = (game.frenzy && game.frenzy.active && game.frenzy.type === 'click') ? 30 : 15;
        if (clickTimes.length >= limit) { showToast("⚠️ Zpomal! Autoclicker limit dosažen!"); playSound('error'); return; }
        clickTimes.push(now);

        if (!game.startTime) game.startTime = Date.now();

        const clickImpLvl = game.improvements.click || 0;
        const clickImpMult = 1 + (impClickBonuses[clickImpLvl] || 0); 
        
        const click2ImpLvl = game.improvements.click2 || 0;
        const click2ImpMult = 1 + (impClickBonuses[click2ImpLvl] || 0); 

        const ascendClickLvl = game.ascend.upgrades.click || 0;
        const ascendClickMult = 1 + (ascendClickLvl * 0.50);
        
        const frenzyMult = (game.frenzy && game.frenzy.active && game.frenzy.type === 'click') ? game.frenzy.multiplier : 1;

        const baseClickGain = (game.clickPower * clickImpMult) + ((game.click2Power || 0) * click2ImpMult);
        const gain = baseClickGain * getMultiplier() * ascendClickMult * frenzyMult;
        
        game.score += gain; game.totalScore += gain;
        expectedScore += gain; expectedTotalScore += gain;
        game.clicks++;
        
        let soundKey = 'click_' + game.cosmetics.currentSkin;
        if(game.cosmetics.currentSkin === 'custom') soundKey = 'click_custom';
        if(!['click_default', 'click_doge', 'click_custom'].includes(soundKey)) soundKey = 'click_default';
        playSound(soundKey);
        
        const rect = clickBtn.getBoundingClientRect();
        const x = e.pageX !== undefined ? e.pageX : rect.left + window.scrollX + rect.width / 2;
        const y = e.pageY !== undefined ? e.pageY : rect.top + window.scrollY + rect.height / 2;
        
        const texts = ['BOOP', 'STONKS', '+'+formatNumber(gain), 'SHEESH', 'W', 'FR FR', 'CHAD'];
        spawnParticle(x, y, texts[Math.floor(Math.random()*texts.length)]);
        updateUI();
        return;
    }

    const bldBtn = e.target.closest('.upgrades-container .btn[id^="bld-"]');
    if (bldBtn) {
        const id = bldBtn.id.replace('bld-', '');
        if (game.score >= game.costs[id]) {
            game.score -= game.costs[id]; expectedScore -= game.costs[id];
            game.buildings[id]++; game.costs[id] = Math.floor(game.costs[id] * 1.15);
            playSound('buy_upgrade'); updateUI();
        } else { playSound('error'); }
        return;
    }

    if (e.target.closest('#upg-click')) {
        if (game.score >= game.costs.click) {
            game.score -= game.costs.click; expectedScore -= game.costs.click;
            game.clickPower += 1; game.costs.click = Math.floor(game.costs.click * 1.15);
            playSound('buy_upgrade'); updateUI();
        } else { playSound('error'); }
        return;
    }

    if (e.target.closest('#upg-click2')) {
        if (game.score >= game.costs.click2) {
            game.score -= game.costs.click2; expectedScore -= game.costs.click2;
            game.click2Level = (game.click2Level || 0) + 1; 
            game.click2Power = (game.click2Power || 0) + 5;
            game.costs.click2 = Math.floor(game.costs.click2 * 1.15);
            playSound('buy_upgrade'); updateUI();
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
            } else if (game.score >= cost) {
                game.score -= cost; expectedScore -= cost;
                unlockedList.push(id); game.cosmetics.currentSkin = id;
                document.getElementById('custom-image-upload')?.click();
                playSound('buy_cosmetic');
            } else { playSound('error'); }
        } else {
            if (unlockedList.includes(id)) {
                if (type === 'skin') game.cosmetics.currentSkin = id; else game.cosmetics.currentBg = id;
                playSound('buy_cosmetic');
            } else if (game.score >= cost) {
                game.score -= cost; expectedScore -= cost;
                unlockedList.push(id);
                if (type === 'skin') game.cosmetics.currentSkin = id; else game.cosmetics.currentBg = id;
                playSound('buy_cosmetic');
            } else { playSound('error'); }
        }
        updateUI();
        return;
    }

    if (e.target.closest('#btn-submit')) {
        if(game.totalScore < 100) { playSound('error'); alert('Nahraj aspoň 100 celkových bodů kámo.'); return; }
        playSound('submit');
        let nick = game.nick;
        if (!nick || nick.trim() === '') {
            const inputNick = prompt("Zadej svůj nick:");
            if(inputNick && inputNick.trim() !== '') { nick = inputNick.substring(0,15); game.nick = nick; } else return;
        }
        const elapsed = game.startTime ? (Date.now() - game.startTime) : 0;
        const timeStr = formatTime(elapsed);
        const finalTotalScore = game.totalScore; const finalCurrentScore = game.score;
        const btn = document.getElementById('btn-submit');
        btn.disabled = true; btn.textContent = "⏳ ODESÍLÁM...";

        if(db) {
            try {
                const docRef = doc(db, "clicker_leaderboard", nick);
                await setDoc(docRef, { name: nick, score: finalTotalScore, current: finalCurrentScore, time: timeStr, timestamp: Date.now() });
                showToast('Zapsáno do Firebase! Ostatní uvidí tvůj celkový i nynější zisk.');
            } catch(err) { showToast("Chyba při zápisu, ukládám lokálně."); saveLocally(nick, finalTotalScore, timeStr, finalCurrentScore); }
        } else { saveLocally(nick, finalTotalScore, timeStr, finalCurrentScore); }
        
        game.checksum = generateChecksum(game.score, game.totalScore);
        localStorage.setItem('meme_clicker_fb', JSON.stringify(game));
        btn.disabled = false; btn.textContent = "🚀 SUBMIT DO LEADERBOARDU 🚀";
        document.getElementById('btn-refresh-lb')?.click();
        return;
    }

    if (e.target.closest('#btn-refresh-lb')) {
        const loadingLb = document.getElementById('loading-lb');
        if (loadingLb) loadingLb.textContent = "⏳ Načítám...";
        sessionStorage.removeItem('cached_lb'); 
        fetchLeaderboard().then(() => {
            if (loadingLb) loadingLb.textContent = db ? "(Připojeno)" : "(Lokální mód)";
        });
        return;
    }

    if (e.target.closest('#btn-hard-reset')) {
        if(confirm('Chceš fakt smazat i skóre a lokální data? Není cesty zpět!')) {
            clearInterval(gameLoop);
            game = JSON.parse(JSON.stringify(defaultState));
            localStorage.removeItem('meme_clicker_fb'); localStorage.removeItem('meme_lb_local'); 
            window.location.reload();
        }
        return;
    }
});

document.addEventListener('change', (e) => {
    if (e.target.id === 'custom-image-upload') {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(readerEvent) {
                game.cosmetics.customImage = readerEvent.target.result;
                applyCosmetics();
                game.checksum = generateChecksum(game.score, game.totalScore);
                localStorage.setItem('meme_clicker_fb', JSON.stringify(game));
            }
            reader.readAsDataURL(file);
        }
    }
});

async function loadHTML() {
    try {
        const [upgradesHTML, clickerHTML, impHTML, shopHTML, cryptoHTML] = await Promise.all([
            fetch('views/upgrades.html').then(res => res.text()),
            fetch('views/clicker.html').then(res => res.text()),
            fetch('views/improvements.html').then(res => res.text()),
            fetch('views/shop.html').then(res => res.text()),
            fetch('views/crypto.html').then(res => res.text())
        ]);

        document.getElementById('wrapper-upgrades').innerHTML = upgradesHTML;
        document.getElementById('wrapper-clicker').innerHTML = clickerHTML;
        document.getElementById('wrapper-improvements').innerHTML = impHTML;
        document.getElementById('wrapper-shop').innerHTML = shopHTML;
        document.getElementById('wrapper-crypto').innerHTML = cryptoHTML;
        
        currentViewsLoaded = true;

        const loadingLb = document.getElementById('loading-lb');
        if (loadingLb) {
            loadingLb.textContent = db ? "(Připojeno)" : "(Lokální mód)";
            loadingLb.style.color = db ? "#2ecc71" : "#e74c3c";
        }

        fetchLeaderboard();
        renderAchievements();
        applyCosmetics();
        updateUI();

        gameLoop = setInterval(() => {
            const now = Date.now();
            const timerEl = document.getElementById('timer');
            if (game.startTime && timerEl) timerEl.textContent = formatTime(now - game.startTime);
            
            let dt = (now - game.lastTime) / 1000;
            if (dt < 0) dt = 0; 
            if (dt > 86400) dt = 86400; 
            
            game.lastTime = now;
            
            const gain = getBPS() * dt;
            if (gain > 0 && !isNaN(gain)) { 
                game.score += gain; 
                game.totalScore += gain;
                expectedScore += gain; 
                expectedTotalScore += gain; 
            }

            cryptoTimer += 100;
            if (cryptoTimer >= 5000) {
                cryptoTimer = 0;
                if (game.ascend.upgrades.cryptoUnlocked) {
                    // --- KRYPTO BURZA CRASH MECHANIKA ---
                    if (Math.random() < 0.001) { // 0.1% šance na crash
                        game.crypto.coins = 0;
                        game.crypto.price = 10;
                        showToast("📉 KRYPTO BURZA ZKRACHOVALA! Všechny tvé MemeCoiny jsou pryč!");
                        playSound('crash');
                    } else {
                        let change = (Math.random() * 0.35) - 0.15;
                        game.crypto.price = Math.max(10, Math.floor(game.crypto.price * (1 + change)));
                    }
                    // -------------------------------------
                }
            }

            goldenTimer += 100;
            if (goldenTimer >= nextGolden) {
                goldenTimer = 0;
                nextGolden = Math.random() * 60000 + 60000; 
                spawnGoldenMeme();
            }

            const fd = document.getElementById('frenzy-display');
            if (game.frenzy && game.frenzy.active) {
                if (now > game.frenzy.endTime) {
                    game.frenzy.active = false;
                    game.frenzy.multiplier = 1;
                    document.body.classList.remove('frenzy-active');
                    if(fd) fd.style.display = 'none';
                    showToast("Frenzy skončilo!");
                } else {
                    document.body.classList.add('frenzy-active');
                    if(fd) {
                        fd.style.display = 'block';
                        document.getElementById('frenzy-name').textContent = game.frenzy.type === 'click' ? '🌟 CLICK FRENZY 🌟' : '🌟 BUILDING FRENZY 🌟';
                        let timeLeft = game.frenzy.endTime - now;
                        document.getElementById('frenzy-time').textContent = (timeLeft / 1000).toFixed(1) + 's';
                        document.getElementById('frenzy-bar').style.width = (timeLeft / game.frenzy.duration * 100) + '%';
                    }
                }
            } else {
                document.body.classList.remove('frenzy-active');
                if(fd) fd.style.display = 'none';
            }

            if (game.score > expectedScore + 5) {
                game.score = expectedScore;
                showToast("⚠️ Kde jsi vzal ty body? Console hack detekován!");
                playSound('error');
            } else { expectedScore = game.score; }

            if (game.totalScore > expectedTotalScore + 5) { game.totalScore = expectedTotalScore; } else { expectedTotalScore = game.totalScore; }
            
            updateUI();
            
            game.checksum = generateChecksum(game.score, game.totalScore);
            localStorage.setItem('meme_clicker_fb', JSON.stringify(game));
        }, 100);

    } catch (error) {}
}

document.addEventListener('DOMContentLoaded', loadHTML);
