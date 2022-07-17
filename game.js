/** === Elements === */
const canvas = document.getElementById("game");
const ctx = canvas.getContext('2d');
const endTurnBtn = document.getElementById("end-turn-btn");
const playAgainBtn = document.getElementById("play-again-btn");
const playerMoveLeftSpan = document.getElementById("player-moves-left");
const rollingWrapper = document.getElementById("rolling-wrapper");
const gameOverDisplay = document.getElementById("game-over-wrapper");
const gameOverScore = document.getElementById("game-over-score");

/** === Misc Constants === */
const HEIGHT = 500;
const POINT_RADIUS = 4;
const MOVE_PER_SEC = 1;

/** === Sounds === */
const POP_SFX = new Audio('./sounds/pop.wav');
const UNDO_SFX = new Audio('./sounds/undo.wav');
setSoundVolume(0.75); //TODO remove? Atleast give option to change value

/**=== Game States === */
const ROLLING = 0;
const END_TURN = 1;
const PLAYER_MOVING = 2;
const GAME_OVER = 3;

/** === Dice Setup */
const THREE_DICE_DISPLAYS = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 1],
    [1, 1, 1],
]
const SIX_DICE_DISPLAYS = [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 1],
    [0, 1, 0, 1, 0, 1, 0],
    [1, 1, 0, 0, 0, 1, 1],
    [1, 1, 0, 1, 0, 1, 1],
    [1, 1, 1, 0, 1, 1, 1]
]
const SIX_CPU_DICE = { values: [], mask: SIX_DICE_DISPLAYS };
for (let i = 0; i < 7; i++) {
    SIX_CPU_DICE.values[i] = document.getElementById(`cpu-dd-${i + 1}`);
    SIX_CPU_DICE.values[i].setAttribute("style", `opacity: 0%`);
}
const THREE_CPU_DICE = { values: [], mask: THREE_DICE_DISPLAYS };
for (let i = 0; i < 3; i++) {
    THREE_CPU_DICE.values[i] = document.getElementById(`cpu-tdd-${i + 1}`);
    THREE_CPU_DICE.values[i].setAttribute("style", `opacity: 0%`);
}
const PLAYER_DICE = { values: [], mask: SIX_DICE_DISPLAYS };;
for (let i = 0; i < 7; i++) {
    PLAYER_DICE.values[i] = document.getElementById(`player-dd-${i + 1}`);
    PLAYER_DICE.values[i].setAttribute("style", `opacity: 0%`);
}

let currentPlayerDie = PLAYER_DICE;
let currentCPUDie = THREE_CPU_DICE;

/** Game variables */

let gamestate = ROLLING;
let lastRender = 0;

const points = [];
let heightPointY = 0;
let linePoints = [];
let playerPos = { x: 3, y: 2 };
let hoverPos = { x: -1, y: -1 };
let dragFrom = { x: -1, y: -1 };
let dragPos = { x: -1, y: -1 };
let playerMoves = 0;
let cpuMoves = 0;
let cpuHeight = -0.5;
let dotsOffset = 0;
let cpuHeightTarget = -0.5;
let dotsOffsetTarget = 0;

/** Event listeners */

endTurnBtn.onclick = event => {
    const newPlayerPos = linePoints[linePoints.length - 1];
    const yChange = playerPos.y - newPlayerPos.y;
    playerPos = newPlayerPos;
    linePoints = [playerPos];
    dragFrom = { x: -1, y: -1 };
    dragPos = { x: -1, y: -1 };
    cpuHeightTarget = cpuHeight + cpuMoves;
    dotsOffsetTarget = dotsOffset + yChange;
    for (let y = 0; y < -yChange; y++) {
        for (let x = 0; x < 7; x++) {
            points.push({ x, y: heightPointY + y });
        }
    }
    heightPointY += Math.max(0, -yChange);
    const len = points.length;
    for (let i = 0; i < len; i++) {
        const p = points.shift();
        if (p.y >= heightPointY - (10 - yChange)) {
            points.push(p);
        }
    }
    setGameState(END_TURN);
}

playAgainBtn.onclick = event => {
    initGame();
}

canvas.onclick = event => {
    if (gamestate !== PLAYER_MOVING)
        return;

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const dot = getClickedGridDot({ x, y });
    if (dot.x == -1 || dot.y == -1)
        return;
}

//canvas.ondrag = event => {
canvas.onmousemove = event => {
    if (gamestate !== PLAYER_MOVING)
        return;

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    dragPos = { x, y };

    hoverPos = getClickedGridDot({ x, y });
}

canvas.onmouseup = event => {
    if (gamestate !== PLAYER_MOVING)
        return;

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    endDot = getClickedGridDot({ x, y });

    const validDot = getValidEndPos(dragFrom).findIndex(p => p.x === endDot.x && p.y === endDot.y) !== -1;
    if (endDot.x !== -1 && dragFrom.x !== -1 && validDot) {
        linePoints.push({ x: endDot.x, y: endDot.y });
        POP_SFX.play();
    }
    dragFrom = { x: -1, y: -1 };
    dragPos = { x: -1, y: -1 };
}

//canvas.ondragstart = event => {
canvas.onmousedown = event => {
    if (gamestate !== PLAYER_MOVING)
        return;

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    dot = getClickedGridDot({ x, y });
    const movesLeft = playerMoves - (linePoints.length - 1);
    if (arePointsEqual(linePoints[linePoints.length - 1], dot)) {
        if (movesLeft > 0)
            dragFrom = dot;
    }
    else {
        let index = linePoints.findIndex(p => p.x === dot.x && p.y === dot.y);
        if (index != -1) {
            linePoints = linePoints.slice(0, index + 1);
            dragFrom = dot;
            UNDO_SFX.play();
        }
    }
}


/** Logic */

function loop(timestamp) {
    render();
    update((timestamp - lastRender) / 1000);
    lastRender = timestamp;
    window.requestAnimationFrame(loop);
}

function update(delta) {
    if (gamestate === END_TURN) {
        if (cpuHeight <= cpuHeightTarget) {
            cpuHeight = Math.min(cpuHeightTarget, cpuHeight + (MOVE_PER_SEC * delta));
        }

        if (dotsOffset >= dotsOffsetTarget) {
            dotsOffset = Math.max(dotsOffsetTarget, dotsOffset - (MOVE_PER_SEC * delta));
        }

        if (cpuHeight >= playerPos.y) {
            setGameState(GAME_OVER);
        }

        if (cpuHeight === cpuHeightTarget && dotsOffset === dotsOffsetTarget) {
            setGameState(ROLLING);
        }
    }
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const endPositions = getValidEndPos(dragFrom);

    for (let i = 0; i < points.length; i++) {
        const pos = points[i];

        const validEndPoint = endPositions.findIndex(p => p.x === pos.x && p.y === pos.y) !== -1 &&
            linePoints.findIndex(p => p.x === pos.x && p.y == pos.y) === -1;

        ctx.beginPath();
        const canvasCords = convertToCanvasCords(pos);
        const plEqual = arePointsEqual(pos, playerPos);
        ctx.fillStyle = validEndPoint ? "#00f" : plEqual ? "#0f0" : "#000";
        ctx.arc(canvasCords.x, canvasCords.y, POINT_RADIUS, 0, 2 * Math.PI, false);
        ctx.fill();

        ctx.beginPath();
        const equal = arePointsEqual(pos, hoverPos);
        ctx.strokeStyle = equal ? "#f00" : "#0000";
        ctx.lineWidth = 2;
        ctx.arc(canvasCords.x, canvasCords.y, POINT_RADIUS, 0, 2 * Math.PI, false);
        ctx.stroke();
    }

    if (dragFrom.x !== -1 && dragPos.x !== -1) {
        ctx.beginPath();
        ctx.strokeStyle = "#f00";
        ctx.lineWidth = 4;
        const canvasCords = convertToCanvasCords(dragFrom);
        ctx.moveTo(canvasCords.x, canvasCords.y);
        ctx.lineTo(dragPos.x, dragPos.y);
        ctx.stroke();
    }

    for (let i = 1; i < linePoints.length; i++) {
        const fp = linePoints[i - 1];
        const tp = linePoints[i];
        ctx.beginPath();
        ctx.strokeStyle = "#00f";
        ctx.lineWidth = 4;
        const from = convertToCanvasCords({ x: fp.x, y: fp.y });
        const to = convertToCanvasCords({ x: tp.x, y: tp.y });
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
    }

    const cpuCanvasPos = convertToCanvasCords({ x: 0, y: cpuHeight });
    ctx.beginPath();
    ctx.fillStyle = "#bf6321";
    ctx.fillRect(0, cpuCanvasPos.y, canvas.width, canvas.height - cpuCanvasPos.y);
    ctx.fill();

    playerMoveLeftSpan.innerHTML = playerMoves - (linePoints.length - 1);
}

function initGame() {
    while (points.length > 0)
        points.pop();

    linePoints = [];
    playerPos = { x: 3, y: 2 };
    cpuHeight = -0.5;
    dotsOffset = 0;
    cpuHeightTarget = -0.5;
    dotsOffsetTarget = 0;
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 7; x++) {
            points.push({ x, y });
        }
    }
    heightPointY = 9;
    linePoints.push(playerPos);
    setGameState(ROLLING);
}

function convertToCanvasCords(pos) {
    const y = pos.y + dotsOffset;
    return { x: 50 + (pos.x * 50), y: HEIGHT - (50 + (y * 50)) };
}

function getClickedGridDot(pos) {
    for (let i = 0; i < points.length; i++) {
        const canvasCords = convertToCanvasCords(points[i]);
        if (isPointWithinRange(pos, canvasCords.x, canvasCords.y, POINT_RADIUS + 10)) {
            return points[i];
        }
    }
    return { x: -1, y: -1 };
}

function isPointWithinRange(point, x, y, range) {
    return isPointWithin(point, x - range, x + range, y - range, y + range);
}

function isPointWithin(point, xMin, xMax, yMin, yMax) {
    return point.x >= xMin && point.x <= xMax && point.y >= yMin && point.y <= yMax;
}

function arePointsEqual(p1, p2) {
    return p1.x === p2.x && p1.y === p2.y;
}

function getValidEndPos(currPos) {
    const toReturn = [];

    if (currPos.x == -1 || currPos.y == -1)
        return toReturn;

    for (let y = -1; y < 2; y++) {
        for (let x = -1; x < 2; x++) {
            if (y !== 0 || x !== 0) {
                toReturn.push({ x: currPos.x - x, y: currPos.y - y });
            }
        }
    }
    return toReturn;
}

function rollDice() {
    let rolls = 0;
    let rollInterval = setInterval(() => {
        playerMoves = Math.floor((Math.random() * (currentPlayerDie.mask.length - 1)) + 1);
        cpuMoves = Math.floor((Math.random() * (currentCPUDie.mask.length - 1)) + 1);
        displayDiceNumber(currentPlayerDie, playerMoves);
        displayDiceNumber(currentCPUDie, cpuMoves);
        rolls++;
        if (rolls > 20) {
            clearInterval(rollInterval);
            setGameState(PLAYER_MOVING);
        }
    }, 100);
}

function displayDiceNumber(dice, num) {
    const dotVals = dice.mask[num];
    for (let i = 0; i < dice.values.length; i++) {
        dice.values[i].setAttribute("style", `opacity: ${dotVals[i] * 100}%`)
    }
}

function setSoundVolume(volume) {
    POP_SFX.volume = volume;
    UNDO_SFX.volume = volume;
}

function setGameState(nextState) {
    switch (gamestate) {
        case ROLLING:
            rollingWrapper.setAttribute("style", "display: none");
            break;
        case END_TURN:
            endTurnBtn.disabled = false;
            break;
        case PLAYER_MOVING:
            break;
        case GAME_OVER:
            gameOverDisplay.setAttribute("style", "display: none");
            break;
    }
    gamestate = nextState;
    switch (gamestate) {
        case ROLLING:
            rollingWrapper.setAttribute("style", "display: grid");
            rollDice();
            break;
        case END_TURN:
            endTurnBtn.disabled = true;
            break;
        case PLAYER_MOVING:
            break;
        case GAME_OVER:
            gameOverScore.innerHTML = playerPos.y;
            gameOverDisplay.setAttribute("style", "display: grid");
            break;
    }
}

initGame();
window.requestAnimationFrame(loop);