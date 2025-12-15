document.addEventListener("DOMContentLoaded", function() {
    console.log("Script loaded and ready.");

    const socket = io();
    
    // --- UI ELEMENTS (DEFINED AT TOP TO PREVENT ERRORS) ---
    const canvas = document.getElementById('wheelCanvas');
    const ctx = canvas.getContext('2d');
    const wheelContainer = document.getElementById('wheelContainer');
    
    const winnerDisplay = document.getElementById('status'); 
    const modal = document.getElementById('winnerModal');
    const winnerText = document.getElementById('winnerText');
    const playerCountEl = document.getElementById('playerCount');

    // Manage Modal Elements
    const manageModal = document.getElementById('manageModal');
    const listContainer = document.getElementById('playerListContainer');

    // State Variables
    let players = [];
    let startAngle = 0;
    let arc = 0;
    let isSpinning = false;
    let currentRotation = 0; 

    // Colors
    const colors = ["#D4F238", "#9D84F6", "#3E6AEF", "#FF8C33", "#1A1A1A", "#E0DCD0"];
    const textColors = ["#1A1A1A", "#1A1A1A", "#FFFFFF", "#1A1A1A", "#FFFFFF", "#1A1A1A"];

    // --- 1. RESIZE LOGIC ---
    function resizeCanvas() {
        if (!wheelContainer) return;
        
        const dpr = window.devicePixelRatio || 1; 
        const rect = wheelContainer.getBoundingClientRect();
        
        // Calculate size based on container
        let size = Math.min(rect.width, rect.height) - 40;
        if (size < 200) size = 200; 

        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = size + "px";
        canvas.style.height = size + "px";

        ctx.scale(dpr, dpr);
        drawRouletteWheel();
    }
    window.addEventListener('resize', resizeCanvas);

    // --- 2. SOCKET EVENTS ---
    socket.on('connect', () => {
        console.log("Connected to server!");
        resizeCanvas();
    });

    socket.on('update_players', (data) => {
        players = data.players;
        
        // Update User Count
        if(playerCountEl) playerCountEl.innerText = players.length;
        
        // Redraw Wheel
        resizeCanvas(); 
        
        // Update Admin List if it's currently open
        if (manageModal && manageModal.style.display === 'block') {
            renderPlayerList();
        }
    });

    socket.on('spin_result', (data) => {
        if (isSpinning) return;
        if(winnerDisplay) winnerDisplay.innerText = "Spinning...";
        spinWheelToWinner(data.index);
    });

    // --- 3. DRAWING LOGIC ---
    function drawRouletteWheel() {
        const width = parseFloat(canvas.style.width);
        const height = parseFloat(canvas.style.height);
        const centerX = width / 2;
        const centerY = height / 2;
        
        ctx.clearRect(0, 0, width, height);

        if (players.length === 0) {
            // Draw Empty State
            ctx.beginPath();
            ctx.arc(centerX, centerY, width/2 - 10, 0, Math.PI * 2);
            ctx.fillStyle = "#f0f0f0";
            ctx.fill();
            ctx.stroke();

            ctx.font = 'bold 20px DM Sans, Arial';
            ctx.fillStyle = "#999";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle"; 
            ctx.fillText("Waiting for players...", centerX, centerY);
            return;
        }

        const outsideRadius = width / 2 - 10;
        const textRadius = width / 2 - 50;
        const insideRadius = 40;
        arc = Math.PI * 2 / players.length;

        players.forEach((player, i) => {
            const angle = startAngle + i * arc;
            
            ctx.fillStyle = colors[i % colors.length];
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, outsideRadius, angle, angle + arc, false);
            ctx.arc(centerX, centerY, insideRadius, angle + arc, angle, true);
            ctx.stroke();
            ctx.fill();

            ctx.save();
            ctx.fillStyle = textColors[i % textColors.length];
            ctx.translate(centerX + Math.cos(angle + arc / 2) * textRadius, 
                          centerY + Math.sin(angle + arc / 2) * textRadius);
            ctx.rotate(angle + arc / 2 + Math.PI / 2);
            
            const fontSize = Math.max(14, width / 25); 
            ctx.font = `bold ${fontSize}px DM Sans, Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            
            let text = player;
            if (text.length > 15) text = text.substring(0, 12) + "...";

            ctx.fillText(text, 0, 0);
            ctx.restore();
        });

        // Center Pin
        ctx.beginPath();
        ctx.arc(centerX, centerY, insideRadius - 5, 0, 2 * Math.PI);
        ctx.fillStyle = "#fff";
        ctx.fill();
    }

    // --- 4. SPIN LOGIC ---
    function spinWheelToWinner(winnerIndex) {
        isSpinning = true;
        if(modal) modal.style.display = 'none'; 
        if(manageModal) manageModal.style.display = 'none'; // Close manage modal if open
        
        const extraRotations = 360 * 8; 
        const sliceDeg = 360 / players.length;
        const winningSliceCenter = (winnerIndex * sliceDeg) + (sliceDeg / 2);
        
        let targetRotation = 270 - winningSliceCenter;
        while(targetRotation < 0) targetRotation += 360;
        
        const currentRotMod = currentRotation % 360;
        let dist = targetRotation - currentRotMod;
        if(dist < 0) dist += 360;

        const finalDegree = currentRotation + dist + extraRotations;
        currentRotation = finalDegree; 

        canvas.style.transition = "transform 5s cubic-bezier(0.25, 0.1, 0.25, 1)";
        canvas.style.transform = `rotate(${finalDegree}deg)`;

        setTimeout(() => {
            isSpinning = false;
            if(winnerDisplay) winnerDisplay.innerText = "Winner: " + players[winnerIndex];
            if(winnerText) winnerText.innerText = players[winnerIndex];
            if(modal) modal.style.display = 'block';
            launchConfetti();
        }, 5000);
    }

    // --- 5. MANAGE USERS LOGIC ---

    // Define globally so HTML onclick can see it
    window.removeSpecificUser = function(name) {
        // Prevent accidental clicks on empty space
        if(!name) return;
        socket.emit('remove_player', { name: name });
        // List will auto-update when server sends 'update_players' back
    };

    window.openManageModal = function() {
        if(!manageModal) return;
        renderPlayerList(); 
        manageModal.style.display = 'block';
    };

    window.closeManageModal = function() {
        if(manageModal) manageModal.style.display = 'none';
    };

    function renderPlayerList() {
        if (!listContainer) return;
        listContainer.innerHTML = ""; 

        if (players.length === 0) {
            listContainer.innerHTML = "<p style='text-align:center; opacity:0.5;'>No players yet.</p>";
            return;
        }

        players.forEach(player => {
            const row = document.createElement('div');
            row.className = 'player-row';
            
            // Escape quotes in names to prevent bugs
            const safeName = player.replace(/'/g, "\\'");
            
            const html = `
                <span class="player-name">${player}</span>
                <div class="remove-icon" onclick="removeSpecificUser('${safeName}')">&times;</div>
            `;
            
            row.innerHTML = html;
            listContainer.appendChild(row);
        });
    }

    // --- 6. GLOBAL CONTROLS ---
    window.triggerSpin = function() {
        if(players.length > 0) socket.emit('spin_wheel');
        else alert("Add players first!");
    };

    window.triggerReset = function() {
        if(confirm("Clear everyone?")) {
            socket.emit('reset_game');
            canvas.style.transition = 'none';
            canvas.style.transform = `rotate(0deg)`;
            currentRotation = 0;
        }
    };

    window.closeModal = function() {
        if(modal) modal.style.display = 'none';
    };
    
    // Handle clicks outside modals
    window.onclick = function(event) {
        if (event.target == modal) modal.style.display = "none";
        if (event.target == manageModal) manageModal.style.display = "none";
    };

    function launchConfetti() {
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#D4F238', '#9D84F6', '#3E6AEF']
            });
        }
    }
});