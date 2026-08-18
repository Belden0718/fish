// Firebase Initialization Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCgFBpmYXeu4BucuaFZuZOOJRMr1_amuzg",
  authDomain: "fish-encyclopedia-a5b73.firebaseapp.com",
  databaseURL: "https://fish-encyclopedia-a5b73-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fish-encyclopedia-a5b73",
  storageBucket: "fish-encyclopedia-a5b73.firebasestorage.app",
  messagingSenderId: "591252633631",
  appId: "1:591252633631:web:73366232d66f13fb467d2a",
  measurementId: "G-VF2Q62XNNT"
};

// Initialize Firebase App & Realtime Database
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const dbRef = db.ref('treasureFishList');

// Image Compressor & Helper Utility
function compressImageFile(file, maxWidth = 250, maxHeight = 250, quality = 0.85) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL("image/webp", quality);
                resolve(dataUrl);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Initial Data
let treasureFishList = [];
let tempReorderList = []; // Scratch array for reorder modal state
let currentSearch = "";
let currentViewMode = "cards"; // 'cards' | 'analytics' | 'table'

// Temporary Avatar State in Form
let currentTfAvatarVal = "👑";
let currentTf2AvatarVal = "🐟";

// DOM Elements
const treasureCardsContainer = document.getElementById("treasure-cards-container");
const tableContainerBox = document.getElementById("table-container-box");
const analyticsDashboard = document.getElementById("analytics-dashboard");
const searchInput = document.getElementById("search-input");
const statTreasureCount = document.getElementById("stat-treasure-count");
const statMaterialCount = document.getElementById("stat-material-count");
const statTotalQty = document.getElementById("stat-total-qty");
const statTopMaterial = document.getElementById("stat-top-material");
const gridCount = document.getElementById("grid-count");

// Modal Elements
const modalForm = document.getElementById("modal-form");
const treasureFishForm = document.getElementById("treasure-fish-form");
const targetFishFormContainer = document.getElementById("target-fish-form-container");
const materialsFormContainer = document.getElementById("materials-form-container");

// Fish 1 Inputs
const tfAvatarPreview = document.getElementById("tf-avatar-preview");
const tfIconEmoji = document.getElementById("tf-icon-emoji");
const tfFileUpload = document.getElementById("tf-file-upload");
const tfIconUrl = document.getElementById("tf-icon-url");
const formNameInput = document.getElementById("form-name");
const formRewardInput = document.getElementById("form-reward");

// Fish 2 Inputs
const tf2AvatarPreview = document.getElementById("tf2-avatar-preview");
const tf2IconEmoji = document.getElementById("tf2-icon-emoji");
const tf2FileUpload = document.getElementById("tf2-file-upload");
const tf2IconUrl = document.getElementById("tf2-icon-url");
const formName2Input = document.getElementById("form-name2");
const formReward2Input = document.getElementById("form-reward2");

// Reorder Modal Elements
const modalReorder = document.getElementById("modal-reorder");
const reorderItemsList = document.getElementById("reorder-items-list");

// Usage Sources Modal Elements
const modalUsage = document.getElementById("modal-usage");
const usageModalTitle = document.getElementById("usage-modal-title");
const usageModalSubtitle = document.getElementById("usage-modal-subtitle");
const usageItemsList = document.getElementById("usage-items-list");

document.addEventListener("DOMContentLoaded", () => {
    setupFirebaseSync();
    setupEventListeners();
});

// Setup Firebase Realtime Listener
function setupFirebaseSync() {
    dbRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && Array.isArray(data)) {
            treasureFishList = data;
        } else if (data && typeof data === 'object') {
            treasureFishList = Object.values(data);
        } else {
            // First time initialization: Seed from static data.json file if available
            seedInitialDataFromLocal();
            return;
        }

        normalizeData();
        render();
    }, (error) => {
        console.error("Firebase read failed, using local storage fallback", error);
        loadFromLocalStorageFallback();
        render();
    });
}

async function seedInitialDataFromLocal() {
    try {
        const res = await fetch('/data.json');
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                treasureFishList = data;
                saveData(); // Push initial seed to Firebase Cloud
                return;
            }
        }
    } catch (e) {}

    loadFromLocalStorageFallback();
    if (treasureFishList.length > 0) {
        saveData(); // Push local storage data to Firebase Cloud
    } else {
        render();
    }
}

function loadFromLocalStorageFallback() {
    const saved = localStorage.getItem("aqua_fish_avatar_db");
    if (saved) {
        try {
            treasureFishList = JSON.parse(saved);
        } catch (e) {
            treasureFishList = [];
        }
    } else {
        treasureFishList = [];
    }
}

function normalizeData() {
    treasureFishList.forEach(tf => {
        if (!tf.yieldType) tf.yieldType = "both";
        if (!tf.fishes) {
            tf.fishes = [{
                name: tf.name,
                icon: tf.icon || "👑",
                rewardTreasure: tf.rewardTreasure
            }];
        }
    });
}

// Save data to Firebase (Global Sync) + localStorage backup
function saveData() {
    // 1. Sync to Firebase Cloud
    dbRef.set(treasureFishList).catch(err => {
        console.error("Firebase save failed", err);
    });

    // 2. Sync to localStorage backup
    localStorage.setItem("aqua_fish_avatar_db", JSON.stringify(treasureFishList));
}

function setupEventListeners() {
    searchInput.addEventListener("input", (e) => {
        currentSearch = e.target.value.toLowerCase().trim();
        render();
    });

    document.getElementById("view-mode-cards").addEventListener("click", () => setViewMode("cards"));
    document.getElementById("view-mode-analytics").addEventListener("click", () => setViewMode("analytics"));
    document.getElementById("view-mode-table").addEventListener("click", () => setViewMode("table"));

    document.getElementById("chk-ignore-rare-treasures")?.addEventListener("change", () => {
        render();
    });

    document.getElementById("btn-add-treasure-fish").addEventListener("click", () => openFormModal());
    document.getElementById("fab-add-fish").addEventListener("click", () => openFormModal());

    document.getElementById("fab-reorder")?.addEventListener("click", openReorderModal);
    document.getElementById("fab-export")?.addEventListener("click", exportData);
    document.getElementById("fab-import")?.addEventListener("click", () => {
        document.getElementById("file-import").click();
    });



    document.getElementById("btn-add-target-fish-row")?.addEventListener("click", () => {
        addTargetFishFormCard();
    });

    // Reorder Modal Triggers
    document.getElementById("btn-open-reorder-modal").addEventListener("click", openReorderModal);
    document.getElementById("modal-reorder-close").addEventListener("click", closeReorderModal);
    document.getElementById("btn-close-reorder").addEventListener("click", closeReorderModal);
    document.getElementById("btn-save-reorder").addEventListener("click", saveReorderState);

    // Usage Sources Modal Triggers
    document.getElementById("modal-usage-close").addEventListener("click", closeUsageModal);
    document.getElementById("btn-close-usage").addEventListener("click", closeUsageModal);

    document.getElementById("modal-form-close").addEventListener("click", closeFormModal);
    document.getElementById("btn-cancel-form").addEventListener("click", closeFormModal);

    treasureFishForm.addEventListener("submit", handleFormSubmit);
    document.getElementById("btn-add-material-row").addEventListener("click", () => {
        addMaterialFormRow();
    });

    document.getElementById("btn-export-data").addEventListener("click", exportData);
    document.getElementById("btn-import-trigger").addEventListener("click", () => {
        document.getElementById("file-import").click();
    });
    document.getElementById("file-import").addEventListener("change", importData);
}

function updateAvatarPreview(container, val) {
    if (isImageSource(val)) {
        container.innerHTML = `<img src="${val}" alt="avatar">`;
    } else {
        container.textContent = val || "👑";
    }
}

function isImageSource(str) {
    return str && (str.startsWith("http://") || str.startsWith("https://") || str.startsWith("data:image/"));
}

function renderAvatarHTML(val, fallbackEmoji = "🐠") {
    if (isImageSource(val)) {
        return `<img src="${val}" alt="fish">`;
    }
    return val || fallbackEmoji;
}

function setViewMode(mode) {
    currentViewMode = mode;
    document.querySelectorAll(".segment-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".view-panel").forEach(p => p.classList.remove("active"));

    if (mode === "cards") {
        document.getElementById("view-mode-cards").classList.add("active");
        document.getElementById("cards-view").classList.add("active");
    } else if (mode === "analytics") {
        document.getElementById("view-mode-analytics").classList.add("active");
        document.getElementById("analytics-view").classList.add("active");
    } else {
        document.getElementById("view-mode-table").classList.add("active");
        document.getElementById("table-view").classList.add("active");
    }
    render();
}

function render() {
    updateStats();

    const filtered = treasureFishList.filter(item => {
        const searchMatchesTf = item.fishes.some(f => 
            f.name.toLowerCase().includes(currentSearch) || f.rewardTreasure.toLowerCase().includes(currentSearch)
        );
        const searchMatchesMat = item.materials.some(m => 
            m.name.toLowerCase().includes(currentSearch) || m.treasure.toLowerCase().includes(currentSearch)
        );

        return searchMatchesTf || searchMatchesMat;
    });

    gridCount.textContent = `${filtered.length} 組寶物魚配方`;

    if (currentViewMode === "cards") {
        renderCards(filtered);
    } else if (currentViewMode === "analytics") {
        renderAnalytics(filtered);
    } else {
        renderTable(filtered);
    }
}

// Check if material fish name or treasure name contains "(免費禮物)"
function isFreeGiftMaterial(m) {
    const matName = m.name || "";
    const treasureName = m.treasure || "";
    return matName.includes("免費禮物") || treasureName.includes("免費禮物");
}

// Check if material should be ignored when "忽略稀有寶物" option is enabled
function shouldIgnoreMaterial(m, ignoreRare = true) {
    if (ignoreRare) {
        const matName = m.name || "";
        const treasureName = m.treasure || "";
        const keywords = ["寶物遊樂場", "神秘寶箱", "免費禮物"];
        return keywords.some(k => matName.includes(k) || treasureName.includes(k));
    }
    return false;
}

function updateStats() {
    statTreasureCount.textContent = treasureFishList.length;
    
    const chkEl = document.getElementById("chk-ignore-rare-treasures");
    const ignoreRare = chkEl ? chkEl.checked : true;
    const treasureMap = {};
    let totalQty = 0;

    treasureFishList.forEach(tf => {
        tf.materials.forEach(m => {
            totalQty += m.qty;
            if (!shouldIgnoreMaterial(m, ignoreRare)) {
                treasureMap[m.treasure] = (treasureMap[m.treasure] || 0) + m.qty;
            }
        });
    });

    statMaterialCount.textContent = Object.keys(treasureMap).length;
    statTotalQty.textContent = totalQty;

    let topTreasure = "-";
    let maxQty = 0;
    Object.entries(treasureMap).forEach(([name, qty]) => {
        if (qty > maxQty) {
            maxQty = qty;
            topTreasure = `${name} (${qty}個)`;
        }
    });

    statTopMaterial.textContent = topTreasure;
}

// Open Sources Modal to inspect which Treasure Fishes use this material treasure
function openUsageModal(treasureName) {
    usageModalTitle.textContent = `💎 寶物【${treasureName}】出處明細`;
    usageItemsList.innerHTML = "";

    const matchedSources = [];

    treasureFishList.forEach(tf => {
        const reqMat = tf.materials.find(m => m.treasure === treasureName);
        if (reqMat) {
            matchedSources.push({
                recipe: tf,
                material: reqMat
            });
        }
    });

    usageModalSubtitle.textContent = `共在 ${matchedSources.length} 組寶物魚配方的合成公式中出現：`;

    if (matchedSources.length === 0) {
        usageItemsList.innerHTML = `<p style="color:var(--text-muted); padding:20px; text-align:center;">無出處紀錄</p>`;
    } else {
        matchedSources.forEach(item => {
            const dividerText = (item.recipe.yieldType === "random") ? " or " : " + ";
            const fishNamesStr = item.recipe.fishes.map(f => f.name).join(dividerText);
            const mainFishIcon = item.recipe.fishes[0]?.icon || '👑';

            const card = document.createElement("div");
            card.className = "usage-source-card";
            card.innerHTML = `
                <div class="usage-card-left">
                    <div class="tf-avatar" style="width:42px; height:42px; font-size:1.4rem;">
                        ${renderAvatarHTML(mainFishIcon, '👑')}
                    </div>
                    <div>
                        <div style="font-weight:bold; font-size:1.05rem;">${fishNamesStr}</div>
                        <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">
                            材料魚：${renderAvatarHTML(item.material.icon, '🐟')} ${item.material.name}
                        </div>
                    </div>
                </div>
                <div class="usage-qty-badge">
                    需要 ${item.material.qty} 個
                </div>
            `;
            usageItemsList.appendChild(card);
        });
    }

    modalUsage.classList.add("active");
}

function closeUsageModal() {
    modalUsage.classList.remove("active");
}

// Global Reorder Modal Logic
function openReorderModal() {
    if (treasureFishList.length === 0) {
        alert("目前圖鑑內尚無寶物魚配方資料，請先新增！");
        return;
    }
    tempReorderList = JSON.parse(JSON.stringify(treasureFishList));
    renderReorderItems();
    modalReorder.classList.add("active");
}

function closeReorderModal() {
    modalReorder.classList.remove("active");
}

function saveReorderState() {
    treasureFishList = JSON.parse(JSON.stringify(tempReorderList));
    saveData();
    closeReorderModal();
    render();
}

function moveTempItem(index, action) {
    if (action === "top" && index > 0) {
        const item = tempReorderList.splice(index, 1)[0];
        tempReorderList.unshift(item);
    } else if (action === "up" && index > 0) {
        const temp = tempReorderList[index];
        tempReorderList[index] = tempReorderList[index - 1];
        tempReorderList[index - 1] = temp;
    } else if (action === "down" && index < tempReorderList.length - 1) {
        const temp = tempReorderList[index];
        tempReorderList[index] = tempReorderList[index + 1];
        tempReorderList[index + 1] = temp;
    } else if (action === "bottom" && index < tempReorderList.length - 1) {
        const item = tempReorderList.splice(index, 1)[0];
        tempReorderList.push(item);
    }
    renderReorderItems();
}

function renderReorderItems() {
    reorderItemsList.innerHTML = "";

    tempReorderList.forEach((tf, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === tempReorderList.length - 1;
        const dividerText = (tf.yieldType === "random") ? " or " : " & ";
        const fishNamesStr = tf.fishes.map(f => f.name).join(dividerText);
        const rewardTreasuresStr = tf.fishes.map(f => f.rewardTreasure).join(" / ");
        const mainIcon = tf.fishes[0]?.icon || '👑';

        const row = document.createElement("div");
        row.className = "reorder-item-row";
        row.innerHTML = `
            <div class="reorder-item-left">
                <div style="display:flex; align-items:center; gap:2px;">
                    <span style="color:var(--primary); font-weight:bold;">#</span>
                    <input type="number" class="reorder-num-badge-input" min="1" max="${tempReorderList.length}" value="${idx + 1}" title="直接輸入順序數字調整位置 (1~${tempReorderList.length})">
                </div>
                <div class="reorder-item-avatar">${renderAvatarHTML(mainIcon, '👑')}</div>
                <div>
                    <div class="reorder-item-title">${fishNamesStr}</div>
                    <div class="reorder-item-reward">解鎖：【${rewardTreasuresStr}】</div>
                </div>
            </div>
            <div class="order-controls-group">
                <button type="button" class="btn-order btn-temp-top" title="移至最前" ${isFirst ? 'disabled' : ''}>⏫</button>
                <button type="button" class="btn-order btn-temp-up" title="上移" ${isFirst ? 'disabled' : ''}>▲</button>
                <button type="button" class="btn-order btn-temp-down" title="下移" ${isLast ? 'disabled' : ''}>▼</button>
                <button type="button" class="btn-order btn-temp-bottom" title="移至最後" ${isLast ? 'disabled' : ''}>⏬</button>
            </div>
        `;

        const numInput = row.querySelector(".reorder-num-badge-input");
        numInput.addEventListener("focus", (e) => e.target.select());
        
        let isProcessing = false;
        const handlePosChange = (e) => {
            if (isProcessing) return;
            const newPos = parseInt(e.target.value, 10);
            if (!isNaN(newPos) && newPos >= 1 && newPos <= tempReorderList.length && newPos !== idx + 1) {
                isProcessing = true;
                moveTempItemToPosition(idx, newPos - 1);
            } else {
                e.target.value = idx + 1; // restore if invalid
            }
        };

        numInput.addEventListener("change", handlePosChange);
        numInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                numInput.blur(); // blur will naturally fire change event once
            }
        });

        row.querySelector(".btn-temp-top").addEventListener("click", () => moveTempItem(idx, "top"));
        row.querySelector(".btn-temp-up").addEventListener("click", () => moveTempItem(idx, "up"));
        row.querySelector(".btn-temp-down").addEventListener("click", () => moveTempItem(idx, "down"));
        row.querySelector(".btn-temp-bottom").addEventListener("click", () => moveTempItem(idx, "bottom"));

        reorderItemsList.appendChild(row);
    });
}

function moveTempItemToPosition(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= tempReorderList.length) return;
    if (toIndex < 0 || toIndex >= tempReorderList.length) return;

    const item = tempReorderList.splice(fromIndex, 1)[0];
    tempReorderList.splice(toIndex, 0, item);
    renderReorderItems();
}

// Single Item Reordering in Main View
function moveTreasureFish(id, action) {
    const index = treasureFishList.findIndex(t => t.id === id);
    if (index === -1) return;

    if (action === "top" && index > 0) {
        const item = treasureFishList.splice(index, 1)[0];
        treasureFishList.unshift(item);
    } else if (action === "up" && index > 0) {
        const temp = treasureFishList[index];
        treasureFishList[index] = treasureFishList[index - 1];
        treasureFishList[index - 1] = temp;
    } else if (action === "down" && index < treasureFishList.length - 1) {
        const temp = treasureFishList[index];
        treasureFishList[index] = treasureFishList[index + 1];
        treasureFishList[index + 1] = temp;
    } else if (action === "bottom" && index < treasureFishList.length - 1) {
        const item = treasureFishList.splice(index, 1)[0];
        treasureFishList.push(item);
    }

    saveData();
    render();
}

function renderCards(list) {
    treasureCardsContainer.innerHTML = "";

    if (list.length === 0) {
        treasureCardsContainer.innerHTML = `
            <div style="text-align: center; padding: 50px 20px; color: var(--text-muted); background: var(--bg-card); border: 1px dashed var(--border-color); border-radius: var(--radius-md);">
                <p style="font-size: 1.3rem; font-weight: 600; color: var(--text-main); margin-bottom: 8px;">尚無圖鑑資料 👑</p>
                <p style="font-size: 0.9rem; margin-bottom: 20px;">點擊右上角「✨ 新增寶物魚配方」按鈕，即可開始建立屬於您的寶物魚與 9 隻材料魚！</p>
                <button class="btn btn-primary" onclick="openFormModal()">+ 立即新增第一隻寶物魚配方</button>
            </div>
        `;
        return;
    }

    list.forEach(tf => {
        const card = document.createElement("div");
        card.className = "treasure-card";

        const globalIndex = treasureFishList.findIndex(t => t.id === tf.id);
        const isFirst = globalIndex === 0;
        const isLast = globalIndex === treasureFishList.length - 1;
        const isSearching = currentSearch !== "";

        const yieldType = tf.yieldType || "both";
        const countText = tf.fishes.length > 2 ? ` (共${tf.fishes.length}隻)` : (tf.fishes.length === 2 ? " (二選一)" : "");
        const yieldBadgeHTML = yieldType === "both" 
            ? `<span class="yield-badge both">🎁 一次得全部寶物魚 (全拿)</span>` 
            : `<span class="yield-badge random">🎲 隨機獲得其中一隻寶物魚${countText}</span>`;

        let fishesContentHTML = "";

        if (tf.fishes.length === 1) {
            const f = tf.fishes[0];
            fishesContentHTML = `
                <div class="dual-fish-item">
                    <div class="tf-avatar">${renderAvatarHTML(f.icon, '👑')}</div>
                    <div class="tf-title">
                        <h3>${f.name}</h3>
                        <div class="tf-reward">✨ 合成解鎖寶物：【${f.rewardTreasure}】</div>
                    </div>
                </div>
            `;
        } else {
            const dividerSymbol = (yieldType === "random") ? "or" : "+";
            const fishesListHTML = tf.fishes.map((f, i) => `
                <div class="dual-fish-item">
                    <div class="tf-avatar">${renderAvatarHTML(f.icon, i === 0 ? '👑' : '🐟')}</div>
                    <div class="tf-title">
                        <h3>${f.name}</h3>
                        <div class="tf-reward">✨ 解鎖：【${f.rewardTreasure}】</div>
                    </div>
                </div>
            `).join(`<div class="dual-plus-divider">${dividerSymbol}</div>`);

            fishesContentHTML = `
                <div class="dual-fishes-container">
                    <div class="dual-fishes-row">
                        ${fishesListHTML}
                    </div>
                    <div class="yield-badge-wrapper">
                        ${yieldBadgeHTML}
                    </div>
                </div>
            `;
        }

        const materialsHTML = tf.materials.map((m, index) => `
            <div class="mat-item-box">
                <div class="mat-info-left">
                    <div class="mat-icon">${renderAvatarHTML(m.icon, '🐟')}</div>
                    <div>
                        <div class="mat-name">#${index + 1} ${m.name}</div>
                        <div class="mat-treasure">寶物：【${m.treasure}】</div>
                    </div>
                </div>
                <div class="mat-qty">x${m.qty}</div>
            </div>
        `).join("");

        card.innerHTML = `
            <div class="treasure-card-header">
                <div class="tf-header-left">
                    ${fishesContentHTML}
                </div>
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; flex-shrink: 0;">
                    <div class="order-controls-group" title="${isSearching ? '搜尋過濾狀態下暫停調整排序' : '調整寶物魚排序'}">
                        <button class="btn-order btn-move-top" data-id="${tf.id}" title="移至最前 (Top)" ${isFirst || isSearching ? 'disabled' : ''}>⏫</button>
                        <button class="btn-order btn-move-up" data-id="${tf.id}" title="上移 (Up)" ${isFirst || isSearching ? 'disabled' : ''}>▲</button>
                        <button class="btn-order btn-move-down" data-id="${tf.id}" title="下移 (Down)" ${isLast || isSearching ? 'disabled' : ''}>▼</button>
                        <button class="btn-order btn-move-bottom" data-id="${tf.id}" title="移至最後 (Bottom)" ${isLast || isSearching ? 'disabled' : ''}>⏬</button>
                    </div>

                    <button class="btn btn-sm btn-secondary btn-edit" data-id="${tf.id}">✏️ 編輯</button>
                    <button class="btn btn-sm btn-danger btn-delete" data-id="${tf.id}">🗑️ 刪除</button>
                </div>
            </div>

            <div class="materials-title-bar">
                <span>需求材料：底下 ${tf.materials.length} 隻材料魚寶物 (獨立不重疊)</span>
                <span>共 ${tf.materials.length} 種寶物</span>
            </div>

            <div class="materials-grid-3x3">
                ${materialsHTML}
            </div>
        `;

        card.querySelector(".btn-move-top")?.addEventListener("click", () => moveTreasureFish(tf.id, "top"));
        card.querySelector(".btn-move-up")?.addEventListener("click", () => moveTreasureFish(tf.id, "up"));
        card.querySelector(".btn-move-down")?.addEventListener("click", () => moveTreasureFish(tf.id, "down"));
        card.querySelector(".btn-move-bottom")?.addEventListener("click", () => moveTreasureFish(tf.id, "bottom"));

        card.querySelector(".btn-edit").addEventListener("click", () => openFormModal(tf.id));
        card.querySelector(".btn-delete").addEventListener("click", () => deleteTreasureFish(tf.id));

        treasureCardsContainer.appendChild(card);
    });
}

function renderAnalytics(list) {
    analyticsDashboard.innerHTML = "";

    if (list.length === 0) {
        analyticsDashboard.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
                尚無分析資料，請先新增寶物魚配方。
            </div>
        `;
        return;
    }

    const chkEl = document.getElementById("chk-ignore-rare-treasures");
    const ignoreRare = chkEl ? chkEl.checked : true;

    const treasureDemandMap = {};
    list.forEach(tf => {
        tf.materials.forEach(m => {
            if (!shouldIgnoreMaterial(m, ignoreRare)) {
                if (!treasureDemandMap[m.treasure]) {
                    treasureDemandMap[m.treasure] = { qty: 0, icon: m.icon, usedInCount: 0 };
                }
                treasureDemandMap[m.treasure].qty += m.qty;
                treasureDemandMap[m.treasure].usedInCount += 1;
            }
        });
    });

    const sortedDemand = Object.entries(treasureDemandMap)
        .sort((a, b) => b[1].qty - a[1].qty);

    if (sortedDemand.length === 0) {
        analyticsDashboard.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
                ${ignoreRare ? '所有材料寶物皆已被過濾（含寶物遊樂場、神秘寶箱、免費禮物）' : '所有寶物來源皆為「免費禮物」，無須計算額外寶物需求！'}
            </div>
        `;
        return;
    }

    const maxDemandQty = sortedDemand[0][1].qty;

    const topDemandChartHTML = sortedDemand.slice(0, 100).map(([name, data], idx) => {
        const percentage = Math.round((data.qty / maxDemandQty) * 100);
        return `
            <div class="chart-bar-item">
                <div class="bar-label-row">
                    <span style="display:flex; align-items:center; gap:8px;">
                        <span style="color:var(--primary); font-weight:bold; width: 32px;">#${idx + 1}</span>
                        <span class="analytics-avatar-badge">${renderAvatarHTML(data.icon, '🐟')}</span>
                        【${name}】
                        <button type="button" class="btn-view-sources" data-treasure="${name}">
                            🔍 出現在 ${data.usedInCount} 組寶物魚配方 ▾
                        </button>
                    </span>
                    <span style="color:var(--primary); font-weight:bold;">${data.qty} 個</span>
                </div>
                <div class="bar-track">
                    <div class="bar-fill" style="width: ${percentage}%;"></div>
                </div>
            </div>
        `;
    }).join("");

    const subtitleText = ignoreRare 
        ? "已勾選「忽略稀有寶物」，已排除含【寶物遊樂場】、【神秘寶箱】、【免費禮物】之項目" 
        : "已忽略含「免費禮物」之免費寶物來源 (點擊出處可檢視明細)";

    analyticsDashboard.innerHTML = `
        <div class="analytics-widget" style="grid-column: 1 / -1;">
            <div class="widget-title">
                <span>🔥 全圖鑑材料寶物需求排行榜 (Top 100)</span>
                <span style="font-size:0.8rem; color:var(--text-muted);">${subtitleText}</span>
            </div>
            <div class="chart-bar-list">
                ${topDemandChartHTML}
            </div>
        </div>
    `;

    analyticsDashboard.querySelectorAll(".btn-view-sources").forEach(btn => {
        btn.addEventListener("click", () => {
            openUsageModal(btn.dataset.treasure);
        });
    });
}

function renderTable(list) {
    tableContainerBox.innerHTML = "";

    if (list.length === 0) {
        tableContainerBox.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 20px;">尚無圖鑑資料</p>`;
        return;
    }

    const table = document.createElement("table");
    table.className = "custom-table";
    table.innerHTML = `
        <thead>
            <tr>
                <th>產出寶物魚名稱</th>
                <th>解鎖寶物</th>
                <th>材料編號</th>
                <th>材料魚頭像與名稱</th>
                <th>材料魚產出寶物</th>
                <th>需求數量</th>
                <th>順序調整</th>
            </tr>
        </thead>
        <tbody>
            ${list.map(tf => {
                const globalIndex = treasureFishList.findIndex(t => t.id === tf.id);
                const isFirst = globalIndex === 0;
                const isLast = globalIndex === treasureFishList.length - 1;
                const isSearching = currentSearch !== "";

                const yieldBadgeText = tf.fishes.length > 1 ? (tf.yieldType === "both" ? " [全得]" : " [隨機]") : "";
                const dividerSymbol = (tf.yieldType === "random") ? " or " : " + ";
                const fishNamesHTML = tf.fishes.map(f => `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="tf-avatar" style="width:32px; height:32px; font-size:1.1rem;">${renderAvatarHTML(f.icon, '👑')}</div>
                        ${f.name}
                    </div>
                `).join(`<div style="font-size:0.75rem; color:var(--primary); font-weight:bold; padding-left:12px;">${dividerSymbol}</div>`);
                
                const rewardsHTML = tf.fishes.map(f => `<div>💎 ${f.rewardTreasure}</div>`).join("");

                return tf.materials.map((m, idx) => `
                    <tr>
                        ${idx === 0 ? `<td rowspan="9" style="font-weight:bold; color:var(--text-main); vertical-align:middle; border-right:1px solid var(--border-color);">${fishNamesHTML} <span style="font-size:0.75rem; color:var(--primary);">${yieldBadgeText}</span></td>` : ''}
                        ${idx === 0 ? `<td rowspan="9" style="color:#ffd700; font-weight:bold; vertical-align:middle; border-right:1px solid var(--border-color);">${rewardsHTML}</td>` : ''}
                        <td style="color:var(--primary); font-weight:bold;">#${idx + 1}</td>
                        <td><div style="display:flex; align-items:center; gap:8px;"><div class="mat-icon" style="width:28px; height:28px; font-size:1.1rem;">${renderAvatarHTML(m.icon, '🐟')}</div> ${m.name}</div></td>
                        <td style="color:#ffd700;">【${m.treasure}】</td>
                        <td style="font-weight:bold; color:var(--primary);">x${m.qty}</td>
                        ${idx === 0 ? `
                            <td rowspan="9" style="vertical-align:middle; text-align:center;">
                                <div class="order-controls-group" style="justify-content:center;">
                                    <button class="btn-order btn-move-top" data-id="${tf.id}" title="移至最前" ${isFirst || isSearching ? 'disabled' : ''}>⏫</button>
                                    <button class="btn-order btn-move-up" data-id="${tf.id}" title="上移" ${isFirst || isSearching ? 'disabled' : ''}>▲</button>
                                    <button class="btn-order btn-move-down" data-id="${tf.id}" title="下移" ${isLast || isSearching ? 'disabled' : ''}>▼</button>
                                    <button class="btn-order btn-move-bottom" data-id="${tf.id}" title="移至最後" ${isLast || isSearching ? 'disabled' : ''}>⏬</button>
                                </div>
                            </td>
                        ` : ''}
                    </tr>
                `).join("");
            }).join("")}
        </tbody>
    `;

    table.querySelectorAll(".btn-move-top").forEach(btn => {
        btn.addEventListener("click", () => moveTreasureFish(btn.dataset.id, "top"));
    });
    table.querySelectorAll(".btn-move-up").forEach(btn => {
        btn.addEventListener("click", () => moveTreasureFish(btn.dataset.id, "up"));
    });
    table.querySelectorAll(".btn-move-down").forEach(btn => {
        btn.addEventListener("click", () => moveTreasureFish(btn.dataset.id, "down"));
    });
    table.querySelectorAll(".btn-move-bottom").forEach(btn => {
        btn.addEventListener("click", () => moveTreasureFish(btn.dataset.id, "bottom"));
    });

    tableContainerBox.appendChild(table);
}

function openFormModal(tfId = null) {
    targetFishFormContainer.innerHTML = "";
    materialsFormContainer.innerHTML = "";
    const titleEl = document.getElementById("form-modal-title");

    let existingData = null;
    if (tfId) {
        existingData = treasureFishList.find(item => item.id === tfId);
    }

    if (existingData) {
        titleEl.textContent = `編輯寶物魚配方 (含 ${existingData.fishes ? existingData.fishes.length : 1} 隻目標魚 / ${existingData.materials ? existingData.materials.length : 9} 隻材料魚)`;
        document.getElementById("form-id").value = existingData.id;

        const yieldType = existingData.yieldType || "both";
        document.querySelector(`input[name="yield-type"][value="${yieldType}"]`).checked = true;
    } else {
        titleEl.textContent = "新增寶物魚配方";
        treasureFishForm.reset();
        document.getElementById("form-id").value = "";
        document.querySelector(`input[name="yield-type"][value="both"]`).checked = true;
    }

    // Load Target Fishes
    const targetFishesToLoad = (existingData && existingData.fishes && existingData.fishes.length > 0)
        ? existingData.fishes
        : [{ name: "", rewardTreasure: "", icon: "👑" }];

    targetFishesToLoad.forEach((fishData, i) => addTargetFishFormCard(fishData, i === 0));

    // Load Material Fishes
    const materialsToLoad = (existingData && existingData.materials && existingData.materials.length > 0) 
        ? existingData.materials 
        : Array.from({ length: 9 }, (_, i) => ({
            name: `材料魚 ${i + 1}`,
            treasure: `材料魚 ${i + 1}寶石`,
            qty: 25,
            icon: "🐟"
        }));

    materialsToLoad.forEach(matData => addMaterialFormRow(matData));

    modalForm.classList.add("active");
}

function updateTargetFishBadges() {
    const cards = targetFishFormContainer.querySelectorAll(".fish-form-card");
    cards.forEach((card, index) => {
        const title = card.querySelector(".fish-form-title span");
        if (title) {
            title.textContent = index === 0 ? "主要寶物魚 (第一隻) *" : `解鎖寶物魚 #${index + 1}`;
        }
        const delBtn = card.querySelector(".btn-del-target-fish");
        if (delBtn) {
            delBtn.style.display = cards.length > 1 ? "inline-block" : "none";
        }
    });
}

function addTargetFishFormCard(fishData = null, isFirstRequired = false) {
    const currentCount = targetFishFormContainer.querySelectorAll(".fish-form-card").length;
    const index = currentCount;
    if (!fishData) {
        fishData = { name: "", rewardTreasure: "", icon: index === 0 ? "👑" : "🐟" };
    }

    const fishCard = document.createElement("div");
    fishCard.className = "fish-form-card";
    const uniqueId = Date.now() + "_" + index;

    fishCard.innerHTML = `
        <div class="fish-form-title" style="display:flex; justify-content:space-between; align-items:center;">
            <span>${index === 0 ? "主要寶物魚 (第一隻) *" : `解鎖寶物魚 #${index + 1}`}</span>
            <button type="button" class="btn btn-sm btn-danger btn-del-target-fish" title="刪除此目標魚" style="padding: 1px 6px; font-size: 0.75rem;">✕ 刪除</button>
        </div>
        <div class="form-group">
            <label>寶物魚名稱 ${index === 0 ? '*' : ''}</label>
            <input type="text" class="tf-name-in" ${index === 0 ? 'required' : ''} placeholder="例如：黃金神龍魚" value="${fishData.name}">
        </div>
        <div class="form-group">
            <label>寶物名稱</label>
            <input type="text" class="tf-reward-in" placeholder="(未輸入自動帶入 魚名+寶石)" value="${fishData.rewardTreasure}">
        </div>
        <div class="form-group">
            <label>頭像圖片 / Emoji</label>
            <div class="avatar-upload-box">
                <div class="avatar-preview-circle tf-avatar-prev">${renderAvatarHTML(fishData.icon, index === 0 ? '👑' : '🐟')}</div>
                <div class="avatar-input-controls">
                    <div class="radio-row">
                        <label><input type="radio" name="tf-avatar-type-${uniqueId}" value="emoji" checked> Emoji</label>
                        <label><input type="radio" name="tf-avatar-type-${uniqueId}" value="upload"> 上傳圖片</label>
                        <label><input type="radio" name="tf-avatar-type-${uniqueId}" value="url"> 網址</label>
                    </div>
                    <input type="text" class="tf-icon-emoji-in" placeholder="輸入 Emoji" value="${isImageSource(fishData.icon) ? '' : (fishData.icon || (index === 0 ? '👑' : '🐟'))}">
                    <input type="file" class="tf-file-upload-in" accept="image/*" style="display: none;">
                    <input type="text" class="tf-icon-url-in" placeholder="圖片網址 (https://...)" value="${isImageSource(fishData.icon) && !fishData.icon.startsWith('data:') ? fishData.icon : ''}" style="display: none;">
                </div>
            </div>
        </div>
    `;

    targetFishFormContainer.appendChild(fishCard);

    const nameIn = fishCard.querySelector(".tf-name-in");
    const rewardIn = fishCard.querySelector(".tf-reward-in");
    const prevCircle = fishCard.querySelector(".tf-avatar-prev");
    const emojiIn = fishCard.querySelector(".tf-icon-emoji-in");
    const fileIn = fishCard.querySelector(".tf-file-upload-in");
    const urlIn = fishCard.querySelector(".tf-icon-url-in");
    const delBtn = fishCard.querySelector(".btn-del-target-fish");

    let currentAvatar = fishData.icon || (index === 0 ? "👑" : "🐟");

    // Auto fill reward treasure
    nameIn.addEventListener("input", (e) => {
        const fishName = e.target.value.trim();
        if (!rewardIn.value.trim() || rewardIn.dataset.autoFilled === "true") {
            if (fishName) {
                rewardIn.value = `${fishName}寶石`;
                rewardIn.dataset.autoFilled = "true";
            } else {
                rewardIn.value = "";
                rewardIn.dataset.autoFilled = "false";
            }
        }
    });
    rewardIn.addEventListener("input", () => {
        rewardIn.dataset.autoFilled = "false";
    });

    // Avatar type radio switch
    fishCard.querySelectorAll(`input[name='tf-avatar-type-${uniqueId}']`).forEach(radio => {
        radio.addEventListener("change", (e) => {
            const type = e.target.value;
            emojiIn.style.display = type === "emoji" ? "block" : "none";
            fileIn.style.display = type === "upload" ? "block" : "none";
            urlIn.style.display = type === "url" ? "block" : "none";
        });
    });

    emojiIn.addEventListener("input", (e) => {
        currentAvatar = e.target.value || (index === 0 ? "👑" : "🐟");
        updateAvatarPreview(prevCircle, currentAvatar);
    });
    urlIn.addEventListener("input", (e) => {
        currentAvatar = e.target.value || (index === 0 ? "👑" : "🐟");
        updateAvatarPreview(prevCircle, currentAvatar);
    });
    fileIn.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                currentAvatar = await compressImageFile(file, 250, 250);
                updateAvatarPreview(prevCircle, currentAvatar);
            } catch (err) {
                console.error("Compression failed", err);
            }
        }
    });

    delBtn.addEventListener("click", () => {
        fishCard.remove();
        updateTargetFishBadges();
    });

    // Store reference to current avatar on card element for easy retrieval
    fishCard.getCurrentAvatar = () => currentAvatar;

    updateTargetFishBadges();
}

function updateMaterialBadges() {
    const cards = materialsFormContainer.querySelectorAll(".mat-input-card");
    cards.forEach((card, index) => {
        const badge = card.querySelector(".mat-num-badge");
        if (badge) {
            badge.textContent = `材料魚 #${index + 1}`;
        }
        const delBtn = card.querySelector(".btn-del-mat");
        if (delBtn) {
            delBtn.style.display = cards.length > 1 ? "inline-block" : "none";
        }
    });
}

function addMaterialFormRow(matData = null) {
    const currentCount = materialsFormContainer.querySelectorAll(".mat-input-card").length;
    const index = currentCount;
    if (!matData) {
        matData = {
            name: `材料魚 ${index + 1}`,
            treasure: `材料魚 ${index + 1}寶石`,
            qty: 25,
            icon: "🐟"
        };
    }

    const matCard = document.createElement("div");
    matCard.className = "mat-input-card";
    matCard.setAttribute("draggable", "true");
    matCard.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:6px;">
                <span class="mat-drag-handle" title="按住拖曳調整順序">⣿</span>
                <div class="mat-num-badge">材料魚 #${index + 1}</div>
            </div>
            <button type="button" class="btn btn-sm btn-danger btn-del-mat" title="刪除此材料魚" style="padding: 1px 6px; font-size: 0.75rem;">✕ 刪除</button>
        </div>
        <div class="mat-avatar-row">
            <div class="mat-avatar-prev" id="mat-prev-${Date.now()}-${index}">${renderAvatarHTML(matData.icon, '🐟')}</div>
            <input type="text" class="mat-icon-in" placeholder="Emoji 或 圖片網址" value="${matData.icon || '🐟'}" style="flex:1;">
            <input type="file" class="mat-file-in" accept="image/*" style="display:none;">
            <button type="button" class="btn btn-sm btn-secondary btn-upload-trigger">📷 上傳</button>
        </div>
        <input type="text" class="mat-name-in" placeholder="材料魚名稱 (含「免費禮物」則不列入分析) *" value="${matData.name}" required>
        <input type="text" class="mat-treasure-in" placeholder="材料魚寶物名稱 (未輸入自動帶入 魚名+寶石)" value="${matData.treasure}">
        <div style="display:flex; align-items:center; justify-content:space-between;">
            <span style="font-size:0.75rem; color:var(--text-muted);">需求數量:</span>
            <input type="number" class="mat-qty-in" min="1" max="999" value="${matData.qty}" style="width:70px; text-align:center;" required>
        </div>
    `;

    materialsFormContainer.appendChild(matCard);

    const iconInput = matCard.querySelector(".mat-icon-in");
    const fileInput = matCard.querySelector(".mat-file-in");
    const uploadBtn = matCard.querySelector(".btn-upload-trigger");
    const prevDiv = matCard.querySelector(".mat-avatar-prev");
    const nameInput = matCard.querySelector(".mat-name-in");
    const treasureInput = matCard.querySelector(".mat-treasure-in");
    const delBtn = matCard.querySelector(".btn-del-mat");

    uploadBtn.addEventListener("click", () => fileInput.click());

    delBtn.addEventListener("click", () => {
        matCard.remove();
        updateMaterialBadges();
    });

    // Autocomplete Popup Container
    const popupDiv = document.createElement("div");
    popupDiv.className = "mat-suggestions-popup";
    matCard.appendChild(popupDiv);

    function hidePopup() {
        popupDiv.classList.remove("active");
        popupDiv.innerHTML = "";
    }

    function showSuggestions(query) {
        const trimmed = query.toLowerCase().trim();
        if (!trimmed) {
            hidePopup();
            return;
        }

        const existingFishes = getAllExistingFishOptions();
        const matches = existingFishes.filter(item => item.name.toLowerCase().includes(trimmed));

        if (matches.length === 0) {
            hidePopup();
            return;
        }

        popupDiv.innerHTML = matches.map(item => `
            <div class="suggestion-item" data-name="${item.name}" data-treasure="${item.treasure}" data-icon="${encodeURIComponent(item.icon)}">
                <div class="suggestion-avatar">${renderAvatarHTML(item.icon, '🐟')}</div>
                <div class="suggestion-info">
                    <span class="suggestion-name">${item.name}</span>
                    <span class="suggestion-treasure">💎 ${item.treasure}</span>
                </div>
            </div>
        `).join("");

        popupDiv.querySelectorAll(".suggestion-item").forEach(itemEl => {
            itemEl.addEventListener("mousedown", (evt) => {
                evt.preventDefault();
                const name = itemEl.dataset.name;
                const treasure = itemEl.dataset.treasure;
                const icon = decodeURIComponent(itemEl.dataset.icon);

                nameInput.value = name;
                treasureInput.value = treasure;
                treasureInput.dataset.autoFilled = "false";
                iconInput.value = icon;
                updateAvatarPreview(prevDiv, icon);
                hidePopup();
            });
        });

        popupDiv.classList.add("active");
    }

    nameInput.addEventListener("input", (e) => {
        const fishName = e.target.value.trim();
        if (!treasureInput.value.trim() || treasureInput.dataset.autoFilled === "true") {
            if (fishName) {
                treasureInput.value = `${fishName}寶石`;
                treasureInput.dataset.autoFilled = "true";
            } else {
                treasureInput.value = "";
                treasureInput.dataset.autoFilled = "false";
            }
        }
        showSuggestions(e.target.value);
    });

    nameInput.addEventListener("focus", (e) => {
        showSuggestions(e.target.value);
    });

    nameInput.addEventListener("blur", () => {
        setTimeout(hidePopup, 200);
    });

    treasureInput.addEventListener("input", () => {
        treasureInput.dataset.autoFilled = "false";
    });

    iconInput.addEventListener("input", (e) => {
        updateAvatarPreview(prevDiv, e.target.value);
    });

    fileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const compressedDataUrl = await compressImageFile(file, 150, 150);
                iconInput.value = compressedDataUrl;
                updateAvatarPreview(prevDiv, compressedDataUrl);
            } catch (err) {
                console.error("Material avatar compression failed", err);
            }
        }
    });

    // Drag and Drop reordering logic
    matCard.addEventListener("dragstart", (e) => {
        // Only allow dragging if target is handle or inside header, not when typing in input
        if (["INPUT", "BUTTON", "LABEL"].includes(document.activeElement?.tagName)) {
            e.preventDefault();
            return;
        }
        matCard.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", ""); // required for Firefox
    });

    matCard.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const draggingCard = materialsFormContainer.querySelector(".dragging");
        if (draggingCard && draggingCard !== matCard) {
            matCard.classList.add("drag-over");
        }
    });

    matCard.addEventListener("dragenter", (e) => {
        e.preventDefault();
    });

    matCard.addEventListener("dragleave", () => {
        matCard.classList.remove("drag-over");
    });

    matCard.addEventListener("drop", (e) => {
        e.preventDefault();
        matCard.classList.remove("drag-over");
        const draggingCard = materialsFormContainer.querySelector(".dragging");
        if (draggingCard && draggingCard !== matCard) {
            const allCards = Array.from(materialsFormContainer.querySelectorAll(".mat-input-card"));
            const draggingIndex = allCards.indexOf(draggingCard);
            const targetIndex = allCards.indexOf(matCard);

            if (draggingIndex < targetIndex) {
                materialsFormContainer.insertBefore(draggingCard, matCard.nextSibling);
            } else {
                materialsFormContainer.insertBefore(draggingCard, matCard);
            }
            updateMaterialBadges();
        }
    });

    matCard.addEventListener("dragend", () => {
        matCard.classList.remove("dragging");
        matCard.classList.remove("drag-over");
        materialsFormContainer.querySelectorAll(".mat-input-card").forEach(c => c.classList.remove("drag-over"));
        updateMaterialBadges();
    });

    updateMaterialBadges();
}

function getAllExistingFishOptions() {
    const map = new Map();

    treasureFishList.forEach(tf => {
        if (tf.fishes && Array.isArray(tf.fishes)) {
            tf.fishes.forEach(f => {
                if (f && f.name && !map.has(f.name)) {
                    map.set(f.name, {
                        name: f.name,
                        treasure: f.rewardTreasure || `${f.name}寶石`,
                        icon: f.icon || "👑"
                    });
                }
            });
        }
        if (tf.materials && Array.isArray(tf.materials)) {
            tf.materials.forEach(m => {
                if (m && m.name && !map.has(m.name)) {
                    map.set(m.name, {
                        name: m.name,
                        treasure: m.treasure || `${m.name}寶石`,
                        icon: m.icon || "🐟"
                    });
                }
            });
        }
    });

    return Array.from(map.values());
}

function closeFormModal() {
    modalForm.classList.remove("active");
}

function handleFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById("form-id").value;
    const yieldType = document.querySelector('input[name="yield-type"]:checked').value;

    const fishes = [];
    const targetCards = targetFishFormContainer.querySelectorAll(".fish-form-card");
    targetCards.forEach((card, index) => {
        const tfName = card.querySelector(".tf-name-in").value.trim();
        if (tfName || index === 0) {
            let tfReward = card.querySelector(".tf-reward-in").value.trim();
            if (!tfReward && tfName) tfReward = `${tfName}寶石`;
            const tfIcon = typeof card.getCurrentAvatar === "function" ? card.getCurrentAvatar() : (index === 0 ? "👑" : "🐟");
            fishes.push({
                name: tfName || `解鎖寶物魚 ${index + 1}`,
                icon: tfIcon,
                rewardTreasure: tfReward || `寶物 ${index + 1}`
            });
        }
    });

    const materials = [];
    const matCards = materialsFormContainer.querySelectorAll(".mat-input-card");
    matCards.forEach((card, index) => {
        const matName = card.querySelector(".mat-name-in").value.trim();
        let matTreasure = card.querySelector(".mat-treasure-in").value.trim();
        const matQty = parseInt(card.querySelector(".mat-qty-in").value, 10) || 25;
        const matIcon = card.querySelector(".mat-icon-in").value.trim() || "🐟";

        if (!matTreasure && matName) {
            matTreasure = `${matName}寶石`;
        }

        materials.push({
            id: `m_${index + 1}`,
            name: matName,
            treasure: matTreasure || `寶物 ${index + 1}`,
            qty: matQty,
            icon: matIcon
        });
    });

    if (id) {
        const idx = treasureFishList.findIndex(t => t.id === id);
        if (idx !== -1) {
            treasureFishList[idx] = { id, yieldType, fishes, materials };
        }
    } else {
        const newTf = {
            id: "tf_" + Date.now(),
            yieldType,
            fishes,
            materials
        };
        treasureFishList.unshift(newTf); // Insert at top (#1 position)
    }

    saveData();
    closeFormModal();
    render();
}

function deleteTreasureFish(id) {
    const tf = treasureFishList.find(t => t.id === id);
    if (!tf) return;

    const namesStr = tf.fishes.map(f => f.name).join(" 與 ");
    if (confirm(`確定要刪除寶物魚配方【${namesStr}】及其 9 隻材料魚資料嗎？`)) {
        treasureFishList = treasureFishList.filter(t => t.id !== id);
        saveData();
        render();
    }
}

function exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(treasureFishList, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `fish_9materials_data_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const imported = JSON.parse(event.target.result);
            if (Array.isArray(imported)) {
                treasureFishList = imported;
                saveData();
                render();
                alert("資料成功匯入！");
            } else {
                alert("匯入失敗：檔案格式不符合 JSON 陣列標準");
            }
        } catch (err) {
            alert("匯入失敗：無法解析 JSON 檔案");
        }
    };
    reader.readAsText(file);
}
