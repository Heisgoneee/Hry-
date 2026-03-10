const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

let players = {};
let cops = [];
let vault = { x: 350, y: 20, width: 100, height: 100, money: 0 };

// Hlavní smyčka serveru (20 FPS)
setInterval(() => {
    cops.forEach(cop => {
        let closestPlayer = null;
        let minDist = Infinity;

        // Najít nejbližšího živého hráče
        for (let id in players) {
            let p = players[id];
            if (p.hp <= 0) continue; 

            let dist = Math.sqrt((p.x - cop.x)**2 + (p.y - cop.y)**2);
            if (dist < minDist) {
                minDist = dist;
                closestPlayer = p;
            }
        }

        if (closestPlayer) {
            const angle = Math.atan2(closestPlayer.y - cop.y, closestPlayer.x - cop.x);
            cop.x += Math.cos(angle) * 1.8;
            cop.y += Math.sin(angle) * 1.8;

            // Útok policisty (kolize)
            let distToPlayer = Math.sqrt((closestPlayer.x - cop.x)**2 + (closestPlayer.y - cop.y)**2);
            if (distToPlayer < 30) {
                closestPlayer.hp -= 0.8; // Postupné ubírání HP
                if (closestPlayer.hp < 0) closestPlayer.hp = 0;
            }
        }
    });

    // Vykrádání trezoru
    for (let id in players) {
        let p = players[id];
        if (p.hp > 0 && p.x > vault.x && p.x < vault.x + vault.width && p.y > vault.y && p.y < vault.y + vault.height) {
            vault.money += 1;
        }
    }

    io.emit('gameState', { players, cops, vault });
}, 50);

// Spawn policistů
setInterval(() => {
    if (Object.keys(players).length > 0 && cops.length < 10) {
        cops.push({
            id: Math.random().toString(36).substr(2, 9),
            x: Math.random() * 800,
            y: 600,
            hp: 50
        });
    }
}, 4000);

io.on('connection', (socket) => {
    players[socket.id] = { x: 400, y: 300, hp: 100 };

    socket.on('move', (data) => {
        if (players[socket.id] && players[socket.id].hp > 0) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
        }
    });

    socket.on('shoot', (targetId) => {
        if (players[socket.id] && players[socket.id].hp > 0) {
            cops = cops.filter(cop => {
                if (cop.id === targetId) {
                    cop.hp -= 25;
                    return cop.hp > 0;
                }
                return true;
            });
        }
    });

    socket.on('respawn', () => {
        if (players[socket.id]) {
            players[socket.id].hp = 100;
            players[socket.id].x = 400;
            players[socket.id].y = 500;
        }
    });

    socket.on('disconnect', () => { delete players[socket.id]; });
});

// Nastavení portu pro Render
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server běží na portu ${PORT}`));
