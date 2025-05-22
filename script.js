// --- DOM Elements for Navigation ---
const mainMenuContainer = document.getElementById('mainMenuContainer');
const langtonsAntGameContainer = document.getElementById('langtonsAntGameContainer');
const launchLangtonsAntButton = document.getElementById('launchLangtonsAnt');
const backToMenuButton = document.getElementById('backToMenuButton');


// --- Langton's Ant Game Logic (Wrapped) ---
const LangtonsAntGame = (function() {
    // ... (previous Langton's Ant game code remains the same) ...
    // --- Configuration ---
    const CELL_SIZE = 5;
    const ruleMap = {
        'R': (dir) => (dir + 1) % 4,
        'L': (dir) => (dir - 1 + 4) % 4,
        'U': (dir) => (dir + 2) % 4,
        'N': (dir) => dir
    };
    const ruleChars = Object.keys(ruleMap);
    const MIN_RULE_LENGTH = 2;
    const MAX_RULE_LENGTH = 8;
    const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];

    // --- State Variables ---
    let canvas, context, grid, ants = [], colors = [];
    let NUM_COLORS = 2, currentRuleString = "RL";
    let simulationInterval = null, intervalDelay = 50;
    let GRID_WIDTH, GRID_HEIGHT, stepCount = 0;
    let isInitialized = false;

    // --- Get DOM Elements (Game Specific) ---
    let startButton, stopButton, stepButton, speedControl, stepCountSpan,
        ruleStringInput, numAntsInput, randomRuleButton;

    function cacheDomElements() {
        canvas = document.getElementById('antCanvas');
        startButton = document.getElementById('startButton');
        stopButton = document.getElementById('stopButton');
        stepButton = document.getElementById('stepButton');
        speedControl = document.getElementById('speedControl');
        stepCountSpan = document.getElementById('stepCount');
        ruleStringInput = document.getElementById('ruleStringInput');
        numAntsInput = document.getElementById('numAntsInput');
        randomRuleButton = document.getElementById('randomRuleButton');
    }

    // --- Helper Functions ---
    function getRandomColor() {
        let color;
        // Generate a random color that is not too light (to contrast with white background)
        // and not too dark (to contrast with black text if cell becomes black)
        // Using HSL for better control over lightness
        const hue = Math.floor(Math.random() * 360);
        const saturation = Math.floor(Math.random() * 30) + 70; // 70-100% (vibrant)
        const lightness = Math.floor(Math.random() * 30) + 40; // 40-70% (mid-range lightness)

        // Convert HSL to RGB then to Hex (simplified for example, can be more robust)
        // For simplicity, let's stick to a slightly modified hex generator ensuring it's not white.
        do {
            const randomInt = Math.floor(Math.random() * (0xDDDDDD - 0x222222 + 1)) + 0x222222;
            color = '#' + randomInt.toString(16).padStart(6, '0');
        } while (color.toLowerCase() === '#ffffff'); // Ensure not pure white
        return color;
    }

    function generateColorsForRule(ruleLength) {
        colors = ['white']; // State 0 is always white for the grid background
        for (let i = 1; i < ruleLength; i++) {
            colors.push(getRandomColor());
        }
        NUM_COLORS = colors.length;
    }

    function validateRuleString(rule) {
        if (rule.length === 0) return false;
        for (let char of rule) {
            if (!ruleMap.hasOwnProperty(char)) return false;
        }
        return true;
    }

    // --- Core Simulation Setup ---
    function setupCanvasAndGrid() {
        if (!canvas) {
            console.error("Langton's Ant canvas not found during setup.");
            return false;
        }
        context = canvas.getContext('2d');
        GRID_WIDTH = Math.floor(window.innerWidth / CELL_SIZE);
        GRID_HEIGHT = Math.floor(window.innerHeight / CELL_SIZE);
        canvas.width = GRID_WIDTH * CELL_SIZE;
        canvas.height = GRID_HEIGHT * CELL_SIZE;

        grid = Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(0));

        let numAntsVal = parseInt(numAntsInput.value) || 1;
        numAntsVal = Math.max(1, numAntsVal);
        numAntsInput.value = numAntsVal;

        ants = [];
        for (let i = 0; i < numAntsVal; i++) {
            ants.push({
                x: Math.floor(Math.random() * GRID_WIDTH),
                y: Math.floor(Math.random() * GRID_HEIGHT),
                direction: Math.floor(Math.random() * 4)
            });
        }
        stepCount = 0;
        if(stepCountSpan) stepCountSpan.textContent = `Steps: ${stepCount}`;
        return true;
    }

    // --- Drawing ---
    function drawInitialGrid() {
        if (!context || colors.length === 0) return;
        context.fillStyle = colors[0]; // Should be 'white'
        context.fillRect(0, 0, canvas.width, canvas.height);
    }

    function drawCell(x, y, state) {
        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT || colors.length === 0 || !context) return;
        const colorIndex = state % NUM_COLORS;
        context.fillStyle = colors[colorIndex];
        context.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }

    // --- Ant Logic ---
    function updateSingleAnt(ant) {
        if (!grid || !grid[ant.y] || grid[ant.y][ant.x] === undefined) {
            console.error("Grid error in updateSingleAnt. Ant:", ant);
            stop();
            return null;
        }
        const currentState = grid[ant.y][ant.x];
        const nextState = (currentState + 1) % NUM_COLORS;
        const ruleChar = currentRuleString[currentState % currentRuleString.length];
        const turnFunction = ruleMap[ruleChar] || ((dir) => dir);

        ant.direction = turnFunction(ant.direction);
        grid[ant.y][ant.x] = nextState;

        const changedX = ant.x;
        const changedY = ant.y;

        ant.x = (ant.x + directions[ant.direction][0] + GRID_WIDTH) % GRID_WIDTH;
        ant.y = (ant.y + directions[ant.direction][1] + GRID_HEIGHT) % GRID_HEIGHT;
        return { changedX, changedY };
    }

    // --- Simulation Loop ---
    function gameLoop() {
        const cellsToRedraw = new Set();
        for (let ant of ants) {
            const result = updateSingleAnt(ant);
            if (result) {
                cellsToRedraw.add(`${result.changedX},${result.changedY}`);
            } else { return; }
        }
        cellsToRedraw.forEach(coords => {
            const [x, y] = coords.split(',').map(Number);
            if (grid[y] && grid[y][x] !== undefined) {
                 drawCell(x, y, grid[y][x]);
            }
        });
        stepCount += ants.length;
        if(stepCountSpan) stepCountSpan.textContent = `Steps: ${stepCount}`;
    }

    // --- Game Controls ---
    function stop() {
        if (simulationInterval) {
            clearInterval(simulationInterval);
            simulationInterval = null;
        }
        if (!isInitialized) return;
        startButton.disabled = false;
        stopButton.disabled = true;
        stepButton.disabled = false;
        ruleStringInput.disabled = false;
        numAntsInput.disabled = false;
        randomRuleButton.disabled = false; // Keep enabled
    }

    function start() {
        if (simulationInterval) return;
        if (!isInitialized) {
             console.warn("Langton's Ant: Attempted to start before initialization.");
             return;
        }

        if (!validateRuleString(currentRuleString)) {
            alert(`Invalid rule: "${currentRuleString}". Use R, L, U, N.`);
            stop(); return;
        }

        if (NUM_COLORS !== currentRuleString.length || colors.length !== currentRuleString.length || (colors.length > 0 && colors[0] !== 'white')) {
            generateColorsForRule(currentRuleString.length);
            if (!setupCanvasAndGrid()) { stop(); return; }
            drawInitialGrid();
        } else if (!grid || ants.length === 0) { // Ensure grid/ants are set up
            if (!setupCanvasAndGrid()) { stop(); return; }
            drawInitialGrid();
        }

        simulationInterval = setInterval(gameLoop, intervalDelay);
        startButton.disabled = true;
        stopButton.disabled = false;
        stepButton.disabled = true;
        ruleStringInput.disabled = true;
        numAntsInput.disabled = true;
        // randomRuleButton.disabled = true; // Keep enabled
    }

    function handleRandomRule() {
        if (!isInitialized) return; // Don't act if not initialized
        if (simulationInterval) stop();

        const ruleLength = Math.floor(Math.random() * (MAX_RULE_LENGTH - MIN_RULE_LENGTH + 1)) + MIN_RULE_LENGTH;
        let newRule = '';
        for (let i = 0; i < ruleLength; i++) {
            newRule += ruleChars[Math.floor(Math.random() * ruleChars.length)];
        }
        currentRuleString = newRule;
        ruleStringInput.value = currentRuleString;
        generateColorsForRule(currentRuleString.length);
        if (!setupCanvasAndGrid()) { stop(); return; }
        drawInitialGrid();
        start();
    }

    function handleStep() {
        if (simulationInterval) return;
        if (!isInitialized) return;

        if (!validateRuleString(currentRuleString)) {
            alert(`Invalid rule: "${currentRuleString}". Use R, L, U, N.`);
            return;
        }
        if (NUM_COLORS !== currentRuleString.length || colors.length !== currentRuleString.length || (colors.length > 0 && colors[0] !== 'white')) {
            generateColorsForRule(currentRuleString.length);
            if (!setupCanvasAndGrid()) { stop(); return; }
            drawInitialGrid();
        } else if (!grid || ants.length === 0) {
            if (!setupCanvasAndGrid()) { stop(); return; }
            drawInitialGrid();
        }
        gameLoop();
    }

    function handleResize() {
        if (!isInitialized) return;
        const wasRunning = !!simulationInterval;
        if (wasRunning) stop();
        if (setupCanvasAndGrid()) {
            drawInitialGrid();
            if (wasRunning) start();
        } else {
            console.error("Resize setup failed for Langton's Ant.");
        }
    }
    
    let eventListenersAdded = false; // Flag to add listeners only once

    function addEventListenersOnce() {
        if (eventListenersAdded) return;

        startButton.addEventListener('click', start);
        stopButton.addEventListener('click', stop);
        stepButton.addEventListener('click', handleStep);
        randomRuleButton.addEventListener('click', handleRandomRule);

        speedControl.addEventListener('input', (event) => {
            intervalDelay = 201 - parseInt(event.target.value);
            if (simulationInterval) { stop(); start(); }
        });
        ruleStringInput.addEventListener('input', (event) => {
            currentRuleString = event.target.value.toUpperCase();
        });
        numAntsInput.addEventListener('change', () => {
            const wasRunning = !!simulationInterval;
            if (wasRunning) stop();
            if (setupCanvasAndGrid()) {
                drawInitialGrid();
                if (wasRunning) start();
            }
        });
        // Add game-specific resize listener only when the game is active
        window.addEventListener('resize', handleResize);
        eventListenersAdded = true;
    }

    function removeGameEventListeners() {
        window.removeEventListener('resize', handleResize);
        // Potentially remove others if they cause issues, but usually not necessary for buttons within the game's div
        eventListenersAdded = false; // Allow them to be re-added if game is re-initialized
    }

    return {
        init: function() {
            if (!isInitialized) {
                cacheDomElements(); // Cache DOM elements first
                ruleStringInput.value = currentRuleString;
                numAntsInput.value = "50";
                generateColorsForRule(currentRuleString.length);
                if (!setupCanvasAndGrid()) {
                    console.error("Initial setup failed for Langton's Ant.");
                    return;
                }
                drawInitialGrid();
                addEventListenersOnce(); // Add listeners
                stopButton.disabled = true;
                isInitialized = true;
            } else {
                // If returning, ensure canvas is ready and resize/redraw
                 if (canvas && context) { // Check if canvas context exists
                    handleResize(); // This will setup grid and draw initial grid
                } else { // If canvas somehow got lost, re-initialize fully
                    isInitialized = false; // Force full re-init
                    this.init(); // Recursive call, be careful here, ensure it can exit
                    return;
                }
            }
            start(); // Auto-start or restart
        },
        cleanup: function() {
            stop();
            removeGameEventListeners(); // Clean up game-specific global listeners
            // isInitialized = false; // Optional: reset if you want a full fresh start next time
        },
        isGameInitialized: function() { return isInitialized; }
    };
})();


// --- Navigation Logic ---
function showMainMenu() {
    mainMenuContainer.style.display = 'flex';
    langtonsAntGameContainer.style.display = 'none';
    document.body.style.backgroundColor = '#f4f7f6'; // Ensure body bg matches menu theme
    if (LangtonsAntGame.isGameInitialized()) {
        LangtonsAntGame.cleanup();
    }
}

function showLangtonsAntGame() {
    mainMenuContainer.style.display = 'none';
    langtonsAntGameContainer.style.display = 'block';
    // The canvas itself has a white bg, body bg can remain the light theme color
    // document.body.style.backgroundColor = '#e8e8e8'; // Or a slightly different light tone for game area
    LangtonsAntGame.init();
}

// --- Initial Page Load ---
launchLangtonsAntButton.addEventListener('click', showLangtonsAntGame);
backToMenuButton.addEventListener('click', showMainMenu);

showMainMenu();