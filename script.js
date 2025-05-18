// --- Configuration ---
const CELL_SIZE = 5;     // Size of each cell in pixels (smaller for more cells, potentially slower drawing)
// We'll calculate GRID_WIDTH and GRID_HEIGHT based on window size and CELL_SIZE

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
// L = Turn Left (current_direction - 1 + 4) % 4
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
let simulationInterval = null; // To manage the animation loop (using setInterval)
let intervalDelay = 50; // Milliseconds delay between steps (used with setInterval)
let GRID_WIDTH;
let GRID_HEIGHT;
let stepCount = 0;

// --- Get DOM Elements ---
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const stepButton = document.getElementById('stepButton');
const speedControl = document.getElementById('speedControl');
const stepCountSpan = document.getElementById('stepCount');

// --- Setup Canvas and Grid ---
function setupCanvasAndGrid() {
    canvas = document.getElementById('antCanvas');
    context = canvas.getContext('2d');

    // Calculate grid dimensions based on current window size and cell size
    GRID_WIDTH = Math.floor(window.innerWidth / CELL_SIZE);
    GRID_HEIGHT = Math.floor(window.innerHeight / CELL_SIZE);

    // Set canvas dimensions to match the window size
    canvas.width = GRID_WIDTH * CELL_SIZE; // Use calculated grid size * cell size
    canvas.height = GRID_HEIGHT * CELL_SIZE;

    console.log(`Grid Size: ${GRID_WIDTH}x${GRID_HEIGHT}, Cell Size: ${CELL_SIZE}px`);

    // Initialize grid to all white cells
    grid = Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(WHITE));

    // Re-center ant if already initialized, or place at center
    if (ant) {
        ant.x = Math.floor(GRID_WIDTH / 2);
        ant.y = Math.floor(GRID_HEIGHT / 2);
    } else {
         ant = {
            x: Math.floor(GRID_WIDTH / 2),
            y: Math.floor(GRID_HEIGHT / 2),
            direction: DIRECTION_UP // Start facing up
        };
    }

    // Reset step count on resize/re-init
    stepCount = 0;
    stepCountSpan.textContent = `Steps: ${stepCount}`;
}


// --- Drawing ---
function drawGrid() {
     // Draw the initial state by filling the entire grid area
    // We can just draw the canvas background color if all cells are white
    // Or iterate and draw if you might have pre-filled cells
     context.fillStyle = 'white'; // Assuming WHITE is the default state
     context.fillRect(0, 0, canvas.width, canvas.height);

     // If you had non-white initial states, you'd iterate here:
     /*
     for (let y = 0; y < GRID_HEIGHT; y++) {
         for (let x = 0; x < GRID_WIDTH; x++) {
             if (grid[y][x] !== WHITE) {
                 drawCell(x, y, grid[y][x]);
             }
         }
     }
     */

    // Draw the initial ant position if you wanted it highlighted from the start
    // (though we don't visually distinguish the ant's current position in this version, only the cell state)
}

function drawCell(x, y, state) {
    // Ensure coordinates are within bounds (wrapping already handled in updateAnt, but good practice)
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
        console.warn("Attempted to draw outside grid bounds:", x, y);
        return;
    }
    context.fillStyle = state === WHITE ? 'white' : 'black';
    context.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
}


// --- Ant Logic (One Step) ---
function updateAnt() {
    // 1. Get the color/state of the current cell
    const currentState = grid[ant.y][ant.x];

    // 2. Determine next state and direction based on rules
    const nextDirection = rules[currentState](ant.direction);
    const nextState = currentState === WHITE ? BLACK : WHITE; // Flip the color

    // 3. Update the cell color *before* moving the ant
    grid[ant.y][ant.x] = nextState;

    // Store the cell coordinates that just changed
    const changedX = ant.x;
    const changedY = ant.y;

    // 4. Update ant's direction
    ant.direction = nextDirection;

    // 5. Move the ant forward
    ant.x += directions[ant.direction][0];
    ant.y += directions[ant.direction][1];

    // 6. Handle wrapping around the edges
    ant.x = (ant.x + GRID_WIDTH) % GRID_WIDTH;
    ant.y = (ant.y + GRID_HEIGHT) % GRID_HEIGHT;
    // Handle negative results from modulo (though with + GRID_WIDTH/HEIGHT it shouldn't happen)
    if (ant.x < 0) ant.x += GRID_WIDTH;
    if (ant.y < 0) ant.y += GRID_HEIGHT;


    // 7. Increment step count
    stepCount++;
    stepCountSpan.textContent = `Steps: ${stepCount}`;

    // Return the coordinates of the cell that was just updated
    return { changedX, changedY };
}

// --- Simulation Loop ---
function gameLoop() {
    // Update the ant state and get the coordinates of the cell that flipped
    const { changedX, changedY } = updateAnt();

    // Only redraw the single cell that changed state
    drawCell(changedX, changedY, grid[changedY][changedX]);

    // Note: We don't redraw the *new* ant position specifically.
    // The cell it moves *from* is drawn with its new color.
    // The cell it moves *to* will be drawn with its new color in a future step
    // when the ant leaves *that* cell.
}

function startGame() {
    if (!simulationInterval) { // Prevent multiple intervals
        simulationInterval = setInterval(gameLoop, intervalDelay);
        startButton.disabled = true;
        stopButton.disabled = false;
        stepButton.disabled = true;
        speedControl.disabled = false;
    }
}

function stopGame() {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
        startButton.disabled = false;
        stopButton.disabled = true;
        stepButton.disabled = false;
        speedControl.disabled = false;
    }
}

function stepGame() {
    if (!simulationInterval) { // Only step if not running
        gameLoop(); // Perform one step (updates state, redraws the changed cell)
    }
}

// --- Handle Window Resize ---
function handleResize() {
    // Stop the current game if running
    stopGame();

    // Re-setup canvas and grid based on new window size
    setupCanvasAndGrid();

    // Redraw the *entire* grid state on the resized canvas
    // Since the grid is cleared/reinitialized, we need a full redraw
    drawGrid();
}

// --- Event Listeners for Controls ---
startButton.addEventListener('click', startGame);
stopButton.addEventListener('click', stopGame);
stepButton.addEventListener('click', stepGame);

speedControl.addEventListener('input', (event) => {
    // Slider value 1-200. Map to delay 200ms (slow) down to 1ms (fast)
    intervalDelay = 201 - parseInt(event.target.value);
    // console.log("Speed (delay):", intervalDelay);

    // If simulation is running, restart the interval with the new delay
    if (simulationInterval) {
        stopGame(); // Stop current
        startGame(); // Start with new delay
    }
});

// --- Initial Setup ---
// Setup canvas and grid size based on initial window size
setupCanvasAndGrid();
// Draw the initial blank grid
drawGrid();

// Add resize event listener
window.addEventListener('resize', handleResize);

// Initial button states
stopButton.disabled = true;
startButton.disabled = false;
stepButton.disabled = false;