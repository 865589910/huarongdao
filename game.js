// LeanCloud 配置（已配置）
const LEANCLOUD_CONFIG = {
    appId: '1fPW81l4sgVV2jRH0T16xfLS-gzGzoHsz',
    appKey: '95nCtrSM1gOtIX1jMjIzm9Jc',
    serverURL: 'https://1fpw81l4.lc-cn-n1-shared.com'
};

// 初始化 LeanCloud
if (typeof AV !== 'undefined') {
    AV.init(LEANCLOUD_CONFIG);
}

// 班级配置
const CLASS_CONFIG = {
    1: { name: '一班', icon: '🐼', color: '#667eea' },
    2: { name: '二班', icon: '🐻', color: '#764ba2' },
    3: { name: '三班', icon: '🐱', color: '#f093fb' },
    4: { name: '四班', icon: '🐶', color: '#4facfe' },
    5: { name: '五班', icon: '🐰', color: '#43e97b' },
    6: { name: '六班', icon: '🦊', color: '#fa709a' }
};

// 当前选择的班级
let currentClass = null;

// 游戏状态管理
const gameState = {
    currentLevel: 0,
    startTime: 0,
    endTime: 0,
    timer: null,
    timeLimit: 600, // 10分钟 = 600秒
    remaining: 600,
    moves: 0,
    hasPlayed: false,
    uiUpdateTimer: null, // UI更新定时器
    lastUpdateTime: 0, // 上次更新时间
    isPracticeMode: false // 是否为练习模式
};

// 练习模式关卡配置（无限随机）
const practiceLevelSizes = [3, 3, 4, 4, 5, 5]; // 3个关卡：3x3, 4x4, 5x5 各两个
const levelConfig = [
    { size: 3, seed: 12345 },  // 3×3 - 第1关
    { size: 3, seed: 23456 },  // 3×3 - 第2关
    { size: 3, seed: 67890 },  // 3×3 - 第3关
    { size: 4, seed: 34567 },  // 4×4 - 第4关
    { size: 4, seed: 45678 },  // 4×4 - 第5关
    { size: 4, seed: 89012 },  // 4×4 - 第6关
    { size: 5, seed: 56789 },  // 5×5 - 第7关
    { size: 5, seed: 11111 }   // 5×5 - 第8关
];

// 当前拼图状态
let currentPuzzle = {
    size: 0,
    grid: [],
    emptyPos: { row: 0, col: 0 }
};

// 随机数生成器（使用种子）
class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }
    
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
}

// 初始化游戏
function initGame() {
    // 添加班级选择按钮事件
    const classButtons = document.querySelectorAll('.class-btn');
    classButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const classId = btn.getAttribute('data-class');
            selectClass(classId);
        });
    });
    
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('practice-btn').addEventListener('click', startPracticeMode);
    document.getElementById('view-leaderboard-btn').addEventListener('click', showLeaderboard);
    document.getElementById('back-to-welcome').addEventListener('click', backToWelcome);
    document.getElementById('back-to-class').addEventListener('click', backToClassSelect);
    document.getElementById('submit-score-btn').addEventListener('click', submitScore);
}

// 选择班级
function selectClass(classId) {
    currentClass = classId;
    const classInfo = CLASS_CONFIG[classId];
    
    // 检查是否已经玩过
    const hasPlayed = localStorage.getItem(`huarongdao_class${classId}_played`);
    
    // 更新欢迎界面的班级徽章（只显示班级名称，不显示图标）
    const classBadge = document.getElementById('class-badge');
    if (classBadge) {
        classBadge.textContent = classInfo.name;
    }
    
    // 如果已经玩过，禁用开始挑战按钮
    const startBtn = document.getElementById('start-btn');
    if (hasPlayed) {
        startBtn.disabled = true;
        startBtn.textContent = '已参加过挑战 ❌';
        startBtn.style.opacity = '0.5';
        startBtn.style.cursor = 'not-allowed';
    } else {
        startBtn.disabled = false;
        startBtn.textContent = '开始挑战 🚀';
        startBtn.style.opacity = '1';
        startBtn.style.cursor = 'pointer';
    }
    
    // 切换到欢迎界面
    switchScreen('class-select-screen', 'welcome-screen');
}

// 开始游戏
function startGame() {
    // 检查是否已经玩过
    if (localStorage.getItem(`huarongdao_class${currentClass}_played`)) {
        alert('你已经参加过正式挑战了！每个人只能参加一次。\n\n你可以点击“练习模式”继续练习哦！');
        return;
    }
    
    gameState.isPracticeMode = false;
    switchScreen('welcome-screen', 'game-screen');
    gameState.currentLevel = 0;
    gameState.startTime = Date.now();
    gameState.remaining = gameState.timeLimit;
    
    // 启动倒计时
    startTimer();
    
    // 启动UI更新定时器
    startUIUpdateTimer();
    
    startLevel();
}

// 开始练习模式
function startPracticeMode() {
    gameState.isPracticeMode = true;
    switchScreen('welcome-screen', 'game-screen');
    gameState.currentLevel = 0;
    gameState.startTime = Date.now();
    gameState.remaining = 999999; // 练习模式不限时
    
    // 不启动倒计时，只启动UI更新
    startUIUpdateTimer();
    
    startLevel();
}

// 启动倒计时
function startTimer() {
    if (gameState.timer) {
        clearInterval(gameState.timer);
    }
    
    gameState.timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
        gameState.remaining = gameState.timeLimit - elapsed;
        
        if (gameState.remaining <= 0) {
            gameState.remaining = 0;
            clearInterval(gameState.timer);
            clearInterval(gameState.uiUpdateTimer);
            timeUp();
        }
    }, 100);
}

// 时间到
function timeUp() {
    alert('时间到！很遗憾，你没有在10分钟内完成所有关卡，无法上榜。');
    switchScreen('game-screen', 'class-select-screen');
}

// 启动UI更新定时器
function startUIUpdateTimer() {
    // 清除旧的定时器
    if (gameState.uiUpdateTimer) {
        clearInterval(gameState.uiUpdateTimer);
    }
    // 立即更新一次
    updateUI();
    // 降低更新频率到500ms，减少手机端卡顿
    gameState.uiUpdateTimer = setInterval(() => {
        updateUI();
    }, 500);
}

// 开始关卡
function startLevel() {
    gameState.moves = 0;
    updateUI();
    
    let config;
    if (gameState.isPracticeMode) {
        // 练习模式：使用随机种子
        const size = practiceLevelSizes[gameState.currentLevel % practiceLevelSizes.length];
        const randomSeed = Date.now() + gameState.currentLevel;
        config = { size: size, seed: randomSeed };
    } else {
        // 正式模式：使用固定种子
        config = levelConfig[gameState.currentLevel];
    }
    
    generatePuzzle(config.size, config.seed);
    renderPuzzle();
}

// 生成拼图
function generatePuzzle(size, seed) {
    currentPuzzle.size = size;
    const rng = new SeededRandom(seed);
    
    // 创建已排序的数组
    const numbers = [];
    for (let i = 1; i < size * size; i++) {
        numbers.push(i);
    }
    numbers.push(0); // 0代表空格
    
    // 创建二维数组
    currentPuzzle.grid = [];
    for (let i = 0; i < size; i++) {
        currentPuzzle.grid[i] = [];
        for (let j = 0; j < size; j++) {
            currentPuzzle.grid[i][j] = numbers[i * size + j];
            if (numbers[i * size + j] === 0) {
                currentPuzzle.emptyPos = { row: i, col: j };
            }
        }
    }
    
    // 通过随机移动打乱（确保可解）
    const moves = size === 3 ? 100 : size === 4 ? 150 : size === 5 ? 200 : 250;
    const directions = ['up', 'down', 'left', 'right'];
    
    for (let i = 0; i < moves; i++) {
        const validMoves = getValidMoves();
        if (validMoves.length > 0) {
            const randomMove = validMoves[Math.floor(rng.next() * validMoves.length)];
            performMove(randomMove, false);
        }
    }
    
    // 验证没有完整的行或列
    let attempts = 0;
    while (hasCompleteRowOrColumn() && attempts < 10) {
        // 额外打乱
        for (let i = 0; i < 50; i++) {
            const validMoves = getValidMoves();
            if (validMoves.length > 0) {
                const randomMove = validMoves[Math.floor(rng.next() * validMoves.length)];
                performMove(randomMove, false);
            }
        }
        attempts++;
    }
}

// 检查是否有完整的行或列按顺序排列
function hasCompleteRowOrColumn() {
    const size = currentPuzzle.size;
    
    // 检查每一行
    for (let row = 0; row < size; row++) {
        let isComplete = true;
        for (let col = 0; col < size; col++) {
            const expectedValue = row * size + col + 1;
            if (col === size - 1 && row === size - 1) {
                // 最后一格应该是空格
                if (currentPuzzle.grid[row][col] !== 0) {
                    isComplete = false;
                    break;
                }
            } else {
                if (currentPuzzle.grid[row][col] !== expectedValue) {
                    isComplete = false;
                    break;
                }
            }
        }
        if (isComplete) return true;
    }
    
    // 检查每一列
    for (let col = 0; col < size; col++) {
        let isComplete = true;
        for (let row = 0; row < size; row++) {
            const expectedValue = row * size + col + 1;
            if (col === size - 1 && row === size - 1) {
                if (currentPuzzle.grid[row][col] !== 0) {
                    isComplete = false;
                    break;
                }
            } else {
                if (currentPuzzle.grid[row][col] !== expectedValue) {
                    isComplete = false;
                    break;
                }
            }
        }
        if (isComplete) return true;
    }
    
    return false;
}

// 获取有效的移动方向
function getValidMoves() {
    const moves = [];
    const { row, col } = currentPuzzle.emptyPos;
    const size = currentPuzzle.size;
    
    if (row > 0) moves.push('up');
    if (row < size - 1) moves.push('down');
    if (col > 0) moves.push('left');
    if (col < size - 1) moves.push('right');
    
    return moves;
}

// 执行移动（内部使用，不计入步数）
function performMove(direction, countMove = true) {
    const { row, col } = currentPuzzle.emptyPos;
    let newRow = row, newCol = col;
    
    switch (direction) {
        case 'up':
            newRow = row - 1;
            break;
        case 'down':
            newRow = row + 1;
            break;
        case 'left':
            newCol = col - 1;
            break;
        case 'right':
            newCol = col + 1;
            break;
    }
    
    if (newRow >= 0 && newRow < currentPuzzle.size && 
        newCol >= 0 && newCol < currentPuzzle.size) {
        // 交换
        currentPuzzle.grid[row][col] = currentPuzzle.grid[newRow][newCol];
        currentPuzzle.grid[newRow][newCol] = 0;
        currentPuzzle.emptyPos = { row: newRow, col: newCol };
        
        if (countMove) {
            gameState.moves++;
        }
        
        return true;
    }
    
    return false;
}

// 渲染拼图
function renderPuzzle() {
    const grid = document.getElementById('puzzle-grid');
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${currentPuzzle.size}, 1fr)`;
    
    for (let i = 0; i < currentPuzzle.size; i++) {
        for (let j = 0; j < currentPuzzle.size; j++) {
            const tile = document.createElement('button');
            tile.className = 'puzzle-tile';
            const value = currentPuzzle.grid[i][j];
            
            if (value === 0) {
                tile.className += ' empty';
            } else {
                tile.textContent = value;
                tile.addEventListener('click', () => handleTileClick(i, j));
            }
            
            grid.appendChild(tile);
        }
    }
}

// 处理方块点击
function handleTileClick(row, col) {
    const { row: emptyRow, col: emptyCol } = currentPuzzle.emptyPos;
    
    // 检查是否相邻
    if ((Math.abs(row - emptyRow) === 1 && col === emptyCol) ||
        (Math.abs(col - emptyCol) === 1 && row === emptyRow)) {
        
        // 交换
        currentPuzzle.grid[emptyRow][emptyCol] = currentPuzzle.grid[row][col];
        currentPuzzle.grid[row][col] = 0;
        currentPuzzle.emptyPos = { row, col };
        
        gameState.moves++;
        renderPuzzle();
        forceUpdateUI(); // 使用强制更新
        
        // 检查是否完成
        if (isPuzzleComplete()) {
            setTimeout(() => handleLevelComplete(), 300);
        }
    }
}

// 检查拼图是否完成
function isPuzzleComplete() {
    const size = currentPuzzle.size;
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const expectedValue = i * size + j + 1;
            if (i === size - 1 && j === size - 1) {
                if (currentPuzzle.grid[i][j] !== 0) return false;
            } else {
                if (currentPuzzle.grid[i][j] !== expectedValue) return false;
            }
        }
    }
    return true;
}

// 处理关卡完成
function handleLevelComplete() {
    if (gameState.isPracticeMode) {
        // 练习模式：无限循环
        gameState.currentLevel++;
        startLevel();
    } else {
        // 正式模式
        gameState.currentLevel++;
        
        if (gameState.currentLevel < levelConfig.length) {
            // 继续下一关
            startLevel();
        } else {
            // 所有关卡完成，结束游戏
            gameState.endTime = Date.now();
            clearInterval(gameState.timer);
            clearInterval(gameState.uiUpdateTimer);
            endGame();
        }
    }
}

// 结束游戏
function endGame() {
    switchScreen('game-screen', 'score-screen');
    calculateAndDisplayScore();
}

// 计算并显示分数
function calculateAndDisplayScore() {
    // 总用时（秒）
    const totalTime = (gameState.endTime - gameState.startTime) / 1000;
    
    // 显示成绩
    document.getElementById('stage1-time').textContent = formatTime(Math.floor(totalTime));
    document.getElementById('stage1-score').textContent = '已完成所有关卡';
    document.getElementById('stage2-completed').textContent = '8个关卡全部完成';
    document.getElementById('stage2-score').textContent = '用时：' + formatTime(Math.floor(totalTime));
    document.getElementById('total-score').textContent = formatTime(Math.floor(totalTime));
    
    // 保存到游戏状态中，用于提交
    gameState.finalScore = {
        totalTime: Math.floor(totalTime),
        completed: true
    };
}

// 提交成绩
async function submitScore() {
    const nameInput = document.getElementById('player-name');
    const name = nameInput.value.trim();
    const messageDiv = document.getElementById('submit-message');
    
    if (!name) {
        messageDiv.className = 'submit-message error';
        messageDiv.textContent = '请输入你的姓名！';
        return;
    }
    
    // 禁用提交按钮，防止重复提交
    const submitBtn = document.getElementById('submit-score-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';
    
    const scoreData = {
        name: name,
        totalTime: gameState.finalScore.totalTime,
        timestamp: new Date().toLocaleString('zh-CN')
    };
    
    try {
        // 提交到 LeanCloud
        if (typeof AV !== 'undefined' && LEANCLOUD_CONFIG.appId !== '请替换为您的AppID') {
            await submitToLeanCloud(scoreData);
            messageDiv.className = 'submit-message success';
            messageDiv.textContent = '✅ 成绩已提交到云端！全球排行榜已更新！';
        } else {
            // 如果未配置LeanCloud，只保存到本地
            saveToLocal(scoreData);
            messageDiv.className = 'submit-message success';
            messageDiv.textContent = '✅ 成绩提交成功！（本地存储）';
        }
        
        // 保存到本地（同时保留本地备份）
        saveToLocal(scoreData);
        
        // 标记已玩过
        localStorage.setItem(`huarongdao_class${currentClass}_played`, 'true');
        
        document.getElementById('player-name').disabled = true;
        
        // 3秒后自动跳转到排行榜
        setTimeout(() => {
            showLeaderboard();
        }, 3000);
        
    } catch (error) {
        console.error('提交失败:', error);
        messageDiv.className = 'submit-message error';
        messageDiv.textContent = '❌ 提交失败，请检查网络连接';
        submitBtn.disabled = false;
        submitBtn.textContent = '提交成绩';
    }
}

// 保存到本地
function saveToLocal(scoreData) {
    const storageKey = `huarongdao_class${currentClass}_scores`;
    let allScores = JSON.parse(localStorage.getItem(storageKey) || '[]');
    allScores.push(scoreData);
    allScores.sort((a, b) => a.totalTime - b.totalTime); // 按用时升序，时间短排前
    localStorage.setItem(storageKey, JSON.stringify(allScores));
}

// 提交到 LeanCloud
async function submitToLeanCloud(scoreData) {
    const Leaderboard = AV.Object.extend('Leaderboard');
    const score = new Leaderboard();
    
    score.set('classId', currentClass); // 添加班级标识
    score.set('className', CLASS_CONFIG[currentClass].name);
    score.set('name', scoreData.name);
    score.set('totalTime', scoreData.totalTime);
    score.set('timestamp', scoreData.timestamp);
    
    await score.save();
}

// 更新UI（优化性能）
function updateUI() {
    // 防抖优化：如果距离上次更新小于400ms，跳过（移动时除外）
    const now = Date.now();
    if (now - gameState.lastUpdateTime < 400 && gameState.lastUpdateTime > 0) {
        return;
    }
    gameState.lastUpdateTime = now;
    
    // 更新阶段信息
    const stageText = gameState.isPracticeMode ? '练习模式 🎯' : '限时10分钟挑战';
    const stageEl = document.getElementById('stage-text');
    if (stageEl) stageEl.textContent = stageText;
    
    // 更新关卡信息
    const levelEl = document.getElementById('level-text');
    if (levelEl) {
        if (gameState.isPracticeMode) {
            const size = practiceLevelSizes[gameState.currentLevel % practiceLevelSizes.length];
            levelEl.textContent = `关卡 ${gameState.currentLevel + 1} (${size}×${size})`;
        } else {
            levelEl.textContent = `关卡 ${gameState.currentLevel + 1}/8`;
        }
    }
    
    // 更新倒计时器
    const timerEl = document.getElementById('timer');
    if (timerEl) {
        if (gameState.isPracticeMode) {
            const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
            timerEl.textContent = '⏱️ 用时 ' + formatTime(elapsed);
        } else {
            timerEl.textContent = '⏱️ 剩余 ' + formatTime(gameState.remaining);
        }
    }
    
    // 更新步数
    const movesEl = document.getElementById('moves');
    if (movesEl) {
        movesEl.textContent = `步数: ${gameState.moves}`;
    }
}

// 强制更新UI（移动时调用）
function forceUpdateUI() {
    gameState.lastUpdateTime = 0; // 重置时间戳
    updateUI();
}

// 格式化时间
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 切换屏幕
function switchScreen(fromId, toId) {
    document.getElementById(fromId).classList.remove('active');
    document.getElementById(toId).classList.add('active');
}

// 显示排行榜
function showLeaderboard() {
    const currentScreen = document.querySelector('.screen.active');
    switchScreen(currentScreen.id, 'leaderboard-screen');
    loadLeaderboard();
}

// 返回欢迎界面
function backToWelcome() {
    switchScreen('leaderboard-screen', 'welcome-screen');
}

// 返回班级选择界面
function backToClassSelect() {
    currentClass = null;
    switchScreen('welcome-screen', 'class-select-screen');
}

// 加载排行榜
async function loadLeaderboard() {
    const listDiv = document.getElementById('leaderboard-list');
    listDiv.innerHTML = '<div class="loading">加载中...</div>';
    
    try {
        let allScores = [];
        
        // 尝试从 LeanCloud 加载
        if (typeof AV !== 'undefined' && LEANCLOUD_CONFIG.appId !== '请替换为您的AppID') {
            allScores = await loadFromLeanCloud();
        }
        
        // 如果云端没有数据，使用本地数据
        if (allScores.length === 0) {
            const storageKey = `huarongdao_class${currentClass}_scores`;
            allScores = JSON.parse(localStorage.getItem(storageKey) || '[]');
        }
        
        if (allScores.length === 0) {
            listDiv.innerHTML = '<div class="no-data">暂无成绩数据</div>';
            return;
        }
        
        // 按用时升序（时间短排前）
        allScores.sort((a, b) => a.totalTime - b.totalTime);
        
        let html = '';
        allScores.forEach((score, index) => {
            const rank = index + 1;
            let rankClass = '';
            let rankEmoji = '';
            
            if (rank === 1) {
                rankClass = 'top1';
                rankEmoji = '🥇';
            } else if (rank === 2) {
                rankClass = 'top2';
                rankEmoji = '🥈';
            } else if (rank === 3) {
                rankClass = 'top3';
                rankEmoji = '🥉';
            } else {
                rankEmoji = rank;
            }
            
            html += `
                <div class="leaderboard-item">
                    <div class="leaderboard-rank ${rankClass}">${rankEmoji}</div>
                    <div class="leaderboard-name">
                        ${score.name}
                        <div class="leaderboard-time">${score.timestamp}</div>
                    </div>
                    <div class="leaderboard-score">${formatTime(score.totalTime)}</div>
                </div>
            `;
        });
        
        listDiv.innerHTML = html;
        
    } catch (error) {
        console.error('加载排行榜失败:', error);
        // 如果加载失败，使用本地数据
        const storageKey = `huarongdao_class${currentClass}_scores`;
        const localScores = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (localScores.length > 0) {
            displayScores(localScores, listDiv);
        } else {
            listDiv.innerHTML = '<div class="no-data">加载失败，请检查网络</div>';
        }
    }
}

// 从 LeanCloud 加载数据
async function loadFromLeanCloud() {
    const query = new AV.Query('Leaderboard');
    query.equalTo('classId', currentClass); // 只查询当前班级的数据
    query.ascending('totalTime'); // 按用时升序（时间短排前）
    query.limit(100); // 最多显示100条
    
    const results = await query.find();
    
    return results.map(item => ({
        name: item.get('name'),
        totalTime: item.get('totalTime'),
        timestamp: item.get('timestamp')
    }));
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initGame);
