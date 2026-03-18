import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";

const firebaseConfig = {
    apiKey: "AIzaSyBnFQf-YQODWhZN-3scSbWIQIgr3poDIos",
    authDomain: "tetris-5e14c.firebaseapp.com",
    projectId: "tetris-5e14c",
    storageBucket: "tetris-5e14c.firebasestorage.app",
    messagingSenderId: "923778243713",
    appId: "1:923778243713:web:a29d5f3131a6552b244180",
    measurementId: "G-0HHY32B26L"
};

let app, auth, db, analytics;
try {
    app = initializeApp(firebaseConfig);
    analytics = getAnalytics(app);
    auth = getAuth(app);
    db = getFirestore(app);
} catch(e) {
    console.warn("Firebase config error:", e);
}

let MAX_OFFLINE_MS = 6 * 60 * 60 * 1000; 
const BIT_GROWTH_MS = 16 * 60 * 60 * 1000; 

let currentUser = null;
let isFirstAuthCheck = true;
let clickHistory = [];
let lastVisualClickerCount = -1;
let lastTickTime = Date.now();

let goldenTimer = 60000 + Math.random() * 120000; 
let buffClickTimer = 0;
let buffAutoTimer = 0;
let minigameCharge = 0;

let appSettings = {
    sound: true,
    censor: true
};

function formatNumber(num) { 
    num = Number(num) || 0;
    if (isNaN(num)) return "0";
    if (num < 1000) return Math.floor(num).toString();
    
    const suffixes = ["", "k", "m", "b", "t", "qa", "qi", "sx", "sp", "oc", "no", "dc"];
    const suffixNum = Math.floor(Math.log10(num) / 3);
    
    if (suffixNum >= suffixes.length) return "∞";

    let shortValue = (num / Math.pow(1000, suffixNum));
    let formatted = shortValue.toFixed(2);
    
    formatted = formatted.replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1');
    return formatted + suffixes[suffixNum];
}

function loadSettings() {
    let saved = localStorage.getItem('proClickerSettings');
    if (saved) {
        appSettings = { ...appSettings, ...JSON.parse(saved) };
    }
    document.getElementById('setting-sound').checked = appSettings.sound;
    document.getElementById('setting-censor').checked = appSettings.censor;
}

function saveSettings() {
    localStorage.setItem('proClickerSettings', JSON.stringify(appSettings));
    renderLeaderboard(); 
}

const profanityList = [
    'kurv', 'pic', 'pič', 'prdel', 'kokot', 'curak', 'čurák', 'zmrd', 'mrd', 'debil', 'kret', 'kreť', 'buzerant', 'buzik', 'hovn', 'jeb', 'šulin', 'sulin',
    'cigan', 'cigán', 'negr',
    'fuck', 'shit', 'bitch', 'cunt', 'nigg', 'dick', 'cock', 'pussy', 'whore', 'slut', 'faggot', 'retard', 'asshole', 'bastard', 'twat', 'wank'
];

function censorName(name) {
    if (!appSettings.censor || !name) return name;
    let censored = name;
    profanityList.forEach(word => {
        let regex = new RegExp(word + '[a-záčďéěíňóřšťúůýž]*', 'gi');
        censored = censored.replace(regex, (match) => {
            if (match.length <= 2) return '*'.repeat(match.length);
            return match[0] + '*'.repeat(match.length - 2) + match[match.length - 1];
        });
    });
    return censored;
}

function getNextFixedUpdateTime() {
    let d = new Date();
    let h = d.getHours();
    let nextH = h - (h % 6) + 6; 
    let target = new Date(d);
    target.setHours(nextH, 0, 0, 0); 
    return target.getTime();
}

let nextFetchTime = getNextFixedUpdateTime();

const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function playSound(type) {
    if (!appSettings.sound) return;
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.05);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
    } else if (type === 'buy') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.setValueAtTime(600, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'achieve') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.setValueAtTime(554, audioCtx.currentTime + 0.1);
        osc.frequency.setValueAtTime(659, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    }
}

const allCosmetics = [
    { id: 'btn_default', name: 'Klasik', desc: 'Kulaté tlačítko', cost: 0, type: 'button', class: '' },
    { id: 'btn_square', name: 'Kostka', desc: 'Zaoblený čtverec', cost: 15000, type: 'button', class: 'btn-square' },
    { id: 'btn_neon', name: 'Neon', desc: 'Zářivý efekt', cost: 250000, type: 'button', class: 'btn-neon' },
    { id: 'btn_pulse', name: 'Srdce', desc: 'Pulzující animace', cost: 500000, type: 'button', class: 'btn-pulse' },
    { id: 'btn_ghost', name: 'Duch', desc: 'Průhledný obrys', cost: 750000, type: 'button', class: 'btn-ghost' },
    { id: 'btn_custom', name: 'Vlastní Foto', desc: 'Nahraj si obrázek', cost: 1000000, type: 'button', class: 'btn-custom' },
    { id: 'btn_diamond', name: 'Diamant', desc: 'Rotovaný tvar', cost: 2000000, type: 'button', class: 'btn-diamond' },
    { id: 'btn_8bit', name: 'Retro', desc: '8-bitový pixel styl', cost: 5000000, type: 'button', class: 'btn-8bit' },
    { id: 'btn_rgb', name: 'RGB Disco', desc: 'Duhové tlačítko', cost: 15000000, type: 'button', class: 'btn-rgb' },
    
    { id: 'theme_default', name: 'Dark Theme', desc: 'Klasická černá', cost: 0, type: 'theme', themeData: '' },
    { id: 'theme_light', name: 'Light Theme', desc: 'Vypálí ti oči', cost: 50000, type: 'theme', themeData: 'light' },
    { id: 'theme_ocean', name: 'Hluboký Oceán', desc: 'Tmavě modrá', cost: 100000, type: 'theme', themeData: 'ocean' },
    { id: 'theme_blood', name: 'Krvavý Měsíc', desc: 'Temná červená', cost: 250000, type: 'theme', themeData: 'blood' },
    { id: 'theme_hacker', name: 'Matrix', desc: 'Zelené terminály', cost: 500000, type: 'theme', themeData: 'hacker' },
    { id: 'theme_synthwave', name: 'Synthwave', desc: 'Retro neon', cost: 2000000, type: 'theme', themeData: 'synthwave' },
    { id: 'theme_gold', name: 'VIP Gold', desc: 'Zlatý luxus', cost: 10000000, type: 'theme', themeData: 'gold' },
    { id: 'theme_rgb', name: 'RGB Pozadí', desc: 'Party režim', cost: 50000000, type: 'theme', themeData: 'rgb' }
];

const prestigeUpgradesList = [
    { id: 'pu_start', name: 'Základní Osvícení', cost: 1, req: null, desc: 'Odemkne cestu bohů.' },
    { id: 'pu_c1', name: 'Zlaté Ruce I', cost: 3, req: 'pu_start', desc: 'Síla kliku x2' },
    { id: 'pu_c2', name: 'Zlaté Ruce II', cost: 10, req: 'pu_c1', desc: 'Síla kliku x2' },
    { id: 'pu_c3', name: 'Zlaté Ruce III', cost: 50, req: 'pu_c2', desc: 'Síla kliku x2' },
    { id: 'pu_c4', name: 'Zlaté Ruce IV', cost: 250, req: 'pu_c3', desc: 'Síla kliku x2' },
    { id: 'pu_c5', name: 'Zlaté Ruce V', cost: 1000, req: 'pu_c4', desc: 'Síla kliku x2' },
    { id: 'pu_c6', name: 'Titanové Ruce I', cost: 5000, req: 'pu_c5', desc: 'Síla kliku x3' },
    { id: 'pu_c7', name: 'Titanové Ruce II', cost: 25000, req: 'pu_c6', desc: 'Síla kliku x3' },
    { id: 'pu_c8', name: 'Titanové Ruce III', cost: 100000, req: 'pu_c7', desc: 'Síla kliku x3' },
    { id: 'pu_c9', name: 'Božský Dotek I', cost: 500000, req: 'pu_c8', desc: 'Síla kliku x5' },
    { id: 'pu_c10', name: 'Božský Dotek II', cost: 2500000, req: 'pu_c9', desc: 'Síla kliku x10' },
    { id: 'pu_a1', name: 'Věčný Stroj I', cost: 3, req: 'pu_start', desc: 'Auto produkce x1.5' },
    { id: 'pu_a2', name: 'Věčný Stroj II', cost: 10, req: 'pu_a1', desc: 'Auto produkce x1.5' },
    { id: 'pu_a3', name: 'Věčný Stroj III', cost: 50, req: 'pu_a2', desc: 'Auto produkce x1.5' },
    { id: 'pu_a4', name: 'Věčný Stroj IV', cost: 250, req: 'pu_a3', desc: 'Auto produkce x2' },
    { id: 'pu_a5', name: 'Věčný Stroj V', cost: 1000, req: 'pu_a4', desc: 'Auto produkce x2' },
    { id: 'pu_a6', name: 'Kvantový Motor I', cost: 5000, req: 'pu_a5', desc: 'Auto produkce x2' },
    { id: 'pu_a7', name: 'Kvantový Motor II', cost: 25000, req: 'pu_a6', desc: 'Auto produkce x3' },
    { id: 'pu_a8', name: 'Kvantový Motor III', cost: 100000, req: 'pu_a7', desc: 'Auto produkce x3' },
    { id: 'pu_a9', name: 'Motor Všehomíra I', cost: 500000, req: 'pu_a8', desc: 'Auto produkce x5' },
    { id: 'pu_a10', name: 'Motor Všehomíra II', cost: 2500000, req: 'pu_a9', desc: 'Auto produkce x10' },
    { id: 'pu_d1', name: 'Obchodní Známka I', cost: 5, req: 'pu_start', desc: 'Sleva na budovy 5%' },
    { id: 'pu_d2', name: 'Obchodní Známka II', cost: 25, req: 'pu_d1', desc: 'Sleva na budovy 5%' },
    { id: 'pu_d3', name: 'Obchodní Známka III', cost: 100, req: 'pu_d2', desc: 'Sleva na budovy 5%' },
    { id: 'pu_d4', name: 'Obchodní Známka IV', cost: 500, req: 'pu_d3', desc: 'Sleva na budovy 5%' },
    { id: 'pu_d5', name: 'Obchodní Známka V', cost: 2500, req: 'pu_d4', desc: 'Sleva na budovy 5%' },
    { id: 'pu_d6', name: 'Monopol I', cost: 10000, req: 'pu_d5', desc: 'Sleva na budovy 5%' },
    { id: 'pu_d7', name: 'Monopol II', cost: 50000, req: 'pu_d6', desc: 'Sleva na budovy 5%' },
    { id: 'pu_d8', name: 'Monopol III', cost: 200000, req: 'pu_d7', desc: 'Sleva na budovy 5%' },
    { id: 'pu_d9', name: 'Absolutní Vláda I', cost: 1000000, req: 'pu_d8', desc: 'Sleva na budovy 5%' },
    { id: 'pu_d10', name: 'Absolutní Vláda II', cost: 5000000, req: 'pu_d9', desc: 'Sleva na budovy 5%' },
    { id: 'pu_m1', name: 'Delší Spánek I', cost: 5, req: 'pu_start', desc: 'Offline těžba 12h' },
    { id: 'pu_m2', name: 'Delší Spánek II', cost: 50, req: 'pu_m1', desc: 'Offline těžba 24h' },
    { id: 'pu_m3', name: 'Delší Spánek III', cost: 500, req: 'pu_m2', desc: 'Offline těžba 48h' },
    { id: 'pu_m4', name: 'Delší Spánek IV', cost: 5000, req: 'pu_m3', desc: 'Offline těžba 7 dní' },
    { id: 'pu_m5', name: 'Aura Štěstí I', cost: 50, req: 'pu_start', desc: 'Zlatý event častěji (+10%)' },
    { id: 'pu_m6', name: 'Aura Štěstí II', cost: 500, req: 'pu_m5', desc: 'Zlatý event častěji (+20%)' },
    { id: 'pu_m7', name: 'Aura Štěstí III', cost: 5000, req: 'pu_m6', desc: 'Zlatý event častěji (+30%)' },
    { id: 'pu_m8', name: 'Bohatší Event I', cost: 25000, req: 'pu_m7', desc: 'Zlatý buff trvá 2x déle' },
    { id: 'pu_m9', name: 'Bohatší Event II', cost: 100000, req: 'pu_m8', desc: 'Zlatý buff trvá 3x déle' },
    { id: 'pu_s1', name: 'Synergie I', cost: 10, req: 'pu_start', desc: '+1% ke všemu za achievement' },
    { id: 'pu_s2', name: 'Synergie II', cost: 100, req: 'pu_s1', desc: '+1% ke všemu za achievement' },
    { id: 'pu_s3', name: 'Synergie III', cost: 1000, req: 'pu_s2', desc: '+1% ke všemu za achievement' },
    { id: 'pu_s4', name: 'Synergie IV', cost: 10000, req: 'pu_s3', desc: '+1% ke všemu za achievement' },
    { id: 'pu_s5', name: 'Synergie V', cost: 100000, req: 'pu_s4', desc: '+1% ke všemu za achievement' },
    { id: 'pu_s6', name: 'Synergie VI', cost: 1000000, req: 'pu_s5', desc: '+1% ke všemu za achievement' },
    { id: 'pu_s7', name: 'Synergie VII', cost: 10000000, req: 'pu_s6', desc: '+2% ke všemu za achievement' },
    { id: 'pu_s8', name: 'Synergie VIII', cost: 100000000, req: 'pu_s7', desc: '+2% ke všemu za achievement' },
    { id: 'pu_s9', name: 'Synergie IX', cost: 1000000000, req: 'pu_s8', desc: '+5% ke všemu za achievement' },
    { id: 'pu_s10', name: 'Nekonečno', cost: 10000000000, req: 'pu_s9', desc: 'Vynásobí produkci 100x' }
];

function getDefaultGameState() {
    return {
        name: "Host",
        currentScore: 0,
        totalScore: 0,
        manualClicks: 0,
        bits: 0,
        bozskeBity: 0,
        spentBozskeBity: 0,
        prestigeUpgrades: [],
        ascensionCount: 0,
        unlockedMinigame: false,
        bitGrowthStartTime: Date.now(),
        startDate: Date.now(),
        lastSaveTime: Date.now(),
        clickPower: 1,
        autoPower: 0,
        achievements: [],
        upgrades: [], 
        unlockedCosmetics: ['btn_default', 'theme_default'],
        equipped: { button: 'btn_default', theme: 'theme_default' },
        customImage: null,
        buildings: [
            { id: 'b1', name: 'Auto-myš', cost: 15, power: 1, count: 0, emoji: '🖱️', bitLevel: 0 },
            { id: 'b2', name: 'Farma', cost: 100, power: 8, count: 0, emoji: '🌾', bitLevel: 0 },
            { id: 'b3', name: 'Továrna', cost: 1100, power: 47, count: 0, emoji: '🏭', bitLevel: 0 },
            { id: 'b4', name: 'Kvantový PC', cost: 12000, power: 260, count: 0, emoji: '💻', bitLevel: 0 },
            { id: 'b5', name: 'Klonovací laboratoř', cost: 130000, power: 1400, count: 0, emoji: '🧬', bitLevel: 0 },
            { id: 'b6', name: 'Mimozemská těžba', cost: 1400000, power: 7800, count: 0, emoji: '🛸', bitLevel: 0 },
            { id: 'b7', name: 'Dysonova sféra', cost: 20000000, power: 44000, count: 0, emoji: '☀️', bitLevel: 0 },
            { id: 'b8', name: 'Mezigalaktická říše', cost: 5000000000, power: 2500000, count: 0, emoji: '🌌', bitLevel: 0 },
            { id: 'b9', name: 'Temná hmota', cost: 750000000000, power: 150000000, count: 0, emoji: '🕳️', bitLevel: 0 },
            { id: 'b10', name: 'Tvůrce vesmírů', cost: 100000000000000, power: 10000000000, count: 0, emoji: '🎇', bitLevel: 0 }
        ],
        clickers: [
            { id: 'c1', name: 'Lehký trénink', cost: 50, power: 1, count: 0 },
            { id: 'c2', name: 'Mech. klávesnice', cost: 500, power: 10, count: 0 },
            { id: 'c3', name: 'Hacker asistent', cost: 5000, power: 100, count: 0 },
            { id: 'c4', name: 'AI Mozek', cost: 50000, power: 1000, count: 0 },
            { id: 'c5', name: 'Kvantová myš', cost: 500000, power: 10000, count: 0 },
            { id: 'c6', name: 'Telepatické klikání', cost: 5000000, power: 100000, count: 0 },
            { id: 'c7', name: 'Kvantový mozek', cost: 1500000000, power: 500000, count: 0 },
            { id: 'c8', name: 'Ovládání času', cost: 250000000000, power: 50000000, count: 0 },
            { id: 'c9', name: 'Tlačítko nekonečna', cost: 50000000000000, power: 5000000000, count: 0 }
        ]
    };
}

let game = getDefaultGameState();

const allUpgrades = [
    { id: 'u_bulk_buy', name: 'Hromadný nákup', desc: 'Podrž CTRL a klikni pro nákup 10 kusů najednou', cost: 100000, target: 'global' },

    { id: 'u_b1', name: 'Zlaté kolečko', desc: 'Auto-myš x2', cost: 500, target: 'b1' },
    { id: 'u_b2', name: 'Super hnojivo', desc: 'Farma x2', cost: 5000, target: 'b2' },
    { id: 'u_b3', name: 'Pásová výroba', desc: 'Továrna x2', cost: 50000, target: 'b3' },
    { id: 'u_b4', name: 'Chlazení dusíkem', desc: 'Kvantový PC x2', cost: 500000, target: 'b4' },
    { id: 'u_b5', name: 'Zrychlené stárnutí', desc: 'Klonovací laboratoř x2', cost: 1300000, target: 'b5' },
    { id: 'u_b6', name: 'Červí díra', desc: 'Mimozemská těžba x2', cost: 14000000, target: 'b6' },
    { id: 'u_b7', name: 'Solární plachty', desc: 'Dysonova sféra x2', cost: 200000000, target: 'b7' },
    { id: 'u_b8', name: 'Mezihvězdná flotila', desc: 'Říše x2', cost: 50000000000, target: 'b8' },
    { id: 'u_b9', name: 'Reaktor Černé díry', desc: 'Temná hmota x2', cost: 7500000000000, target: 'b9' },
    { id: 'u_b10', name: 'Multivesmír', desc: 'Tvůrce vesmírů x2', cost: 1000000000000000, target: 'b10' },
    
    { id: 'u_bit_b1', name: 'Odemknout Bity: Myš', desc: 'Zpřístupní bitové upgrady', cost: 10000, target: 'b1' },
    { id: 'u_bit_b2', name: 'Odemknout Bity: Farma', desc: 'Zpřístupní bitové upgrady', cost: 100000, target: 'b2' },
    { id: 'u_bit_b3', name: 'Odemknout Bity: Továrna', desc: 'Zpřístupní bitové upgrady', cost: 1000000, target: 'b3' },
    { id: 'u_bit_b4', name: 'Odemknout Bity: Kvantový PC', desc: 'Zpřístupní bitové upgrady', cost: 10000000, target: 'b4' },
    { id: 'u_bit_b5', name: 'Odemknout Bity: Laboratoř', desc: 'Zpřístupní bitové upgrady', cost: 100000000, target: 'b5' },
    { id: 'u_bit_b6', name: 'Odemknout Bity: Těžba', desc: 'Zpřístupní bitové upgrady', cost: 1000000000, target: 'b6' },
    { id: 'u_bit_b7', name: 'Odemknout Bity: Sféra', desc: 'Zpřístupní bitové upgrady', cost: 10000000000, target: 'b7' },
    { id: 'u_bit_b8', name: 'Odemknout Bity: Říše', desc: 'Zpřístupní bitové upgrady', cost: 100000000000, target: 'b8' },
    { id: 'u_bit_b9', name: 'Odemknout Bity: Temná hmota', desc: 'Zpřístupní bitové upgrady', cost: 1000000000000, target: 'b9' },
    { id: 'u_bit_b10', name: 'Odemknout Bity: Tvůrce', desc: 'Zpřístupní bitové upgrady', cost: 10000000000000, target: 'b10' },

    { id: 'u_c1', name: 'Energeťák', desc: 'Lehký trénink x2', cost: 1000, target: 'c1' },
    { id: 'u_c2', name: 'RGB Podsvícení', desc: 'Mech. klávesnice x2', cost: 10000, target: 'c2' },
    { id: 'u_c3', name: 'Kofeinové IV', desc: 'Hacker asistent x2', cost: 100000, target: 'c3' },
    { id: 'u_c4', name: 'Skynet update', desc: 'AI Mozek x2', cost: 1000000, target: 'c4' },
    { id: 'u_c5', name: 'Kvantové provázání', desc: 'Kvantová myš x2', cost: 5000000, target: 'c5' },
    { id: 'u_c6', name: 'Třetí oko', desc: 'Telepatické klikání x2', cost: 50000000, target: 'c6' },
    { id: 'u_c7', name: 'Kolektivní vědomí', desc: 'Kvantový mozek x2', cost: 15000000000, target: 'c7' },
    { id: 'u_c8', name: 'Zpomalení reality', desc: 'Ovládání času x2', cost: 2500000000000, target: 'c8' },
    { id: 'u_c9', name: 'Síla Stvořitele', desc: 'Tlačítko nekonečna x2', cost: 500000000000000, target: 'c9' },
    
    { id: 'u_ach', name: 'Sběratelská pýcha', desc: '+2% produkce za achievement', cost: 250000, target: 'synergy' }
];

let allAchievements = [
    { id: 's1', name: 'Začátečník', desc: 'Získej 100 celkového skóre', req: 100, type: 'total' },
    { id: 's2', name: 'Klikař', desc: 'Získej 1k celkového skóre', req: 1000, type: 'total' },
    { id: 's3', name: 'Závislák', desc: 'Získej 10k celkového skóre', req: 10000, type: 'total' },
    { id: 's4', name: 'Kapitalista', desc: 'Získej 100k celkového skóre', req: 100000, type: 'total' },
    { id: 's5', name: 'Milionář', desc: 'Získej 1m celkového skóre', req: 1000000, type: 'total' },
    { id: 's6', name: 'Miliardář', desc: 'Získej 1b celkového skóre', req: 1000000000, type: 'total' },
    { id: 's7', name: 'Trilionář', desc: 'Získej 1t celkového skóre', req: 1000000000000, type: 'total' },
    
    { id: 'k1', name: 'První dotek', desc: 'Klikni 1x', req: 1, type: 'clicks' },
    { id: 'k2', name: 'Zahřáté prsty', desc: 'Klikni 100x', req: 100, type: 'clicks' },
    { id: 'k3', name: 'Syndrom karpálu', desc: 'Klikni 1k x', req: 1000, type: 'clicks' },
    { id: 'k4', name: 'Stroj na klikání', desc: 'Klikni 10k x', req: 10000, type: 'clicks' },
    { id: 'k5', name: 'Bůh klikání', desc: 'Klikni 100k x', req: 100000, type: 'clicks' }
];

const milestones = [10, 25, 50, 100];

game.buildings.forEach(b => {
    milestones.forEach(m => {
        allAchievements.push({ id: `item_${b.id}_${m}`, name: `${b.name} ${m}x`, desc: `Kup ${m}x budovu ${b.name}`, req: m, type: 'item', itemId: b.id });
    });
});

game.clickers.forEach(c => {
    milestones.forEach(m => {
        allAchievements.push({ id: `item_${c.id}_${m}`, name: `${c.name} ${m}x`, desc: `Kup ${m}x vylepšení ${c.name}`, req: m, type: 'item', itemId: c.id });
    });
});

allCosmetics.forEach(c => {
    if (c.cost > 0) {
        allAchievements.push({
            id: `ach_cosmetic_${c.id}`,
            name: `Móda: ${c.name}`,
            desc: `Odemkni kosmetiku ${c.name}`,
            req: c.id,
            type: 'cosmetic'
        });
    }
});

let mockLeaderboard = [];

function init() {
    loadSettings();
    loadLocalGuestGame();
    
    setupEvents();
    
    if(!localStorage.getItem('hideChangelog_v05')) {
        document.getElementById('changelog-modal').style.display = 'flex';
    }

    document.getElementById('ach-total').innerText = allAchievements.length;
    
    recalculatePowers();
    applyCosmetics();
    renderStore();
    renderAchievements();
    renderVisualBuildings();
    updatePrestigeModal();
    fetchGlobalLeaderboard(); 
    updateUI();
    
    requestAnimationFrame(renderLoop);
    setInterval(gameLoop, 1000);
    setInterval(updateTimerDisplay, 1000);
    setInterval(renderLeaderboard, 3000); 
}

function renderLoop() {
    try {
        let now = Date.now();
        let dt = now - lastTickTime;
        lastTickTime = now;

        goldenTimer -= dt;
        if (goldenTimer <= 0) {
            spawnGoldenEvent();
            let baseT = game.prestigeUpgrades && game.prestigeUpgrades.includes('pu_m5') ? 30000 : 60000;
            let randT = game.prestigeUpgrades && game.prestigeUpgrades.includes('pu_m5') ? 60000 : 120000;
            if(game.prestigeUpgrades && game.prestigeUpgrades.includes('pu_m6')) { baseT *= 0.8; randT *= 0.8; }
            if(game.prestigeUpgrades && game.prestigeUpgrades.includes('pu_m7')) { baseT *= 0.8; randT *= 0.8; }
            goldenTimer = baseT + Math.random() * randT; 
        }

        if (buffClickTimer > 0) buffClickTimer -= dt;
        if (buffAutoTimer > 0) buffAutoTimer -= dt;

        if (minigameCharge > 0) {
            minigameCharge -= (dt / 1000) * 2; 
            if (minigameCharge < 0) minigameCharge = 0;
        }

        updateActiveBuffsUI();

        if (game.unlockedMinigame) {
            let pBar = document.getElementById('minigame-progress');
            let pText = document.getElementById('minigame-bonus');
            if(pBar && pText) {
                pBar.style.width = minigameCharge + '%';
                pText.innerText = (minigameCharge * 0.20).toFixed(1);
            }
        }

        if (game.autoPower > 0 && dt < 2000) { 
            let minigameMult = game.unlockedMinigame ? ((minigameCharge / 100) * 0.20) : 0;
            let activeAutoMult = (buffAutoTimer > 0 ? 2 : 1) + minigameMult;
            let currentAuto = game.autoPower * activeAutoMult;
            
            let earned = currentAuto * (dt / 1000);
            game.currentScore += earned;
            game.totalScore += earned;
            
            document.getElementById('auto-power').innerText = formatNumber(currentAuto);
        } else {
            document.getElementById('auto-power').innerText = formatNumber(game.autoPower);
        }
        
        document.getElementById('current-score').innerText = formatNumber(game.currentScore);
        document.getElementById('total-score').innerText = formatNumber(game.totalScore);
        
    } catch(err) {
        console.error("RenderLoop error:", err);
    }
    requestAnimationFrame(renderLoop);
}

function spawnGoldenEvent() {
    let gc = document.getElementById('golden-cookie');
    if (!gc) return;
    
    let x = 10 + Math.random() * 80;
    let y = 10 + Math.random() * 80;
    
    gc.style.left = x + 'vw';
    gc.style.top = y + 'vh';
    gc.classList.remove('hidden');
    gc.classList.add('active');
    
    setTimeout(() => {
        gc.classList.remove('active');
        gc.classList.add('hidden');
    }, 12000);
}

function clickGoldenEvent() {
    let gc = document.getElementById('golden-cookie');
    gc.classList.remove('active');
    gc.classList.add('hidden');
    playSound('achieve');
    
    let durationBase = 30000;
    if(game.prestigeUpgrades && game.prestigeUpgrades.includes('pu_m8')) durationBase *= 2;
    if(game.prestigeUpgrades && game.prestigeUpgrades.includes('pu_m9')) durationBase *= 3;

    if (Math.random() > 0.5) {
        buffClickTimer = durationBase; 
        showFloatingText(parseInt(gc.style.left), parseInt(gc.style.top), "KLIK x7!");
    } else {
        buffAutoTimer = durationBase * 2; 
        showFloatingText(parseInt(gc.style.left), parseInt(gc.style.top), "AUTO x2!");
    }
}

function updateActiveBuffsUI() {
    let html = '';
    if (buffClickTimer > 0) {
        html += `<div class="buff-badge">🖱️ x7 (${Math.ceil(buffClickTimer/1000)}s)</div>`;
    }
    if (buffAutoTimer > 0) {
        html += `<div class="buff-badge">⚙️ x2 (${Math.ceil(buffAutoTimer/1000)}s)</div>`;
    }
    document.getElementById('buffs-container').innerHTML = html;
}

function getPrestigeClickMult() {
    if (!game.prestigeUpgrades) return 1;
    let m = 1;
    if(game.prestigeUpgrades.includes('pu_c1')) m*=2;
    if(game.prestigeUpgrades.includes('pu_c2')) m*=2;
    if(game.prestigeUpgrades.includes('pu_c3')) m*=2;
    if(game.prestigeUpgrades.includes('pu_c4')) m*=2;
    if(game.prestigeUpgrades.includes('pu_c5')) m*=2;
    if(game.prestigeUpgrades.includes('pu_c6')) m*=3;
    if(game.prestigeUpgrades.includes('pu_c7')) m*=3;
    if(game.prestigeUpgrades.includes('pu_c8')) m*=3;
    if(game.prestigeUpgrades.includes('pu_c9')) m*=5;
    if(game.prestigeUpgrades.includes('pu_c10')) m*=10;
    if(game.prestigeUpgrades.includes('pu_s10')) m*=100;
    return m;
}

function getPrestigeAutoMult() {
    if (!game.prestigeUpgrades) return 1;
    let m = 1;
    if(game.prestigeUpgrades.includes('pu_a1')) m*=1.5;
    if(game.prestigeUpgrades.includes('pu_a2')) m*=1.5;
    if(game.prestigeUpgrades.includes('pu_a3')) m*=1.5;
    if(game.prestigeUpgrades.includes('pu_a4')) m*=2;
    if(game.prestigeUpgrades.includes('pu_a5')) m*=2;
    if(game.prestigeUpgrades.includes('pu_a6')) m*=2;
    if(game.prestigeUpgrades.includes('pu_a7')) m*=3;
    if(game.prestigeUpgrades.includes('pu_a8')) m*=3;
    if(game.prestigeUpgrades.includes('pu_a9')) m*=5;
    if(game.prestigeUpgrades.includes('pu_a10')) m*=10;
    if(game.prestigeUpgrades.includes('pu_s10')) m*=100;
    return m;
}

function getPrestigeDiscount() {
    if (!game.prestigeUpgrades) return 1.0;
    let d = 1.0;
    if(game.prestigeUpgrades.includes('pu_d1')) d -= 0.05;
    if(game.prestigeUpgrades.includes('pu_d2')) d -= 0.05;
    if(game.prestigeUpgrades.includes('pu_d3')) d -= 0.05;
    if(game.prestigeUpgrades.includes('pu_d4')) d -= 0.05;
    if(game.prestigeUpgrades.includes('pu_d5')) d -= 0.05;
    if(game.prestigeUpgrades.includes('pu_d6')) d -= 0.05;
    if(game.prestigeUpgrades.includes('pu_d7')) d -= 0.05;
    if(game.prestigeUpgrades.includes('pu_d8')) d -= 0.05;
    if(game.prestigeUpgrades.includes('pu_d9')) d -= 0.05;
    if(game.prestigeUpgrades.includes('pu_d10')) d -= 0.05;
    return Math.max(0.1, d); 
}

function getPrestigeSynergy() {
    if (!game.prestigeUpgrades) return 0;
    let s = 0;
    if(game.prestigeUpgrades.includes('pu_s1')) s += 0.01;
    if(game.prestigeUpgrades.includes('pu_s2')) s += 0.01;
    if(game.prestigeUpgrades.includes('pu_s3')) s += 0.01;
    if(game.prestigeUpgrades.includes('pu_s4')) s += 0.01;
    if(game.prestigeUpgrades.includes('pu_s5')) s += 0.01;
    if(game.prestigeUpgrades.includes('pu_s6')) s += 0.01;
    if(game.prestigeUpgrades.includes('pu_s7')) s += 0.02;
    if(game.prestigeUpgrades.includes('pu_s8')) s += 0.02;
    if(game.prestigeUpgrades.includes('pu_s9')) s += 0.05;
    return s;
}

function updateMaxOffline() {
    MAX_OFFLINE_MS = 6 * 60 * 60 * 1000;
    if (!game.prestigeUpgrades) return;
    if(game.prestigeUpgrades.includes('pu_m1')) MAX_OFFLINE_MS = 12 * 60 * 60 * 1000;
    if(game.prestigeUpgrades.includes('pu_m2')) MAX_OFFLINE_MS = 24 * 60 * 60 * 1000;
    if(game.prestigeUpgrades.includes('pu_m3')) MAX_OFFLINE_MS = 48 * 60 * 60 * 1000;
    if(game.prestigeUpgrades.includes('pu_m4')) MAX_OFFLINE_MS = 7 * 24 * 60 * 60 * 1000;
}

function calculatePendingDivineBits() {
    let rawCalculation = Math.floor(Math.cbrt((game.totalScore || 0) / 1000000000000));
    let totalPossessed = (game.bozskeBity || 0) + (game.spentBozskeBity || 0);
    return Math.max(0, rawCalculation - totalPossessed);
}

function calculateNextDivineBitReq() {
    let totalPossessed = (game.bozskeBity || 0) + (game.spentBozskeBity || 0);
    let pending = calculatePendingDivineBits();
    let currentLevel = totalPossessed + pending;
    let nextLevel = currentLevel + 1;
    let requiredScore = Math.pow(nextLevel, 3) * 1000000000000;
    return Math.max(0, requiredScore - (game.totalScore || 0));
}

function doPrestige() {
    let pending = calculatePendingDivineBits();
    if (pending <= 0) {
        alert("Zatím nemáš dostatek celkového skóre (potřebuješ alespoň 1 bilion pro první Bit).");
        return;
    }
    
    if(confirm(`Opravdu chceš postoupit? Tvé budovy a nynější skóre se resetují, ale získáš ${pending} Božských bitů.`)) {
        game.bozskeBity = (game.bozskeBity || 0) + pending;
        game.ascensionCount = (game.ascensionCount || 0) + 1;
        
        game.currentScore = 0;
        game.clickPower = 1;
        game.autoPower = 0;
        game.manualClicks = 0;
        game.bits = 0;
        game.unlockedMinigame = false;
        if(game.upgrades) {
            game.upgrades = game.upgrades.filter(u => u.startsWith('u_ach')); 
        }
        
        let def = getDefaultGameState();
        game.buildings = def.buildings;
        game.clickers = def.clickers;
        game.startDate = Date.now();
        game.bitGrowthStartTime = Date.now();

        playSound('achieve');
        document.getElementById('prestige-modal').style.display = 'none';
        recalculatePowers();
        renderStore();
        renderVisualBuildings();
        updateUI();
        saveGame(true);
    }
}

function updatePrestigeModal() {
    document.getElementById('pending-divine-bits').innerText = formatNumber(calculatePendingDivineBits());
    document.getElementById('next-bit-req').innerText = formatNumber(calculateNextDivineBitReq());
    
    if(!game.prestigeUpgrades) game.prestigeUpgrades = [];
    
    let treeHTML = '';
    prestigeUpgradesList.forEach(u => {
        let stateClass = 'locked';
        let isUnlocked = game.prestigeUpgrades.includes(u.id);
        let canAfford = (game.bozskeBity || 0) >= u.cost;
        let reqMet = u.req === null || game.prestigeUpgrades.includes(u.req);

        if (isUnlocked) stateClass = 'unlocked';
        else if (canAfford && reqMet) stateClass = 'available';

        treeHTML += `<div class="p-node ${stateClass}" id="node-${u.id}" onclick="processPrestigeUpgrade('${u.id}')">
            <h4>${u.name}</h4>
            <span class="p-cost">${formatNumber(u.cost)} Božských bitů</span>
            <p>${u.desc}</p>
        </div>`;
    });
    document.getElementById('prestige-tree-dyn').innerHTML = treeHTML;
}

window.processPrestigeUpgrade = function(id) {
    if(!game.prestigeUpgrades) game.prestigeUpgrades = [];
    let upg = prestigeUpgradesList.find(x => x.id === id);
    if (!upg) return;

    if (!game.prestigeUpgrades.includes(id) && (game.bozskeBity || 0) >= upg.cost) {
        if (upg.req === null || game.prestigeUpgrades.includes(upg.req)) {
            game.bozskeBity -= upg.cost;
            game.spentBozskeBity = (game.spentBozskeBity || 0) + upg.cost;
            game.prestigeUpgrades.push(id);
            playSound('buy');
            
            updateMaxOffline();
            recalculatePowers();
            renderStore();
            updatePrestigeModal();
            updateUI();
            saveGame();
        }
    }
};

function setupEvents() {
    document.getElementById('click-btn').addEventListener('click', doClick);
    document.getElementById('golden-cookie').addEventListener('click', clickGoldenEvent);

    document.getElementById('btn-changelog').addEventListener('click', () => {
        document.getElementById('changelog-modal').style.display = 'flex';
    });
    document.getElementById('btn-close-changelog').addEventListener('click', () => {
        document.getElementById('changelog-modal').style.display = 'none';
        if (document.getElementById('hide-changelog-cb').checked) {
            localStorage.setItem('hideChangelog_v05', 'true');
        } else {
            localStorage.removeItem('hideChangelog_v05');
        }
    });

    document.getElementById('btn-prestige').addEventListener('click', () => {
        updatePrestigeModal();
        document.getElementById('prestige-modal').style.display = 'flex';
    });
    document.getElementById('btn-close-prestige').addEventListener('click', () => {
        document.getElementById('prestige-modal').style.display = 'none';
    });
    document.getElementById('btn-do-prestige').addEventListener('click', doPrestige);

    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', () => {
            const targetId = header.getAttribute('data-target');
            const content = document.getElementById(targetId);
            const icon = header.querySelector('.toggle-icon');
            content.classList.toggle('collapsed');
            icon.classList.toggle('collapsed');
        });
    });

    document.getElementById('btn-settings').addEventListener('click', () => document.getElementById('settings-modal').style.display = 'flex');
    document.getElementById('btn-close-settings').addEventListener('click', () => document.getElementById('settings-modal').style.display = 'none');
    document.getElementById('setting-sound').addEventListener('change', (e) => { appSettings.sound = e.target.checked; saveSettings(); });
    document.getElementById('setting-censor').addEventListener('change', (e) => { appSettings.censor = e.target.checked; saveSettings(); });
    
    document.getElementById('btn-rescue-data').addEventListener('click', () => {
        let maxBackup = Number(localStorage.getItem('proClicker_BackupMaxScore')) || 0;
        if (maxBackup > (game.totalScore || 0)) {
            if (confirm(`Našel jsem starou zálohu, kde tvé Celkové skóre bylo ${formatNumber(maxBackup)}. Chceš ho obnovit?`)) {
                game.totalScore = maxBackup;
                game.currentScore = Math.max((game.currentScore || 0), maxBackup); 
                updateUI();
                saveGame(true);
                alert("Data byla zachráněna!");
            }
        } else {
            alert("Nenalezena žádná vyšší lokální záloha. Tvá aktuální data jsou v pořádku.");
        }
    });

    document.getElementById('btn-hard-reset').addEventListener('click', async () => {
        if(confirm("OPRAVDU chceš smazat úplně všechna data? Tento krok je nevratný a přijdeš o všechny statistiky i postup!")) {
            if(confirm("Jsi si naprosto jistý? Není cesty zpět!")) {
                localStorage.removeItem('proClickerSaveGuest');
                localStorage.removeItem('proClicker_BackupMaxScore');
                
                let def = getDefaultGameState();
                
                if(currentUser && db) {
                    localStorage.removeItem('proClickerSave_' + currentUser.uid);
                    def.name = currentUser.email.split('@')[0];
                    try {
                        await setDoc(doc(db, "users", currentUser.uid), def);
                    } catch(e) {
                        console.error("Failed to reset DB", e);
                    }
                }
                
                game = def;
                saveGame(true);
                location.reload();
            }
        }
    });

    document.getElementById('btn-dev').addEventListener('click', () => document.getElementById('dev-modal').style.display = 'flex');
    document.getElementById('btn-close-dev').addEventListener('click', () => document.getElementById('dev-modal').style.display = 'none');
    
    document.getElementById('dev-add-score').addEventListener('click', () => {
        game.currentScore += 1000000000000;
        game.totalScore += 1000000000000;
        checkAchievements();
        updateUI();
        saveGame();
        playSound('achieve');
    });

    document.getElementById('dev-add-score-huge').addEventListener('click', () => {
        game.currentScore += 100000000000000; 
        game.totalScore += 100000000000000;
        checkAchievements();
        updateUI();
        saveGame();
        playSound('achieve');
    });
    
    document.getElementById('dev-unlock-ach').addEventListener('click', () => {
        allAchievements.forEach(a => {
            if(!game.achievements.includes(a.id)) {
                game.achievements.push(a.id);
            }
        });
        recalculatePowers();
        renderAchievements();
        saveGame();
        playSound('achieve');
    });
    
    document.getElementById('dev-unlock-cosmetics').addEventListener('click', () => {
        allCosmetics.forEach(c => {
            if(!game.unlockedCosmetics.includes(c.id)) {
                game.unlockedCosmetics.push(c.id);
            }
        });
        checkAchievements();
        renderStore();
        saveGame();
        playSound('achieve');
    });
    
    document.getElementById('dev-add-items').addEventListener('click', () => {
        game.buildings.forEach(b => b.count += 100);
        game.clickers.forEach(c => c.count += 100);
        recalculatePowers();
        checkAchievements();
        renderStore();
        renderVisualBuildings();
        updateUI();
        saveGame();
        playSound('achieve');
    });
    
    document.getElementById('dev-add-bit').addEventListener('click', () => {
        game.bits += 10;
        game.bitGrowthStartTime = Date.now();
        updateUI();
        saveGame();
        playSound('achieve');
    });

    document.getElementById('dev-add-divine').addEventListener('click', () => {
        game.bozskeBity += 10;
        recalculatePowers();
        updateUI();
        saveGame();
        playSound('achieve');
    });

    document.getElementById('custom-image-input').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                game.customImage = event.target.result;
                applyCosmetics();
                saveGame();
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('btn-show-stats').addEventListener('click', () => { showStats(); document.getElementById('stats-modal').style.display = 'flex'; });
    document.getElementById('btn-close-stats').addEventListener('click', () => document.getElementById('stats-modal').style.display = 'none');
    
    document.getElementById('btn-open-auth').addEventListener('click', () => document.getElementById('auth-modal').style.display = 'flex');
    document.getElementById('btn-close-auth').addEventListener('click', () => { document.getElementById('auth-modal').style.display = 'none'; document.getElementById('auth-error').innerText = ''; });
    
    document.getElementById('btn-register').addEventListener('click', handleRegister);
    document.getElementById('btn-login').addEventListener('click', handleLogin);
    document.getElementById('btn-close-offline').addEventListener('click', () => document.getElementById('offline-modal').style.display = 'none');
    
    document.getElementById('buildings-store').addEventListener('click', e => handleStoreClick(e, 'buildings'));
    document.getElementById('clickers-store').addEventListener('click', e => handleStoreClick(e, 'clickers'));
    
    document.getElementById('upgrades-store').addEventListener('click', e => {
        let el = e.target.closest('.item');
        if(el) {
            let id = el.dataset.id;
            processUpgradeBuy(id);
        }
    });

    document.getElementById('cosmetics-store').addEventListener('click', e => {
        let el = e.target.closest('.item');
        if(el) processCosmeticClick(el.dataset.id);
    });
    
    document.getElementById('btn-harvest-bit').addEventListener('click', () => {
        let elapsed = Date.now() - game.bitGrowthStartTime;
        if (elapsed >= BIT_GROWTH_MS) {
            game.bits += 1;
            game.bitGrowthStartTime = Date.now();
            playSound('achieve');
            updateUI();
            saveGame(true);
        }
    });

    window.addEventListener('beforeunload', () => saveGame());
}

window.processMinigamePump = function() {
    if (game.unlockedMinigame) {
        minigameCharge = Math.min(100, minigameCharge + 15);
    }
};

window.processBitUpgrade = function(id) {
    let b = game.buildings.find(x => x.id === id);
    let cost = (b.bitLevel || 0) + 1;
    if (b && game.bits >= cost && game.upgrades.includes('u_bit_' + id)) {
        game.bits -= cost;
        b.bitLevel = (b.bitLevel || 0) + 1;
        playSound('buy');
        recalculatePowers();
        renderVisualBuildings();
        updateUI();
        saveGame();
    }
};

window.processMinigameUnlock = function() {
    if (game.bits >= 3 && !game.unlockedMinigame) {
        game.bits -= 3;
        game.unlockedMinigame = true;
        playSound('buy');
        renderVisualBuildings();
        updateUI();
        saveGame();
    }
}

function applyCosmetics() {
    let t = allCosmetics.find(c => c.id === game.equipped.theme);
    if(t && t.themeData) {
        document.body.setAttribute('data-theme', t.themeData);
    } else {
        document.body.removeAttribute('data-theme');
    }

    let b = allCosmetics.find(c => c.id === game.equipped.button);
    let btn = document.getElementById('click-btn');
    let img = document.getElementById('click-img');
    
    btn.className = '';
    btn.style.backgroundImage = ''; 
    if (img) img.style.display = 'none';

    if(b) {
        if (b.class) btn.classList.add(b.class);
        if (b.id === 'btn_custom' && game.customImage) {
            btn.style.backgroundImage = `url("${game.customImage}")`;
        }
    }
}

function handleStoreClick(e, type) {
    let el = e.target.closest('.item');
    if(el) {
        let index = parseInt(el.dataset.index);
        let amount = (e.ctrlKey && game.upgrades.includes('u_bulk_buy')) ? 10 : 1;
        processItemBuy(type, index, amount);
    }
}

function processItemBuy(type, index, amount) {
    let item = game[type][index];
    let bought = false;
    let discount = getPrestigeDiscount();
    
    for(let i=0; i<amount; i++) {
        let price = Math.floor(item.cost * discount);
        if (game.currentScore >= price) {
            game.currentScore -= price;
            item.count++;
            item.cost = Math.floor(item.cost * 1.15);
            bought = true;
        } else {
            break;
        }
    }

    if (bought) {
        playSound('buy');
        recalculatePowers();
        checkAchievements();
        renderStore();
        if (type === 'buildings') renderVisualBuildings();
        updateUI();
        saveGame();
    }
}

function processUpgradeBuy(id) {
    let upg = allUpgrades.find(u => u.id === id);
    if (game.currentScore >= upg.cost && !game.upgrades.includes(id)) {
        game.currentScore -= upg.cost;
        game.upgrades.push(id);
        playSound('buy');
        recalculatePowers();
        renderStore();
        renderVisualBuildings(); 
        updateUI();
        saveGame();
    }
}

function processCosmeticClick(id) {
    let cos = allCosmetics.find(c => c.id === id);
    if (!cos) return;

    if (game.unlockedCosmetics.includes(id)) {
        game.equipped[cos.type] = id;
        
        if (id === 'btn_custom') {
            document.getElementById('custom-image-input').click();
        }

        applyCosmetics();
        renderStore();
        saveGame();
    } else if (game.currentScore >= cos.cost) {
        game.currentScore -= cos.cost;
        game.unlockedCosmetics.push(id);
        game.equipped[cos.type] = id; 
        
        if (id === 'btn_custom') {
            document.getElementById('custom-image-input').click();
        }

        playSound('buy');
        checkAchievements();
        applyCosmetics();
        renderStore();
        updateUI();
        saveGame();
    }
}

function calculateOfflineProgress() {
    updateMaxOffline();

    let now = Date.now();
    if (game.lastSaveTime && game.autoPower > 0) {
        let diffMs = now - game.lastSaveTime;
        
        if (diffMs < 0) {
            game.lastSaveTime = now;
            saveGame();
            return;
        }

        let offlineMs = Math.min(diffMs, MAX_OFFLINE_MS);
        if (offlineMs > 60000) { 
            let offlineTicks = Math.floor(offlineMs / 1000);
            let earned = offlineTicks * game.autoPower;
            game.currentScore += earned;
            game.totalScore += earned;
            document.getElementById('offline-earnings').innerText = `+${formatNumber(earned)}`;
            document.getElementById('offline-modal').style.display = 'flex';
            playSound('achieve');
            checkAchievements();
        }
    }
    game.lastSaveTime = now;
    saveGame();
}

if(auth) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            document.getElementById('auth-status-bar').innerHTML = `Přihlášen jako <b>${censorName(user.email.split('@')[0])}</b> <button id="btn-logout" class="btn-text-danger">Odhlásit</button>`;
            document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));
            document.getElementById('leaderboard-warning').style.display = 'none';
            document.getElementById('auth-modal').style.display = 'none';
            
            await loadCloudGame();
            calculateOfflineProgress();
            fetchGlobalLeaderboard(); 

        } else {
            if (!isFirstAuthCheck && currentUser !== null) {
                game = getDefaultGameState();
                saveGame(); 
            } else if (isFirstAuthCheck) {
                calculateOfflineProgress(); 
            }
            
            currentUser = null;
            document.getElementById('auth-status-bar').innerHTML = `Nepřihlášen <button id="btn-open-auth-in" class="btn-text">Přihlásit se</button>`;
            document.getElementById('leaderboard-warning').style.display = 'block';
            document.getElementById('btn-open-auth-in').addEventListener('click', () => document.getElementById('auth-modal').style.display = 'flex');
            
            fetchGlobalLeaderboard();
        }

        isFirstAuthCheck = false;
        document.getElementById('player-name').innerText = censorName(game.name);
        recalculatePowers();
        applyCosmetics();
        renderStore();
        renderAchievements();
        renderVisualBuildings();
        renderLeaderboard();
        updateUI();
    });
}

async function handleRegister() {
    let nick = document.getElementById('auth-nick').value.trim();
    let pass = document.getElementById('auth-pass').value;
    if (nick.length < 3 || pass.length < 6) return document.getElementById('auth-error').innerText = "Nick min 3 znaky, heslo min 6 znaků.";
    try {
        let fakeEmail = `${nick.toLowerCase()}@proclicker.local`;
        await createUserWithEmailAndPassword(auth, fakeEmail, pass);
    } catch (e) { 
        document.getElementById('auth-error').innerText = "Chyba: " + e.message; 
    }
}

async function handleLogin() {
    let nick = document.getElementById('auth-nick').value.trim();
    let pass = document.getElementById('auth-pass').value;
    try {
        let fakeEmail = `${nick.toLowerCase()}@proclicker.local`;
        await signInWithEmailAndPassword(auth, fakeEmail, pass);
    } catch (e) { 
        document.getElementById('auth-error').innerText = "Špatné jméno nebo heslo."; 
    }
}

function loadLocalGuestGame() {
    let saved = localStorage.getItem('proClickerSaveGuest');
    if (saved) mergeSave(JSON.parse(saved));
}

async function loadCloudGame() {
    if (!currentUser || !db) {
        renderLeaderboard();
        return;
    }
    
    let tempGame = getDefaultGameState();
    tempGame.name = currentUser.email.split('@')[0];

    let localCache = localStorage.getItem('proClickerSave_' + currentUser.uid);
    let cloudData = null;

    try {
        const docSnap = await getDoc(doc(db, "users", currentUser.uid));
        if (docSnap.exists()) cloudData = docSnap.data();
    } catch (e) { 
        console.error("Cloud fetch error:", e); 
    }

    if (cloudData && localCache) {
        let parsedCache = JSON.parse(localCache);
        verifyAndMerge(cloudData, parsedCache);
    } else if (cloudData) {
        mergeSave(cloudData);
    } else if (localCache) {
        mergeSave(JSON.parse(localCache));
    } else {
        game = tempGame;
        saveGame();
    }
    
    updateUI(); 
}

function verifyAndMerge(cloudData, localData) {
    if (!cloudData) { mergeSave(localData); return; }
    if (!localData) { mergeSave(cloudData); return; }

    let cloudTotal = Number(cloudData.totalScore) || 0;
    let localTotal = Number(localData.totalScore) || 0;

    if (localTotal >= cloudTotal) {
        mergeSave(localData);
    } else {
        mergeSave(cloudData);
    }
}

function mergeSave(parsed) {
    let def = getDefaultGameState();
    game = { ...def, ...parsed };
    
    if (currentUser && currentUser.email) {
        game.name = currentUser.email.split('@')[0];
    } else {
        game.name = "Host";
    }
    
    game.currentScore = Number(game.currentScore) || 0;
    game.totalScore = Number(game.totalScore) || 0;
    game.bozskeBity = Number(game.bozskeBity) || 0;
    game.spentBozskeBity = Number(game.spentBozskeBity) || 0;
    game.ascensionCount = Number(game.ascensionCount) || 0;
    if (!game.prestigeUpgrades) game.prestigeUpgrades = [];

    if (!game.unlockedCosmetics) game.unlockedCosmetics = def.unlockedCosmetics;
    if (!game.equipped) game.equipped = def.equipped;
    if (game.customImage === undefined) game.customImage = def.customImage;
    if (game.bits === undefined) game.bits = 0;
    if (game.bitGrowthStartTime === undefined) game.bitGrowthStartTime = Date.now();
    if (game.unlockedMinigame === undefined) game.unlockedMinigame = false;

    game.buildings = def.buildings.map(b => {
        let p = parsed.buildings?.find(pb => pb.id === b.id);
        return p ? { ...b, count: Number(p.count)||0, cost: Number(p.cost)||b.cost, emoji: b.emoji, bitLevel: Number(p.bitLevel)||0 } : b;
    });
    game.clickers = def.clickers.map(c => {
        let p = parsed.clickers?.find(pc => pc.id === c.id);
        return p ? { ...c, count: Number(p.count)||0, cost: Number(p.cost)||c.cost } : c;
    });
    recalculatePowers();
    applyCosmetics();
    updateUI();
}

let saveTimeout = null;
function saveGame(force = false) {
    game.lastSaveTime = Date.now();
    
    let maxBackup = Number(localStorage.getItem('proClicker_BackupMaxScore')) || 0;
    if (game.totalScore > maxBackup) {
        localStorage.setItem('proClicker_BackupMaxScore', game.totalScore.toString());
    }

    if (currentUser) {
        localStorage.setItem('proClickerSave_' + currentUser.uid, JSON.stringify(game));
        if (db) {
            if (force) {
                setDoc(doc(db, "users", currentUser.uid), game).catch(e => console.error("Cloud save error", e));
            } else {
                if (saveTimeout) clearTimeout(saveTimeout);
                saveTimeout = setTimeout(async () => {
                    try { 
                        await setDoc(doc(db, "users", currentUser.uid), game); 
                    } catch (e) { 
                        console.error("Cloud save error", e); 
                    }
                }, 3000);
            }
        }
    } else {
        localStorage.setItem('proClickerSaveGuest', JSON.stringify(game));
    }
}

function showFloatingText(x, y, text) {
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.innerText = text;
    
    const offsetX = (Math.random() - 0.5) * 40;
    el.style.left = (x + offsetX) + 'px';
    el.style.top = y + 'px';
    
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

function doClick(e) {
    let now = Date.now();
    clickHistory.push(now);

    let activeClickMult = (buffClickTimer > 0 ? 7 : 1);
    let currentClick = game.clickPower * activeClickMult;

    game.currentScore += currentClick;
    game.totalScore += currentClick;
    game.manualClicks++;
    playSound('click');
    checkAchievements();
    
    document.getElementById('current-score').innerText = formatNumber(game.currentScore);
    document.getElementById('total-score').innerText = formatNumber(game.totalScore);
    renderLeaderboard();

    let clientX = e.clientX;
    let clientY = e.clientY;
    
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    }

    if (clientX !== undefined && clientY !== undefined) {
        showFloatingText(clientX, clientY, `+${formatNumber(currentClick)}`);
    }
}

function verifyGameState() {
    let expectedClickPower = 1;
    let expectedAutoPower = 0;
    let achMultiplier = game.upgrades.includes('u_ach') ? (game.achievements.length * 0.02) : 0;
    let globalMult = 1 + achMultiplier + getPrestigeSynergy();

    let divineMult = 1 + ((game.bozskeBity || 0) * 0.01);
    globalMult *= divineMult;
    
    game.clickers.forEach(c => {
        let localMult = game.upgrades.includes(`u_${c.id}`) ? 2 : 1;
        expectedClickPower += (c.power * c.count * localMult * globalMult);
    });

    expectedClickPower *= getPrestigeClickMult();

    game.buildings.forEach(b => {
        let localMult = game.upgrades.includes(`u_${b.id}`) ? 2 : 1;
        let bitBonus = Math.pow(2, (b.bitLevel || 0)); 
        expectedAutoPower += (b.power * b.count * localMult * globalMult * bitBonus);
    });

    expectedAutoPower *= getPrestigeAutoMult();

    if (Math.abs(game.clickPower - expectedClickPower) > Math.max(1, expectedClickPower * 0.0001) || 
        Math.abs(game.autoPower - expectedAutoPower) > Math.max(1, expectedAutoPower * 0.0001)) {
        game.clickPower = expectedClickPower;
        game.autoPower = expectedAutoPower;
    }
    
    if (game.currentScore < 0 || game.totalScore < 0 || isNaN(game.currentScore)) {
        game.currentScore = 0;
        if (isNaN(game.totalScore)) game.totalScore = 0;
    }
}

function recalculatePowers() {
    let achMultiplier = game.upgrades.includes('u_ach') ? (game.achievements.length * 0.02) : 0;
    let globalMult = 1 + achMultiplier + getPrestigeSynergy();
    
    let divineMult = 1 + ((game.bozskeBity || 0) * 0.01);
    globalMult *= divineMult;

    if(game.upgrades.includes('u_ach')) {
        document.getElementById('synergy-display').style.display = 'block';
        document.getElementById('synergy-display').innerText = `Synergie úspěchů: +${(achMultiplier*100).toFixed(0)}%`;
    } else {
        document.getElementById('synergy-display').style.display = 'none';
    }

    game.clickPower = 1;
    game.clickers.forEach(c => {
        let localMult = game.upgrades.includes(`u_${c.id}`) ? 2 : 1;
        game.clickPower += (c.power * c.count * localMult * globalMult);
    });

    game.clickPower *= getPrestigeClickMult();

    game.autoPower = 0;
    game.buildings.forEach(b => {
        let localMult = game.upgrades.includes(`u_${b.id}`) ? 2 : 1;
        let bitBonus = Math.pow(2, (b.bitLevel || 0)); 
        game.autoPower += (b.power * b.count * localMult * globalMult * bitBonus);
    });

    game.autoPower *= getPrestigeAutoMult();
}

function checkAchievements() {
    let newAch = false;
    allAchievements.forEach(a => {
        if (!game.achievements.includes(a.id)) {
            let unlocked = false;
            if (a.type === 'total' && game.totalScore >= a.req) unlocked = true;
            if (a.type === 'clicks' && game.manualClicks >= a.req) unlocked = true;
            if (a.type === 'item') {
                let item = game.buildings.find(b => b.id === a.itemId) || game.clickers.find(c => c.id === a.itemId);
                if (item && item.count >= a.req) unlocked = true;
            }
            if (a.type === 'cosmetic' && game.unlockedCosmetics.includes(a.req)) {
                unlocked = true;
            }
            if (unlocked) { 
                game.achievements.push(a.id); 
                newAch = true; 
            }
        }
    });
    if (newAch) { 
        playSound('achieve');
        recalculatePowers();
        renderAchievements(); 
        saveGame(); 
    }
}

function renderVisualBuildings() {
    const container = document.getElementById('visual-buildings-container');
    if (!container) return;
    
    let html = '';
    game.buildings.forEach(b => {
        if (b.count > 0) {
            let icons = '';
            let displayCount = Math.min(b.count, 28); 
            for(let i=0; i<displayCount; i++) {
                icons += `<span class="v-bldg">${b.emoji || '🏗️'}</span>`;
            }
            
            let headerBtn = '';
            let footerHtml = '';

            if (game.upgrades.includes('u_bit_' + b.id)) {
                let bitLevel = b.bitLevel || 0;
                let cost = bitLevel + 1;
                let nextMult = Math.pow(2, bitLevel + 1);
                let disabled = game.bits < cost ? 'disabled' : '';
                headerBtn = `<button id="bit-btn-${b.id}" class="btn-bit-upg" onclick="processBitUpgrade('${b.id}')" ${disabled}>⬆️ ${cost} Bit (x${nextMult})</button>`;
            } else {
                headerBtn = `<span style="font-size:0.75rem; color:#666;" title="Kup si odemčení v Obchodě (Vylepšení)">🔒 Bity uzamčeny</span>`;
            }

            if (b.id === 'b1') {
                if (!game.unlockedMinigame) {
                    let dis = game.bits < 3 ? 'disabled' : '';
                    footerHtml = `
                    <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
                        <button class="btn-minigame-unlock" onclick="processMinigameUnlock()" ${dis}>🔓 Odemknout Přetížení (3 Bity)</button>
                    </div>`;
                } else {
                    footerHtml = `
                    <div style="margin-top: 15px; padding: 10px; background: rgba(0,255,170,0.1); border: 1px solid var(--bitcolor); border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <strong style="color: var(--bitcolor); text-shadow: 0 0 5px var(--bitcolor);">🔋 Přetížení: +<span id="minigame-bonus">0</span>%</strong>
                            <button onclick="processMinigamePump()" style="background: var(--bitcolor); color: #000; border: none; border-radius: 4px; padding: 5px 15px; cursor: pointer; font-weight: bold; transition: transform 0.1s;">PUMP!</button>
                        </div>
                        <div class="minigame-active-bar">
                            <div id="minigame-progress" class="minigame-active-fill"></div>
                        </div>
                    </div>`;
                }
            }

            html += `
            <div class="v-bldg-row">
                <div class="v-bldg-header">
                    <span>${b.name} (${b.count})</span>
                    ${headerBtn}
                </div>
                <div class="v-bldg-icons">${icons}</div>
                ${footerHtml}
            </div>`;
        }
    });
    container.innerHTML = html;
}

function updateVisualBuildingsBitButtons() {
    game.buildings.forEach(b => {
        if (b.count > 0 && game.upgrades.includes('u_bit_' + b.id)) {
            let btn = document.getElementById(`bit-btn-${b.id}`);
            if (btn) {
                let cost = (b.bitLevel || 0) + 1;
                let nextMult = Math.pow(2, (b.bitLevel || 0) + 1);
                btn.disabled = game.bits < cost;
                btn.innerText = `⬆️ ${cost} Bit (x${nextMult})`;
            }
        }
    });
}

function renderVisualClickers(count) {
    const container = document.getElementById('visual-clickers-container');
    if (!container) return;
    
    container.innerHTML = '';
    let displayCount = Math.min(count, 60); 
    let radius = 145; 

    for (let i = 0; i < displayCount; i++) {
        let angle = (i / displayCount) * (2 * Math.PI);
        let x = Math.cos(angle) * radius;
        let y = Math.sin(angle) * radius;
        let rotation = angle * (180 / Math.PI) - 90; 

        let el = document.createElement('div');
        el.className = 'visual-clicker';
        el.style.left = `calc(50% + ${x}px)`;
        el.style.top = `calc(50% + ${y}px)`;
        el.style.transform = `rotate(${rotation}deg)`;
        
        el.innerHTML = `
            <div class="visual-clicker-inner">
                <svg width="24" height="24" viewBox="0 0 24 24">
                    <polygon points="12,2 18,22 12,17 6,22" fill="var(--text)" stroke="#000" stroke-width="1.5"/>
                </svg>
            </div>
        `;
        container.appendChild(el);
    }
}

function updateVisualClickersIfNeeded() {
    let totalClickers = game.clickers.reduce((acc, c) => acc + c.count, 0);
    if (totalClickers !== lastVisualClickerCount) {
        renderVisualClickers(totalClickers);
        lastVisualClickerCount = totalClickers;
    }
}

setInterval(() => {
    const clickers = document.querySelectorAll('.visual-clicker');
    if (clickers.length === 0) return;
    
    let numToClick = Math.max(1, Math.floor(clickers.length * 0.15 * Math.random()));
    
    for(let i=0; i<numToClick; i++) {
        let randomClicker = clickers[Math.floor(Math.random() * clickers.length)];
        if (randomClicker && !randomClicker.classList.contains('clicking')) {
            randomClicker.classList.add('clicking');
            setTimeout(() => randomClicker.classList.remove('clicking'), 150);
        }
    }
}, 250);

function gameLoop() {
    verifyGameState();
    
    let now = Date.now();
    checkAchievements();
    updateUI();
    
    if (now >= nextFetchTime) {
        saveGame(true);
        setTimeout(() => { fetchGlobalLeaderboard(); }, 1500); 
        nextFetchTime = getNextFixedUpdateTime(); 
    }
    
    game.lastSaveTime = now;
    if (game.autoPower > 0 && Math.random() < 0.1) saveGame(); 
}

async function fetchGlobalLeaderboard() {
    if (!db) {
        renderLeaderboard();
        return;
    }
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        let players = [];
        querySnapshot.forEach((doc) => {
            let data = doc.data();
            if(data.name && data.totalScore !== undefined) {
                players.push({
                    name: data.name,
                    currentScore: data.currentScore || 0,
                    totalScore: data.totalScore || 0,
                    achCount: data.achievements ? data.achievements.length : 0
                });
            }
        });
        mockLeaderboard = players; 
        renderLeaderboard();
    } catch(e) { 
        console.error("Leaderboard fetch error", e);
        renderLeaderboard();
    }
}

function updateBitUI() {
    document.getElementById('bit-count').innerText = formatNumber(game.bits);
    
    let elapsed = Date.now() - game.bitGrowthStartTime;
    if (elapsed >= BIT_GROWTH_MS) {
        elapsed = BIT_GROWTH_MS;
        document.getElementById('bit-progress').style.width = '100%';
        document.getElementById('bit-timer').innerText = "HOTOVO!";
        document.getElementById('btn-harvest-bit').style.display = 'block';
    } else {
        document.getElementById('bit-progress').style.width = `${(elapsed / BIT_GROWTH_MS) * 100}%`;
        document.getElementById('btn-harvest-bit').style.display = 'none';
        
        let left = BIT_GROWTH_MS - elapsed;
        let h = Math.floor(left / (1000*60*60));
        let m = Math.floor((left / (1000*60)) % 60);
        let s = Math.floor((left / 1000) % 60);
        document.getElementById('bit-timer').innerText = `${h}h ${m}m ${s}s`;
    }
}

function updateUI() {
    let activeClickMult = (buffClickTimer > 0 ? 7 : 1);
    document.getElementById('click-power').innerText = formatNumber(game.clickPower * activeClickMult);
    
    document.getElementById('player-name').innerText = censorName(game.name);

    let lowerName = game.name.toLowerCase();
    if (lowerName === 'heisgone' || (currentUser && currentUser.email && currentUser.email.toLowerCase().startsWith('heisgone'))) {
        document.getElementById('btn-dev').style.display = 'flex';
    } else {
        document.getElementById('btn-dev').style.display = 'none';
    }
    
    if((game.bozskeBity && game.bozskeBity > 0) || (game.spentBozskeBity && game.spentBozskeBity > 0)) {
        document.getElementById('divine-display').style.display = 'flex';
        document.getElementById('divine-bits-count').innerText = formatNumber(game.bozskeBity);
        document.getElementById('divine-bonus-count').innerText = game.bozskeBity; 
    } else {
        document.getElementById('divine-display').style.display = 'none';
    }

    updateVisualClickersIfNeeded();
    updateBitUI();
    updateVisualBuildingsBitButtons();
    renderLeaderboard(); 
}

function renderStore() {
    document.getElementById('buildings-store').innerHTML = game.buildings.map((b, i) => `
        <div class="item" data-index="${i}" style="${game.currentScore < Math.floor(b.cost * getPrestigeDiscount()) ? 'opacity: 0.6;' : ''}">
            <div class="item-info">
                <strong>${b.name} (${b.count}x)</strong>
                <span style="font-size:0.75rem; color:#aaa;">+${formatNumber(b.power)} auto/s</span>
            </div>
            <strong>${formatNumber(Math.floor(b.cost * getPrestigeDiscount()))}</strong>
        </div>
    `).join('');

    document.getElementById('clickers-store').innerHTML = game.clickers.map((c, i) => `
        <div class="item" data-index="${i}" style="${game.currentScore < Math.floor(c.cost * getPrestigeDiscount()) ? 'opacity: 0.6;' : ''}">
            <div class="item-info">
                <strong>${c.name} (${c.count}x)</strong>
                <span style="font-size:0.75rem; color:#aaa;">+${formatNumber(c.power)} za klik</span>
            </div>
            <strong>${formatNumber(Math.floor(c.cost * getPrestigeDiscount()))}</strong>
        </div>
    `).join('');

    document.getElementById('upgrades-store').innerHTML = allUpgrades.map(u => {
        if (game.upgrades.includes(u.id)) return ''; 
        return `
            <div class="item upgrade" data-id="${u.id}" style="${game.currentScore < u.cost ? 'opacity: 0.6;' : ''}">
                <div class="item-info">
                    <strong style="color:var(--upgrade)">${u.name}</strong>
                    <span style="font-size:0.75rem; color:#aaa;">${u.desc}</span>
                </div>
                <strong>${formatNumber(u.cost)}</strong>
            </div>
        `;
    }).join('');

    document.getElementById('cosmetics-store').innerHTML = allCosmetics.map(c => {
        let isUnlocked = game.unlockedCosmetics.includes(c.id);
        let isEquipped = game.equipped[c.type] === c.id;
        
        let status = '';
        if (isEquipped) {
            status = '<span style="color:#fff; font-size:0.8rem;">VYBAVENO</span>';
        } else if (isUnlocked) {
            status = '<span style="color:var(--upgrade); font-size:0.8rem;">VYBAVIT</span>';
        } else {
            status = `<strong>${formatNumber(c.cost)}</strong>`;
        }

        let itemClass = 'item cosmetic';
        if (isEquipped) itemClass += ' equipped';

        return `
            <div class="${itemClass}" data-id="${c.id}" style="${!isUnlocked && game.currentScore < c.cost ? 'opacity: 0.6;' : ''}">
                <div class="item-info">
                    <strong style="color:#ff9800">${c.name}</strong>
                    <span style="font-size:0.75rem; color:#aaa;">${c.desc}</span>
                </div>
                ${status}
            </div>
        `;
    }).join('');
}

function renderAchievements() {
    document.getElementById('ach-count').innerText = game.achievements.length;
    document.getElementById('achievements-list').innerHTML = allAchievements.map(a => {
        let isUnlocked = game.achievements.includes(a.id);
        return `<div class="achievement ${isUnlocked ? 'unlocked' : 'locked'}"><strong>${a.name}</strong><span>${a.desc}</span></div>`;
    }).join('');
}

function renderLeaderboard() {
    let sorted = [...mockLeaderboard];
    
    let myDisplayName = currentUser ? game.name : "Host (Ty)";
    
    let myIndex = -1;
    if (currentUser) {
        myIndex = sorted.findIndex(p => p.name === game.name);
    } else {
        myIndex = sorted.findIndex(p => p.name === myDisplayName);
    }
    
    if (myIndex !== -1) {
        sorted[myIndex].currentScore = Math.max(sorted[myIndex].currentScore, game.currentScore);
        sorted[myIndex].totalScore = Math.max(sorted[myIndex].totalScore, game.totalScore);
        sorted[myIndex].achCount = Math.max(sorted[myIndex].achCount, game.achievements.length);
    } else {
        sorted.push({ name: myDisplayName, currentScore: game.currentScore, totalScore: game.totalScore, achCount: game.achievements.length });
    }
    
    sorted.sort((a, b) => b.totalScore - a.totalScore);
    
    let html = '';
    let meRendered = false;

    let top10 = sorted.slice(0, 10);
    
    html = top10.map((p, index) => {
        let isMe = p.name === myDisplayName || (currentUser && p.name === game.name);
        if (isMe) meRendered = true;
        return `
        <tr style="${isMe ? 'background:rgba(187, 134, 252, 0.2); font-weight:bold;' : ''}">
            <td>#${index + 1}</td>
            <td>${censorName(p.name)} ${isMe && currentUser ? '<span style="color:var(--upgrade);font-size:0.8rem;">(Ty)</span>' : ''}</td>
            <td>${formatNumber(Number(p.currentScore) || 0)}</td>
            <td>${formatNumber(Number(p.totalScore) || 0)}</td>
            <td>${p.achCount}</td>
        </tr>
        `;
    }).join('');

    if (!meRendered) {
        let myRealRank = sorted.findIndex(p => p.name === myDisplayName || (currentUser && p.name === game.name)) + 1;
        if (myRealRank > 0) {
            let myData = sorted[myRealRank - 1];
            html += `
            <tr style="background:rgba(187, 134, 252, 0.2); font-weight:bold; border-top: 2px solid var(--accent);">
                <td>#${myRealRank}</td>
                <td>${censorName(myData.name)} ${currentUser ? '<span style="color:var(--upgrade);font-size:0.8rem;">(Ty)</span>' : ''}</td>
                <td>${formatNumber(Number(myData.currentScore) || 0)}</td>
                <td>${formatNumber(Number(myData.totalScore) || 0)}</td>
                <td>${myData.achCount}</td>
            </tr>
            `;
        }
    }

    document.getElementById('leaderboard-body').innerHTML = html;
}

function updateTimerDisplay() {
    let diff = nextFetchTime - Date.now();
    if (diff <= 0) diff = 0;
    let h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    let m = Math.floor((diff / 1000 / 60) % 60);
    let s = Math.floor((diff / 1000) % 60);
    document.getElementById('time-left').innerText = `${h}h ${m}m ${s}s`;
    renderStore(); 
}

function showStats() {
    let totalItems = 0;
    game.buildings.forEach(b => totalItems += b.count);
    game.clickers.forEach(c => totalItems += c.count);
    
    let playTimeSeconds = Math.floor((Date.now() - game.startDate) / 1000);
    let d = Math.floor(playTimeSeconds / (3600*24));
    let h = Math.floor(playTimeSeconds % (3600*24) / 3600);
    let m = Math.floor(playTimeSeconds % 3600 / 60);
    
    document.getElementById('stats-container').innerHTML = `
        <div class="stat-row"><span>Jméno:</span> <strong>${censorName(game.name)}</strong></div>
        <div class="stat-row"><span>Datum založení:</span> <strong>${new Date(game.startDate).toLocaleDateString('cs-CZ')}</strong></div>
        <div class="stat-row"><span>Odehraný čas:</span> <strong>${d}d ${h}h ${m}m</strong></div>
        <div class="stat-row"><span>Celkové skóre:</span> <strong>${formatNumber(game.totalScore)}</strong></div>
        <div class="stat-row"><span>Počet Postoupení:</span> <strong>${game.ascensionCount}</strong></div>
        <div class="stat-row"><span>Ruční kliknutí:</span> <strong>${formatNumber(game.manualClicks)}</strong></div>
        <div class="stat-row"><span>Zakoupené předměty:</span> <strong>${formatNumber(totalItems)}</strong></div>
        <div class="stat-row"><span>Vytěžené Bity:</span> <strong>${formatNumber(game.bits)}</strong></div>
    `;
}

window.addEventListener('load', init);