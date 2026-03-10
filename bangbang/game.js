const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const socket = io('http://localhost:3000'); // Připojení k serveru

let players = {};
let myId = null;

socket.on('connect', () => {
    myId = socket.id;
});

// Příjem dat o všech hráčích od serveru
socket.on('updatePlayers', (serverPlayers) => {
    players = serverPlayers;
});

// Detekce pohybu (WASD)
const keys = { w: false, a: false, s: false, d: false };
window.addEventListener('keydown', (e) => { keys[e.key] = true; });
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

function update() {
    if (!players[myId]) return;

    let moved = false;
    const speed = 5;
    const p = players[myId];

    if (keys.w) { p.y -= speed; moved = true; }
    if (keys.s) { p.y += speed; moved = true; }
    if (keys.a) { p.x -= speed; moved = true; }
    if (keys.d) { p.x += speed; moved = true; }

    // Pokud jsme se pohnuli, pošleme to serveru
    if (moved) {
        socket.emit('move', { x: p.x, y: p.y });
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Vykreslení všech hráčů (včetně parťáka)
    for (let id in players) {
        const player = players[id];
        ctx.fillStyle = (id === myId) ? 'blue' : 'red'; // Já jsem modrý, parťák červený
        ctx.fillRect(player.x, player.y, 30, 30); // Čtverec místo postavy
        
        ctx.fillStyle = 'black';
        ctx.fillText(id === myId ? "Ty (Lupič 1)" : "Parťák (Lupič 2)", player.x - 10, player.y - 10);
    }

    update();
    requestAnimationFrame(draw);
}

draw();
