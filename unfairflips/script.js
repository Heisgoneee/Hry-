import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBnFQf-YQODWhZN-3scSbWIQIgr3poDIos",
    authDomain: "tetris-5e14c.firebaseapp.com",
    projectId: "tetris-5e14c",
    storageBucket: "tetris-5e14c.firebasestorage.app",
    messagingSenderId: "923778243713",
    appId: "1:923778243713:web:aa6812f49713ad18244180"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let money = 0;
let headChance = 0.20;
let combo = 0;
let baseReward = 0.05;
let comboMultiplier = 1.5; 
let startTime = null;
let timerInterval = null;
let isGameOver = false;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(f, t, d, v) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = t; o.frequency.setValueAtTime(f, audioCtx.currentTime);
    g.gain.setValueAtTime(v, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + d);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + d);
}

async function loadLeaderboard() {
    try {
        const q = query(collection(db, "scores"), orderBy("time", "asc"), limit(5));
        const querySnapshot = await getDocs(q);
        const tbody = document.getElementById('leaderboard-body');
        tbody.innerHTML = "";
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            tbody.innerHTML += `<tr><td>${data.name}</td><td>${data.time}s</td></tr>`;
        });
    } catch (e) {
        console.error("Chyba při načítání tabulky:", e);
    }
}

document.getElementById('upg-chance').addEventListener('click', function() {
    let cost = parseFloat(this.dataset.cost);
    if (money >= cost) {
        money -= cost;
        headChance += 0.05;
        this.dataset.cost = (cost * 2.5).toFixed(2);
        this.querySelector('.cost').innerText = this.dataset.cost;
        updateUI();
    }
});

document.getElementById('upg-reward').addEventListener('click', function() {
    let cost = parseFloat(this.dataset.cost);
    if (money >= cost) {
        money -= cost;
        baseReward *= 2;
        this.dataset.cost = (cost * 3).toFixed(2);
        this.querySelector('.cost').innerText = this.dataset.cost;
        updateUI();
    }
});

document.getElementById('upg-combo').addEventListener('click', function() {
    let cost = parseFloat(this.dataset.cost);
    if (money >= cost) {
        money -= cost;
        comboMultiplier += 0.5;
        this.dataset.cost = (cost * 2.8).toFixed(2);
        this.querySelector('.cost').innerText = this.dataset.cost;
        updateUI();
    }
});

function flipCoin() {
    if (isGameOver) return;
    if (!startTime) {
        startTime = Date.now();
        timerInterval = setInterval(() => {
            document.getElementById('timer').innerText = ((Date.now() - startTime) / 1000).toFixed(1);
        }, 100);
    }

    const btn = document.getElementById('flip-btn');
    const coin = document.getElementById('coin');
    
    btn.disabled = true;
    coin.classList.remove('flipping');
    void coin.offsetWidth;
    coin.classList.add('flipping');
    playSound(150, 'sine', 0.5, 0.2);

    setTimeout(() => {
        const isHead = Math.random() < headChance;
        if (isHead) {
            combo++;
            let currentGain = baseReward * Math.pow(comboMultiplier, combo - 1);
            money += currentGain;
            
            coin.innerText = "H";
            coin.style.background = "#ffd700";
            playSound(500 + (combo * 100), 'square', 0.3, 0.1);
        } else {
            combo = 0;
            coin.innerText = "O";
            coin.style.background = "#c0c0c0";
            playSound(150, 'sawtooth', 0.4, 0.1);
        }
        updateUI();
        if (combo >= 10) winGame();
    }, 600);

    setTimeout(() => { if (!isGameOver) btn.disabled = false; }, 750);
}

function updateUI() {
    document.getElementById('money').innerText = money.toFixed(2);
    document.getElementById('combo').innerText = combo;
    document.getElementById('chance').innerText = Math.round(headChance * 100);
    document.getElementById('progress-fill').style.width = (combo * 10) + "%";

    document.querySelectorAll('.upgrade-btn').forEach(btn => {
        btn.disabled = money < parseFloat(btn.dataset.cost);
    });
}

function winGame() {
    isGameOver = true;
    clearInterval(timerInterval);
    document.getElementById('win-screen').style.display = 'flex';
    document.getElementById('win-stats').innerText = `Čas: ${document.getElementById('timer').innerText}s`;
}

document.getElementById('save-btn').addEventListener('click', async () => {
    const name = document.getElementById('player-name').value || "Anonym";
    const time = parseFloat(document.getElementById('timer').innerText);
    
    try {
        await addDoc(collection(db, "scores"), { name, time, date: Date.now() });
        location.reload();
    } catch (e) {
        console.error("Chyba při ukládání:", e);
    }
});

document.getElementById('flip-btn').addEventListener('click', flipCoin);
loadLeaderboard();