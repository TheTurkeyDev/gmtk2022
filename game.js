const canvas = document.getElementById("game");
const ctx = canvas.getContext('2d');
const endTurnBtn = document.getElementById("end-turn-btn");
const playerMoveLeftSpan = document.getElementById("player-moves-left");
const HEIGHT = 500;
const POINT_RADIUS = 4;

/**=== Game States === */
ROLLING = 0;
CPU_MOVING = 1;
PLAYER_MOVING = 2;

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

/** */

let gamestate = ROLLING;

const points = [];
let linePoints = [];
let playerPos = { x: 3, y: 0 };
let hoverPos = { x: -1, y: -1 };
let dragFrom = { x: -1, y: -1 };
let dragPos = { x: -1, y: -1 };
let playerMoves = 0;
let cpuMoves = 0;

endTurnBtn.onclick = event => {
    playerPos = linePoints[linePoints.length - 1];
    linePoints = [playerPos];
    dragFrom = { x: -1, y: -1 };
    dragPos = { x: -1, y: -1 };
    rollDice();
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

    playerMoveLeftSpan.innerHTML = playerMoves - (linePoints.length - 1);
}

function initGame() {
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 7; x++) {
            points.push({ x, y });
        }
    }
    linePoints.push(playerPos);
    rollDice();
}

function convertToCanvasCords(pos) {
    return { x: 50 + (pos.x * 50), y: HEIGHT - (50 + (pos.y * 50)) };
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
    gamestate = ROLLING;
    let rolls = 0;
    let rollInterval = setInterval(() => {
        playerMoves = Math.floor((Math.random() * (currentPlayerDie.mask.length - 1)) + 1);
        cpuMoves = Math.floor((Math.random() * (currentCPUDie.mask.length - 1)) + 1);
        displayDiceNumber(currentPlayerDie, playerMoves);
        displayDiceNumber(currentCPUDie, cpuMoves);
        rolls++;
        if (rolls > 20) {
            gamestate = PLAYER_MOVING;
            clearInterval(rollInterval);
        }
    }, 100);
}

function displayDiceNumber(dice, num) {
    const dotVals = dice.mask[num];
    for (let i = 0; i < dice.values.length; i++) {
        dice.values[i].setAttribute("style", `opacity: ${dotVals[i] * 100}%`)
    }
}

function loop(timestamp) {
    render();
    window.requestAnimationFrame(loop);
}

initGame();
window.requestAnimationFrame(loop);