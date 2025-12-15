document.addEventListener("DOMContentLoaded", function() {
    console.log("Script loaded and ready.");

    const socket = io();
    const canvas = document.getElementById('wheelCanvas');
    const ctx = canvas.getContext('2d');
    const wheelContainer = document.getElementById('wheelContainer');
    
    // UI Elements
    const winnerDisplay = document.getElementById('status'); 
    const modal = document.getElementById('winnerModal');
    const winnerText = document.getElementById('winnerText');
    const playerCountEl = document.getElementById('playerCount');

    let players = [];
    let startAngle = 0;
    let arc = 0;
    let isSpinning = false;
    let currentRotation = 0; 

    // Modern Bento Color Palette
    const colors = ["#D4F238", "#9D84F6", "#3E6AEF", "#FF8C33", "#1A1A1A", "#E0DCD0"];
    const textColors = ["#1A1A1A", "#1A1A1A", "#FFFFFF", "#1A1A1A", "#FFFFFF", "#1A1A1A"];

    // --- 1. RESIZE LOGIC (Crucial for visibility) ---
    function resizeCanvas() {
        if (!wheelContainer) return;
        
        // Get width of the container
        let size = wheelContainer.offsetWidth - 40; 
        
        // Limit max size
        if (size > 500) size = 500;
        // Limit min size (prevent 0px bug)
        if (size < 300) size = 300; 

        canvas.width = size;
        canvas.height = size;
        
        // Redraw immediately after resize
        drawRouletteWheel();
    }

    // Resize when window changes
    window.addEventListener('resize', resizeCanvas);
    // Resize immediately on load
    resizeCanvas();

    // --- 2. SOCKET EVENTS ---
    socket.on('connect', () => {
        console.log("Connected to server!");
    });

    socket.on('update_players', (data) => {
        console.log("Players updated:", data.players);
        players = data.players;
        
        if(playerCountEl) playerCountEl.innerText = players.length;
        
        drawRouletteWheel();
    });

    socket.on('spin_result', (data) => {
        if (isSpinning) return;
        console.log("Spinning to:", data.winner);
        
        if(winnerDisplay) winnerDisplay.innerText = "Spinning...";
        spinWheelToWinner(data.index);
    });

    // --- 3. DRAWING LOGIC ---
    function drawRouletteWheel() {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // If no players, draw a "Waiting" placeholder
        if (players.length === 0) {
            ctx.clearRect(0,0, canvas.width, canvas.height);
            
            // Draw gray circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, canvas.width/2 - 10, 0, Math.PI * 2);
            ctx.fillStyle = "#f0f0f0";
            ctx.fill();
            ctx.stroke();

            ctx.font = 'bold 20px sans-serif';
            ctx.fillStyle = "#999";
            ctx.textAlign = "center";
            ctx.fillText("Waiting for players...", centerX, centerY);
            return;
        }

        const outsideRadius = canvas.width / 2 - 10;
        const textRadius = canvas.width / 2 - 50;
        const insideRadius = 40;

        arc = Math.PI * 2 / players.length;
        
        ctx.clearRect(0,0, canvas.width, canvas.height);

        players.forEach((player, i) => {
            const angle = startAngle + i * arc;
            
            ctx.fillStyle = colors[i % colors.length];
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, outsideRadius, angle, angle + arc, false);
            ctx.arc(centerX, centerY, insideRadius, angle + arc, angle, true);
            ctx.stroke();
            ctx.fill();

            ctx.save();
            
            // Text styling
            ctx.fillStyle = textColors[i % textColors.length];
            ctx.translate(centerX + Math.cos(angle + arc / 2) * textRadius, 
                          centerY + Math.sin(angle + arc / 2) * textRadius);
            ctx.rotate(angle + arc / 2 + Math.PI / 2);
            
            const text = player;
            ctx.font = 'bold 16px DM Sans, Arial';
            ctx.fillText(text, -ctx.measureText(text).width / 2, 0);
            ctx.restore();
        });

        // Draw Center Pin (White Circle)
        ctx.beginPath();
        ctx.arc(centerX, centerY, insideRadius - 5, 0, 2 * Math.PI);
        ctx.fillStyle = "#fff";
        ctx.fill();
        
        // Draw Triangle Arrow (Static on top of canvas using CSS is better, but this is a backup)
    }

    // --- 4. SPIN LOGIC ---
    function spinWheelToWinner(winnerIndex) {
        isSpinning = true;
        if(modal) modal.style.display = 'none'; 
        
        const extraRotations = 360 * 8; // 8 full spins
        const sliceDeg = 360 / players.length;
        
        // Target is top (270 deg)
        const winningSliceCenter = (winnerIndex * sliceDeg) + (sliceDeg / 2);
        let targetRotation = 270 - winningSliceCenter;
        
        while(targetRotation < 0) targetRotation += 360;
        
        const currentRotMod = currentRotation % 360;
        let dist = targetRotation - currentRotMod;
        if(dist < 0) dist += 360;

        const finalDegree = currentRotation + dist + extraRotations;
        currentRotation = finalDegree; 

        // Apply CSS Transform
        canvas.style.transition = "transform 5s cubic-bezier(0.25, 0.1, 0.25, 1)";
        canvas.style.transform = `rotate(${finalDegree}deg)`;

        // Wait for animation to finish
        setTimeout(() => {
            isSpinning = false;
            const winnerName = players[winnerIndex];
            
            if(winnerDisplay) winnerDisplay.innerText = "Winner: " + winnerName;
            if(winnerText) winnerText.innerText = winnerName;
            if(modal) modal.style.display = 'block';
            
            launchConfetti();
        }, 5000);
    }

    // --- 5. GLOBAL FUNCTIONS (For HTML buttons) ---
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

    window.onclick = function(event) {
        if (event.target == modal) modal.style.display = "none";
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