/** === Elements === */
const canvas = document.getElementById("game");
const ctx = canvas.getContext('2d');
const settingsBtn = document.getElementById("settings");
const settingsCloseBtn = document.getElementById("settings-close-btn");
const endTurnBtn = document.getElementById("end-turn-btn");
const playAgainBtn = document.getElementById("play-again-btn");
const volumeSlider = document.getElementById("volume-slider");
const playerMoveLeftSpan = document.getElementById("player-moves-left");
const rollingWrapper = document.getElementById("rolling-wrapper");
const settingsDisplay = document.getElementById("settings-wrapper");
const gameOverDisplay = document.getElementById("game-over-wrapper");
const gameOverScore = document.getElementById("game-over-score");
const effects = document.getElementById("effects");
const cpuRollsWrapper = document.getElementById("cpu-rolls-wrapper");
const cpuRollsLeft = document.getElementById("cpu-rolls-left");
const cpuDistanceAway = document.getElementById("cpu-distance-away");
const cpuThreeDie = document.getElementById("cpu-three-die");
const cpuSixDie = document.getElementById("cpu-six-die");
const highscore = document.getElementById("high-score");

/** === Misc Constants === */
const HEIGHT = 500;
const POINT_RADIUS = 4;
const POWER_RADIUS = 8;
const MOVE_PER_SEC = 1;
const HIGH_SCORE_KEY = 'td_gmtk_high_score';
const NO_OF_HIGH_SCORES = 10;

/** === Sounds === */
const POP_SFX = new Audio('./sounds/pop.wav');
const UNDO_SFX = new Audio('./sounds/undo.wav');
setSoundVolume(0.75); //TODO remove? Atleast give option to change value

/**=== Game States === */
const ROLLING = 0;
const END_TURN = 1;
const PLAYER_MOVING = 2;
const GAME_OVER = 3;
const START = 4;

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

/** === Powers === */
const POWERS = [
    { id: "plus_1", disp: "+1 Moves", short: "+1", up: true },
    { id: "plus_2", disp: "+2 Moves", short: "+2", up: true },
    { id: "plus_3", disp: "+3 Moves", short: "+3", up: true },
    { id: "all_6", disp: "All 6's", short: "6's", up: true },
    { id: "all_5", disp: "All 5's", short: "5's", up: true },
    { id: "all_4", disp: "All 4's", short: "4's", up: true },
    { id: "only_even", disp: "Even's", short: "E", up: true },
    { id: "minus_1", disp: "-1 Moves", short: "-1", up: false },
    { id: "minus_2", disp: "-2 Moves", short: "-2", up: false },
    { id: "minus_3", disp: "-3 Moves", short: "-3", up: false },
    { id: "all_2", disp: "All 2's", short: "2's", up: false },
    { id: "all_1", disp: "All 1's", short: "1's", up: false }
];

/** === Game variables === */

let gamestate = START;
let lastRender = 0;

let rollsTill6 = 7;

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

let currentPowers = [];
let boardPowers = [];

/** Event listeners */

settingsBtn.onclick = event => {
    settingsDisplay.setAttribute("style", "display: grid");
}

settingsCloseBtn.onclick = event => {
    settingsDisplay.setAttribute("style", "display: none");
}

volumeSlider.onchange = event => {
    console.log(event.target);
    setSoundVolume(parseFloat(event.target.value));
}

endTurnBtn.onclick = event => {
    setGameState(END_TURN);

    linePoints.forEach(p => {
        const index = boardPowers.findIndex(bp => p.x === bp.x && p.y === bp.y);
        if (index !== -1) {
            givePower(boardPowers[index].power);
            boardPowers.splice(index, 1);
        }
    });

    const newPlayerPos = linePoints[linePoints.length - 1];
    const yChange = playerPos.y - newPlayerPos.y;
    playerPos = newPlayerPos;

    linePoints = [playerPos];
    dragFrom = { x: -1, y: -1 };
    dragPos = { x: -1, y: -1 };
    cpuHeightTarget = cpuHeight + cpuMoves;
    dotsOffsetTarget = dotsOffset + yChange;

    const distApart = playerPos.y - cpuHeightTarget;
    cpuDistanceAway.innerHTML = Math.ceil(distApart);

    const powerUps = POWERS.filter(p => p.up);
    const powerDowns = POWERS.filter(p => !p.up);

    for (let y = 0; y < -yChange; y++) {
        const maxGood = Math.max((-distApart / 5) + 3, 0);
        const numGood = Math.floor(Math.random() * maxGood);
        const maxBad = Math.min((distApart / 5) + 1, 7);
        const numBad = Math.floor(Math.random() * maxBad);
        const addedPoints = [];

        const missingPointChance = (distApart * distApart) / 400;
        const missingX = Math.random() >= 0.5 ? playerPos.x : Math.floor(Math.random() * 7);
        for (let x = 0; x < 7; x++) {
            if (missingX == x && Math.random() < missingPointChance)
                continue;
            points.push({ x, y: heightPointY + y });
            addedPoints.push({ x, y: heightPointY + y });
        }

        for (let i = 0; i < numGood; i++) {
            const p = addedPoints[Math.floor(Math.random() * addedPoints.length)];
            const power = powerUps[Math.floor(Math.random() * powerUps.length)];
            boardPowers.push({ x: p.x, y: p.y, power: power });
        }

        for (let i = 0; i < numBad; i++) {
            const p = addedPoints[Math.floor(Math.random() * addedPoints.length)];
            const power = powerDowns[Math.floor(Math.random() * powerDowns.length)];
            boardPowers.push({ x: p.x, y: p.y, power: power });
        }
    }
    heightPointY += Math.max(0, -yChange);


    const len = points.length;
    for (let i = 0; i < len; i++) {
        const p = points.shift();
        if (p.y >= heightPointY - (10 - yChange)) {
            points.push(p);
        }
        else {
            const index = boardPowers.findIndex(bp => bp.x === p.x && bp.y == p.y);
            if (index !== -1)
                boardPowers.splice(index, 1);
        }
    }
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

        const powerAt = boardPowers.find(p => p.x === pos.x && p.y === pos.y);

        if (!!powerAt) {
            ctx.beginPath();
            const canvasCords = convertToCanvasCords(pos);
            ctx.fillStyle = powerAt.power.up ? "#0f0" : "#f00";
            ctx.arc(canvasCords.x, canvasCords.y, POWER_RADIUS, 0, 2 * Math.PI, false);
            ctx.fill();

            ctx.beginPath();
            ctx.fillStyle = powerAt.power.up ? "#000" : "#fff";
            ctx.textAlign = "center";
            ctx.textBaseline = "center";
            ctx.fillText(powerAt.power.short, canvasCords.x, canvasCords.y + (POWER_RADIUS / 2));
            ctx.fill();

            ctx.beginPath();
            const equal = arePointsEqual(pos, hoverPos);
            ctx.strokeStyle = equal ? "#f00" : validEndPoint ? "#00f" : "#0000";
            ctx.lineWidth = 2;
            ctx.arc(canvasCords.x, canvasCords.y, POWER_RADIUS, 0, 2 * Math.PI, false);
            ctx.stroke();
        }
        else if (arePointsEqual(pos, playerPos)) {
            const canvasCords = convertToCanvasCords(pos);
            drawStar(canvasCords.x, canvasCords.y, 5, POINT_RADIUS + 10, POINT_RADIUS + 3, arePointsEqual(pos, hoverPos));
        }
        else {
            ctx.beginPath();
            const canvasCords = convertToCanvasCords(pos);
            ctx.fillStyle = validEndPoint ? "#00f" : "#000";
            ctx.arc(canvasCords.x, canvasCords.y, POINT_RADIUS, 0, 2 * Math.PI, false);
            ctx.fill();

            ctx.beginPath();
            const equal = arePointsEqual(pos, hoverPos);
            ctx.strokeStyle = equal ? "#f00" : "#0000";
            ctx.lineWidth = 2;
            ctx.arc(canvasCords.x, canvasCords.y, POINT_RADIUS, 0, 2 * Math.PI, false);
            ctx.stroke();
        }
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

function drawStar(cx, cy, spikes, outerRadius, innerRadius, outline) {
    var rot = Math.PI / 2 * 3;
    var x = cx;
    var y = cy;
    var step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius)
    for (i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y)
        rot += step

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y)
        rot += step
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = outline ? '#f00' : "#0000";
    ctx.stroke();
    ctx.fillStyle = 'green';
    ctx.fill();
}

function initGame() {
    while (points.length > 0)
        points.pop();

    linePoints = [];
    currentPowers = [];
    boardPowers = [];
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
    rollsTill6 = 7;
    linePoints.push(playerPos);
    cpuRollsWrapper.setAttribute("style", "opacity: 100%");
    cpuThreeDie.setAttribute("style", "display: grid");
    cpuSixDie.setAttribute("style", "display: none");
    cpuDistanceAway.innerHTML = 3;
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

    toReturn.push({ x: currPos.x - 1, y: currPos.y });
    toReturn.push({ x: currPos.x + 1, y: currPos.y });
    toReturn.push({ x: currPos.x, y: currPos.y - 1 });
    toReturn.push({ x: currPos.x, y: currPos.y + 1 });
    return toReturn;
}

function rollDice() {
    let rolls = 0;

    const playerValues = [];
    let adj = 0;
    for (let i = 0; i < currentPowers.length; i++) {
        const id = currentPowers[i].id;
        if (id.startsWith("all_")) {
            playerValues.push(parseInt(id.substring(id.length - 1)));
        }
        if (id === "only_even") {
            playerValues.push(2);
            playerValues.push(4);
            playerValues.push(6);
        }
        if (id.startsWith("minus_")) {
            adj -= parseInt(id.substring(id.length - 1));
        }
        if (id.startsWith("plus_")) {
            adj += parseInt(id.substring(id.length - 1));
        }
    }

    if (playerValues.length === 0) {
        for (let i = 1; i < 7; i++)
            playerValues.push(i);
    }

    let rollInterval = setInterval(() => {
        playerMoves = playerValues[Math.floor(Math.random() * playerValues.length)];
        cpuMoves = Math.floor((Math.random() * (currentCPUDie.mask.length - 1)) + 1);
        displayDiceNumber(currentPlayerDie, playerMoves);
        displayDiceNumber(currentCPUDie, cpuMoves);
        rolls++;
        if (rolls === 20) {
            playerMoves = Math.max(0, playerMoves + adj);
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
            rollsTill6 = Math.max(0, rollsTill6 - 1);
            cpuRollsLeft.innerHTML = rollsTill6;
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
            if (rollsTill6 == 0) {
                cpuRollsWrapper.setAttribute("style", "opacity: 0");
                currentCPUDie = SIX_CPU_DICE;
                cpuThreeDie.setAttribute("style", "display: none");
                cpuSixDie.setAttribute("style", "display: grid");
            }
            rollingWrapper.setAttribute("style", "display: grid");
            rollDice();
            break;
        case END_TURN:
            clearPowers();
            endTurnBtn.disabled = true;
            break;
        case PLAYER_MOVING:
            break;
        case GAME_OVER:
            gameOverScore.innerHTML = playerPos.y;
            checkHighScore(playerPos.y);
            gameOverDisplay.setAttribute("style", "display: grid");
            highscore.innerHTML = getHighScore();
            break;
    }
}

function givePower(power) {
    currentPowers.push(power);
    effects.innerHTML = `
        <h2 style="margin:0;"><u>Effects</u></h2>
        ${currentPowers.map(e => `<span class="power-${e.up ? 'up' : 'down'}">${e.disp}</span>`).join("")}
    `;
}

function clearPowers() {
    currentPowers = [];
    effects.innerHTML = '<h2 style="margin:0;"><u>Effects</u></h2>';
}

function checkHighScore(score) {
    const highScores = JSON.parse(localStorage.getItem(HIGH_SCORE_KEY)) ?? [];
    const lowestScore = highScores[NO_OF_HIGH_SCORES - 1] ?? 0;

    if (score > lowestScore)
        saveHighScore(score, highScores);
}

function saveHighScore(score, highScores) {
    highScores.push(score);
    highScores.sort((a, b) => b.score - a.score);
    highScores.splice(NO_OF_HIGH_SCORES);
    localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(highScores));
};

function getHighScore() {
    return (JSON.parse(localStorage.getItem(HIGH_SCORE_KEY)) ?? [0])[0];
}

initGame();
window.requestAnimationFrame(loop);