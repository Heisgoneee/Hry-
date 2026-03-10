const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const players = {};
let cops = [];
let vault = { x: 350, y: 20, width: 100, height: 100, money: 0 };

// Logika serveru (Game Loop) - běží 20x za sekundu
setInterval(() => {
    // 1. Pohyb policistů k nejbližšímu hráči
    cops.forEach(cop => {
        let closestPlayer = null;
        let minDist = Infinity;

        for (let id in players) {
            let p = players[id];
            let dist = Math.sqrt((p.x - cop.x)**2 + (p.y - cop.y)**2);
            if (dist < minDist) {
                minDist = dist;
                closestPlayer = p;
            }
        }

        if (closestPlayer) {
            const angle = Math.atan2(closestPlayer.y - cop.y, closestPlayer.x - cop.x);
            cop.x += Math.cos(angle) * 1.5; // Rychlost policie
            cop.y += Math.sin(angle) * 1.5;
        }
    });

    // 2. Vykrádání trezoru (pokud je hráč v zóně)
    for (let id in players) {
        let p = players[id];
        if (p.x > vault.x && p.x < vault.x + vault.width && p.y > vault.y && p.y < vault.y + vault.height) {
            vault.money += 1; // Přičítání peněz
        }
    }

    // 3. Rozeslání stavu všem
    io.emit('gameState', { players, cops, vault });
}, 50);

// Spawn policisty každých 5 sekund
setInterval(() => {
    if (Object.keys(players).length > 0) {
        cops.push({
            id: Math.random().toString(36).substr(2, 9),
            x: Math.random() * 800,
            y: 600,
            hp: 50
        });
    }
}, 5000);

io.on('connection', (socket) => {
    console.log('Lupič vstoupil do banky:', socket.id);

    players[socket.id] = { x: 400, y: 300, hp: 100 };

    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
        }
    });

    socket.on('shoot', (targetId) => {
        cops = cops.filter(cop => {
            if (cop.id === targetId) {
                cop.hp -= 25;
                return cop.hp > 0;
            }
            return true;
        });
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        console.log('Lupič utekl/byl dopaden');
    });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server běží na portu ${PORT}`));