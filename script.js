// --- Configuration ---
const GRID_WIDTH = 80;   // Number of cells wide
const GRID_HEIGHT = 80;  // Number of cells high
const CELL_SIZE = 8;     // Size of each cell in pixels

const WHITE = 0;         // State 0: Represents a 'white' cell
const BLACK = 1;         // State 1: Represents a 'black' cell

const DIRECTION_UP = 0;
const DIRECTION_RIGHT = 1;
const DIRECTION_DOWN = 2;
const DIRECTION_LEFT = 3;

// Directions represented as [dx, dy]
const directions = [
    [0, -1], // UP
    [1, 0],  // RIGHT
    [0, 1],  // DOWN
    [-1, 0]  // LEFT
];

// Rules: [Next Direction if WHITE, Next Direction if BLACK]
// R = Turn Right (current_direction + 1) % 4
// L = Turn Left (current_direction - 1 + 4) % 4 (add 4 to handle negative results)
// The basic RL rule: R on white, L on black
const rules = {
    [WHITE]: (currentDirection) => (currentDirection + 1) % 4, // Turn Right
    [BLACK]: (currentDirection) => (currentDirection - 1 + 4) % 4  // Turn Left
};

// --- State Variables ---
let canvas;
let context;
let grid; // 2D array representing the grid state (WHITE or BLACK)
let ant;  // Object { x, y, direction }
let animationFrameId = null; // To manage the animation loop (using requestAnimationFrame or setInterval)
let intervalDelay = 50; // Milliseconds delay between steps (used with setInterval)
let stepCount = 0;

// --- Get DOM Elements ---
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const stepButton = document.getElementById('stepButton');
const speedControl = document.getElementById('speedControl');
const stepCountSpan = document.getElementById('stepCount');

// --- Initialization ---
function init() {
    canvas = document.getElementById('antCanvas');
    context = canvas.getContext('2d');

    // Set canvas dimensions based on grid and cell size
    canvas.width = GRID_WIDTH * CELL_SIZE;
    canvas.height = GRID_HEIGHT * CELL_SIZE;

    // Initialize grid to all white cells
    grid = Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(WHITE));

    // Initialize ant position and direction
    ant = {
        x: Math.floor(GRID_WIDTH / 2),
        y: Math.floor(GRID_HEIGHT / 2),
        direction: DIRECTION_UP // Start facing up
    };

    stepCount = 0;
    stepCountSpan.textContent = `Steps: ${stepCount}`;

    // Draw the initial state
    drawGrid();
}

// --- Drawing ---
function drawGrid() {
    // Clear the canvas (or just redraw everything)
    // context.clearRect(0, 0, canvas.width, canvas.height); // Optional, fillRect below does this

    for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
            drawCell(x, y, grid[y][x]);
        }
    }
    // Optionally draw the ant cell specifically if you want it highlighted
    // drawCell(ant.x, ant.y, grid[ant.y][ant.x] === WHITE ? 'red' : 'blue'); // Example: highlight ant position
}

function drawCell(x, y, state) {
    context.fillStyle = state === WHITE ? 'white' : 'black';
    context.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    // Optional: draw cell borders
    // context.strokeStyle = '#eee';
    // context.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
}


// --- Ant Logic (One Step) ---
function updateAnt() {
    // 1. Get the color of the current cell
    const currentState = grid[ant.y][ant.x];

    // 2. Apply the rules
    const nextDirection = rules[currentState](ant.direction);
    const nextState = currentState === WHITE ? BLACK : WHITE; // Flip the color

    // 3. Update the cell color
    grid[ant.y][ant.x] = nextState;

    // 4. Update ant's direction
    ant.direction = nextDirection;

    // 5. Move the ant forward
    ant.x += directions[ant.direction][0];
    ant.y += directions[ant.direction][1];

    // 6. Handle wrapping around the edges
    ant.x = (ant.x + GRID_WIDTH) % GRID_WIDTH;
    ant.y = (ant.y + GRID_HEIGHT) % GRID_HEIGHT;

    // 7. Increment step count
    stepCount++;
    stepCountSpan.textContent = `Steps: ${stepCount}`;
}

// --- Simulation Loop ---

// We'll use setInterval for a fixed step rate, which is simpler for simulations
// requestAnimationFrame is better for smooth animation, but setInterval is fine here.
let simulationInterval = null;

function gameLoop() {
    updateAnt(); // Perform one simulation step
    drawGrid();  // Redraw the entire grid
}

function startGame() {
    if (!simulationInterval) { // Prevent multiple intervals
        simulationInterval = setInterval(gameLoop, intervalDelay);
        startButton.disabled = true;
        stopButton.disabled = false;
        stepButton.disabled = true; // Disable step while running
        speedControl.disabled = false;
    }
}

function stopGame() {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
        startButton.disabled = false;
        stopButton.disabled = true;
        stepButton.disabled = false; // Enable step while stopped
        speedControl.disabled = false;
    }
}

function stepGame() {
    if (!simulationInterval) { // Only step if not running
        gameLoop(); // Perform one step
        drawGrid(); // Redraw
    }
}

// --- Event Listeners for Controls ---
startButton.addEventListener('click', startGame);
stopButton.addEventListener('click', stopGame);
stepButton.addEventListener('click', stepGame);

speedControl.addEventListener('input', (event) => {
    // Speed control adjusts the delay between steps
    // Slider value is 1-200. Map this to a delay.
    // High slider value (200) = low delay (fast)
    // Low slider value (1) = high delay (slow)
    // Example mapping: delay = max_delay - (slider_value - 1) * step_size
    // Let's make 1 -> 200ms, 200 -> 1ms
    intervalDelay = 201 - parseInt(event.target.value); // Inverse mapping
    console.log("Speed (delay):", intervalDelay);

    // If simulation is running, restart the interval with the new delay
    if (simulationInterval) {
        stopGame(); // Stop the current interval
        startGame(); // Start a new one with the updated delay
    }
});

// --- Initial Setup Call ---
init();
// Start the game automatically on load (optional)
// startGame();
stopButton.disabled = true; // Stop button is initially disabled