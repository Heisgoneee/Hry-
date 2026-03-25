import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBnFQf-YQODWhZN-3scSbWIQIgr3poDIos",
  authDomain: "tetris-5e14c.firebaseapp.com",
  projectId: "tetris-5e14c",
  storageBucket: "tetris-5e14c.firebasestorage.app",
  messagingSenderId: "923778243713",
  appId: "1:923778243713:web:082344d745cd11d2244180",
  measurementId: "G-7461NY9DYR"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Cenzura ---
function censorName(name) {
    if (!name) return "Anonym"; 
    const strName = String(name);

    const isCensorshipEnabled = localStorage.getItem('globalCensorship') !== 'false'; 
    
    if (!isCensorshipEnabled) {
        return strName;
    }

    const badWordsRegex = /negr|nigga|niga|cigan|cikán|kokot|buzerant|kurv|mrd|píč|pič|píc|pic|jeb|zmrd|debil|idiot|čurák|curak|hovn|kund/gi;

    return strName.replace(badWordsRegex, (match) => {
        const len = match.length;
        if (len <= 2) return match[0] + '*';
        return match[0] + '***' + match[len - 1]; 
    });
}
// ---------------

let money = 0;
let jackpotChance = 0.05;
let combo = 0;
let baseReward = 0.50;
let comboMultiplier = 2.0; 
let startTime = null;
let timerInterval = null;
let isGameOver = false;

const symbols = ['🍒', '🍋', '🔔', '🍉', '🍇', '💎'];
const jackpotSymbol = '💎';

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(f, t, d, v) {
    try {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = t; o.frequency.setValueAtTime(f, audioCtx.currentTime);
        g.gain.setValueAtTime(v, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + d);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(); o.stop(audioCtx.currentTime + d);
    } catch(e) {}
}

async function loadLeaderboard() {
    try {
        const q = query(collection(db, "scores_spin"), orderBy("time", "asc"), limit(5));
        const querySnapshot = await getDocs(q);
        const tbody = document.getElementById('leaderboard-body');
        tbody.innerHTML = "";
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const cleanName = censorName(data.name);
            tbody.innerHTML += `<tr><td>${cleanName}</td><td>${data.time}s</td></tr>`;
        });
    } catch (e) {
        console.error("DB Error:", e);
    }
}

document.getElementById('upg-chance').addEventListener('click', function() {
    let cost = parseFloat(this.dataset.cost);
    if (money >= cost) {
        money -= cost;
        jackpotChance += 0.02;
        this.dataset.cost = (cost * 1.8).toFixed(2);
        this.querySelector('.cost').innerText = this.dataset.cost;
        updateUI();
    }
});

document.getElementById('upg-reward').addEventListener('click', function() {
    let cost = parseFloat(this.dataset.cost);
    if (money >= cost) {
        money -= cost;
        baseReward *= 2;
        this.dataset.cost = (cost * 2.0).toFixed(2);
        this.querySelector('.cost').innerText = this.dataset.cost;
        updateUI();
    }
});

document.getElementById('upg-combo').addEventListener('click', function() {
    let cost = parseFloat(this.dataset.cost);
    if (money >= cost) {
        money -= cost;
        comboMultiplier += 1.0;
        this.dataset.cost = (cost * 2.5).toFixed(2);
        this.querySelector('.cost').innerText = this.dataset.cost;
        updateUI();
    }
});

function getRandomSymbol(exclude = null) {
    let sym;
    do {
        sym = symbols[Math.floor(Math.random() * symbols.length)];
    } while (sym === exclude);
    return sym;
}

function spin() {
    if (isGameOver) return;
    if (!startTime) {
        startTime = Date.now();
        timerInterval = setInterval(() => {
            document.getElementById('timer').innerText = ((Date.now() - startTime) / 1000).toFixed(1);
        }, 100);
    }

    const btn = document.getElementById('spin-btn');
    const reels = [document.getElementById('reel1'), document.getElementById('reel2'), document.getElementById('reel3')];
    
    btn.disabled = true;
    
    reels.forEach(reel => {
        reel.innerText = "🎰";
        reel.classList.add('spinning');
    });
    
    let spinSoundInterval = setInterval(() => {
        playSound(300 + Math.random()*200, 'square', 0.1, 0.05);
    }, 100);

    const isJackpot = Math.random() < jackpotChance;
    
    let resultSymbols = [];
    if (isJackpot) {
        resultSymbols = [jackpotSymbol, jackpotSymbol, jackpotSymbol];
    } else {
        resultSymbols = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
        if (resultSymbols[0] === resultSymbols[1] && resultSymbols[1] === resultSymbols[2] && resultSymbols[0] === jackpotSymbol) {
            resultSymbols[2] = getRandomSymbol(jackpotSymbol);
        }
    }

    reels.forEach((reel, index) => {
        setTimeout(() => {
            reel.classList.remove('spinning');
            reel.innerText = resultSymbols[index];
            playSound(200, 'sine', 0.2, 0.1);
            
            if (index === 2) {
                clearInterval(spinSoundInterval);
                finishSpin(isJackpot);
            }
        }, 800 + (index * 400));
    });
}

function finishSpin(isJackpot) {
    const btn = document.getElementById('spin-btn');
    
    if (isJackpot) {
        combo++;
        let currentGain = baseReward * Math.pow(comboMultiplier, combo - 1);
        money += currentGain;
        playSound(800 + (combo * 100), 'triangle', 0.6, 0.2);
        setTimeout(() => playSound(1200 + (combo * 100), 'triangle', 0.8, 0.2), 150);
    } else {
        combo = 0;
        playSound(100, 'sawtooth', 0.6, 0.1);
    }
    
    updateUI();
    
    if (combo >= 10) {
        winGame();
    } else {
        btn.disabled = false;
    }
}

function updateUI() {
    document.getElementById('money').innerText = money.toFixed(2);
    document.getElementById('combo').innerText = combo;
    document.getElementById('chance').innerText = (jackpotChance * 100).toFixed(0);
    document.getElementById('progress-fill').style.width = (combo * 10) + "%";

    document.querySelectorAll('.upgrade-btn').forEach(btn => {
        btn.disabled = money < parseFloat(btn.dataset.cost);
    });
}

function winGame() {
    isGameOver = true;
    clearInterval(timerInterval);
    document.getElementById('win-screen').style.display = 'flex';
    document.getElementById('win-stats').innerText = `Čas: ${document.getElementById('timer').innerText}s | Výhra: ${money.toFixed(2)}$`;
}

document.getElementById('save-btn').addEventListener('click', async () => {
    const rawName = document.getElementById('player-name').value;
    const name = rawName.trim() || "Anonym";
    const time = parseFloat(document.getElementById('timer').innerText);
    
    try {
        await addDoc(collection(db, "scores_spin"), { name: name, time: time, date: Date.now() });
        location.reload();
    } catch (e) {
        console.error("Chyba při ukládání:", e);
    }
});

document.getElementById('spin-btn').addEventListener('click', spin);
loadLeaderboard();