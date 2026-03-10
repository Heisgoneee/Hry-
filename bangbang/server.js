const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let players = {};
let cops = [];
let bullets = [];
let vault = { x: 350, y: 20, width: 100, height: 100, money: 0 };
const walls = [{ x: 0, y: 150, w: 300, h: 20 }, { x: 500, y: 150, w: 300, h: 20 }];

// Hlavní smyčka serveru (20 FPS)
setInterval(() => {
    // 1. Logika policistů
    cops.forEach(cop => {
        let closest = null;
        let minDist = Infinity;
        for (let id in players) {
            if (players[id].hp <= 0) continue;
            let dist = Math.sqrt((players[id].x - cop.x)**2 + (players[id].y - cop.y)**2);
            if (dist < minDist) { minDist = dist; closest = players[id]; }
        }

        if (closest) {
            const angle = Math.atan2(closest.y - cop.y, closest.x - cop.x);
            let dist = Math.sqrt((closest.x - cop.x)**2 + (closest.y - cop.y)**2);
            
            // Policista se snaží držet v dálce, aby mohl střílet
            if (dist > 250) {
                cop.x += Math.cos(angle) * 1.7;
                cop.y += Math.sin(angle) * 1.7;
            } else if (dist < 150) {
                cop.x -= Math.cos(angle) * 1.2;
                cop.y -= Math.sin(angle) * 1.2;
            }

            // Střelba policisty (pravděpodobnost)
            if (Math.random() < 0.03) {
                bullets.push({
                    x: cop.x + 15, y: cop.y + 15,
                    vx: Math.cos(angle) * 6, vy: Math.sin(angle) * 6,
                    life: 80
                });
            }
        }
    });

    // 2. Logika projektilů
    bullets = bullets.filter(b => {
        b.x += b.vx; b.y += b.vy; b.life--;
        for (let id in players) {
            let p = players[id];
            if (p.hp > 0 && b.x > p.x && b.x < p.x + 40 && b.y > p.y && b.y < p.y + 40) {
                p.hp -= 10;
                return false;
            }
        }
        return b.life > 0;
    });

    // 3. Vykrádání trezoru
    for (let id in players) {
        let p = players[id];
        if (p.hp > 0 && p.x > vault.x && p.x < vault.x + vault.width && p.y > vault.y && p.y < vault.y + vault.height) {
            vault.money += 1;
        }
    }

    io.emit('gameState', { players, cops, vault, walls, bullets });
}, 50);

// Spawn policistů
setInterval(() => {
    if (Object.keys(players).length > 0 && cops.length < 7) {
        cops.push({ id: Math.random().toString(36).substr(2, 9), x: Math.random() * 800, y: 650, hp: 50 });
    }
}, 5000);

io.on('connection', (socket) => {
    players[socket.id] = { x: 400, y: 500, hp: 100 };
    socket.on('move', (d) => { if (players[socket.id]?.hp > 0) { players[socket.id].x = d.x; players[socket.id].y = d.y; } });
    socket.on('shoot', (id) => { cops = cops.filter(c => { if(c.id === id) c.hp -= 25; return c.hp > 0; }); });
    socket.on('respawn', () => { if(players[socket.id]) { players[socket.id].hp = 100; players[socket.id].x = 400; players[socket.id].y = 500; }});
    socket.on('disconnect', () => delete players[socket.id]);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Railway server běží na portu ${PORT}`));
