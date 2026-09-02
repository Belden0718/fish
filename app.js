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

// Admin / Owner Email Configuration
const OWNER_EMAILS = [
    "s634s634s634@gmail.com"
];

// Global Auth & User References State
let currentUser = null;
let isOwner = false;
let userFriendsDbRef = null;
let userMissingDbRef = null;

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
let friendsList = []; // Array of { id, name, tanks: [{ tankNo: 1, fishes: ["魚名1", "魚名2"] }] }
let tempReorderList = []; // Scratch array for reorder modal state
let currentSearch = "";
let currentViewMode = "cards"; // 'cards' | 'friends' | 'analytics' | 'table'
let filterOnlyMissing = false;

// Missing Fish Stamp State (Set of fish names or material names)
let missingFishSet = new Set(JSON.parse(localStorage.getItem("aqua_fish_missing_set") || "[]"));

function saveMissingSet() {
    const missingArr = Array.from(missingFishSet);
    localStorage.setItem("aqua_fish_missing_set", JSON.stringify(missingArr));
    if (currentUser && userMissingDbRef) {
        userMissingDbRef.set(missingArr).catch(err => {
            console.error("Firebase user missing set save failed", err);
        });
    }
}

function toggleMissingFish(name) {
    if (!name) return;
    if (missingFishSet.has(name)) {
        missingFishSet.delete(name);
    } else {
        missingFishSet.add(name);
    }
    saveMissingSet();
    render();
}

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
    setupAuth();
    setupFirebaseSync();
    setupEventListeners();
});

// Setup Google Authentication Listener
function setupAuth() {
    const provider = new firebase.auth.GoogleAuthProvider();
    
    const btnLogin = document.getElementById("btn-google-login");
    const btnLogout = document.getElementById("btn-google-logout");
    const userProfile = document.getElementById("user-profile");
    const userAvatar = document.getElementById("user-avatar");
    const userName = document.getElementById("user-name");
    const ownerBadge = document.getElementById("owner-badge");

    if (btnLogin) {
        btnLogin.addEventListener("click", () => {
            firebase.auth().signInWithPopup(provider).catch(err => {
                console.error("Google 登入失敗", err);
                alert("Google 登入失敗: " + err.message);
            });
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            firebase.auth().signOut();
        });
    }

    firebase.auth().onAuthStateChanged((user) => {
        currentUser = user;
        if (user) {
            const userEmail = (user.email || "").toLowerCase();
            isOwner = OWNER_EMAILS.some(e => e.toLowerCase() === userEmail);
            
            if (btnLogin) btnLogin.style.display = "none";
            if (userProfile) userProfile.style.display = "flex";
            if (userAvatar) userAvatar.src = user.photoURL || "favicon.png";
            if (userName) userName.textContent = user.displayName || userEmail.split("@")[0];
            if (ownerBadge) ownerBadge.style.display = isOwner ? "inline-block" : "none";

            // Bind User Specific References
            userFriendsDbRef = db.ref(`users/${user.uid}/friendsList`);
            userMissingDbRef = db.ref(`users/${user.uid}/missingFishSet`);
            
            setupUserSync();
        } else {
            isOwner = false;
            if (btnLogin) btnLogin.style.display = "inline-flex";
            if (userProfile) userProfile.style.display = "none";
            if (ownerBadge) ownerBadge.style.display = "none";
            
            userFriendsDbRef = null;
            userMissingDbRef = null;
            
            // Fallback to localStorage for guests
            loadFriendsFromLocal();
            loadMissingSetFromLocal();
        }
        
        updateAdminVisibility();
        render();
    });
}

function updateAdminVisibility() {
    const adminElements = document.querySelectorAll(".admin-only-hidden");
    adminElements.forEach(el => {
        if (isOwner) {
            el.classList.remove("admin-only-hidden");
        } else {
            el.classList.add("admin-only-hidden");
        }
    });
}

function setupUserSync() {
    if (!currentUser || !userFriendsDbRef) return;

    // 1. User Friends List Listener & Migration
    userFriendsDbRef.on('value', (snapshot) => {
        const data = snapshot.val();
        let loaded = [];
        if (data && Array.isArray(data)) {
            loaded = data;
        } else if (data && typeof data === 'object') {
            loaded = Object.values(data);
        }

        if (loaded.length > 0) {
            friendsList = loaded;
            render();
        } else {
            // Check local storage first
            loadFriendsFromLocal();
            if (friendsList.length > 0) {
                saveFriendsData();
                render();
            } else {
                // Fetch legacy root 'friendsList' from Firebase
                db.ref('friendsList').once('value').then((rootSnap) => {
                    const rootData = rootSnap.val();
                    if (rootData) {
                        const legacyArr = Array.isArray(rootData) ? rootData : Object.values(rootData);
                        if (legacyArr.length > 0) {
                            friendsList = legacyArr;
                            saveFriendsData();
                            render();
                        }
                    }
                }).catch(err => console.error("Legacy root friends list migration failed", err));
            }
        }
    });

    // 2. User Missing Stamps Listener
    if (userMissingDbRef) {
        userMissingDbRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (Array.isArray(data) && data.length > 0) {
                missingFishSet = new Set(data);
            } else {
                loadMissingSetFromLocal();
                if (missingFishSet.size > 0 && currentUser && userMissingDbRef) {
                    saveMissingSet();
                }
            }
            render();
        });
    }
}


function loadFriendsFromLocal() {
    const savedFriends = localStorage.getItem("aqua_fish_friends_db");
    friendsList = savedFriends ? (JSON.parse(savedFriends) || []) : [];
}

function loadMissingSetFromLocal() {
    missingFishSet = new Set(JSON.parse(localStorage.getItem("aqua_fish_missing_set") || "[]"));
}

// Setup Firebase Realtime Listener for Global Treasure Catalog
function setupFirebaseSync() {
    dbRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && Array.isArray(data)) {
            treasureFishList = data;
        } else if (data && typeof data === 'object') {
            treasureFishList = Object.values(data);
        } else {
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

    // Initial guest load for friendsList
    if (!currentUser) {
        loadFriendsFromLocal();
    }
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
    const defaultQtys = [25, 15, 25, 25, 20, 15, 30, 20, 30];
    let isModified = false;

    treasureFishList.forEach((tf, index) => {
        if (!tf.yieldType) tf.yieldType = "both";
        if (!tf.locations) tf.locations = []; // Location array: [{ friend: "小明", tank: 1 }]
        if (!tf.fishes) {
            tf.fishes = [{
                name: tf.name,
                icon: tf.icon || "👑",
                rewardTreasure: tf.rewardTreasure
            }];
        }

        // Auto update treasure name for 小黃鈕斑馬螺 -> 金黃斑馬螺
        if (tf.fishes) {
            tf.fishes.forEach(f => {
                if (f.name === "小黃鈕斑馬螺" && f.rewardTreasure !== "金黃斑馬螺") {
                    f.rewardTreasure = "金黃斑馬螺";
                    isModified = true;
                }
            });
        }
        if (tf.materials) {
            tf.materials.forEach(m => {
                if (m.name === "小黃鈕斑馬螺" && m.treasure !== "金黃斑馬螺") {
                    m.treasure = "金黃斑馬螺";
                    isModified = true;
                }
            });
        }

        // Apply default quantities for first 16 recipes
        if (index < 16 && tf.materials && Array.isArray(tf.materials)) {
            tf.materials.forEach((m, mIdx) => {
                if (mIdx < 9 && defaultQtys[mIdx] !== undefined) {
                    if (m.qty !== defaultQtys[mIdx]) {
                        m.qty = defaultQtys[mIdx];
                        isModified = true;
                    }
                }
            });
        }
    });

    if (isModified) {
        saveData();
    }
}

// Save data to Firebase (Global Sync) + localStorage backup
function saveData() {
    if (!isOwner) {
        console.warn("Only owner can modify global treasure fish list");
        return;
    }
    // 1. Sync to Firebase Cloud
    dbRef.set(treasureFishList).catch(err => {
        console.error("Firebase save failed", err);
    });

    // 2. Sync to localStorage backup
    localStorage.setItem("aqua_fish_avatar_db", JSON.stringify(treasureFishList));
}

function saveFriendsData() {
    localStorage.setItem("aqua_fish_friends_db", JSON.stringify(friendsList));
    if (currentUser && userFriendsDbRef) {
        userFriendsDbRef.set(friendsList).catch(err => {
            console.error("Firebase user friends save failed", err);
        });
    }
}


function setupEventListeners() {
    searchInput.addEventListener("input", (e) => {
        currentSearch = e.target.value.toLowerCase().trim();
        render();
    });

    document.getElementById("view-mode-cards").addEventListener("click", () => setViewMode("cards"));
    document.getElementById("view-mode-missing")?.addEventListener("click", () => setViewMode("missing"));
    document.getElementById("view-mode-friends")?.addEventListener("click", () => setViewMode("friends"));
    document.getElementById("view-mode-analytics").addEventListener("click", () => setViewMode("analytics"));
    document.getElementById("view-mode-table").addEventListener("click", () => setViewMode("table"));

    document.getElementById("chk-ignore-rare-treasures")?.addEventListener("change", () => {
        render();
    });

    document.getElementById("select-analytics-sort")?.addEventListener("change", () => {
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
    } else if (mode === "missing") {
        document.getElementById("view-mode-missing")?.classList.add("active");
        document.getElementById("missing-view")?.classList.add("active");
    } else if (mode === "friends") {
        document.getElementById("view-mode-friends")?.classList.add("active");
        document.getElementById("friends-view")?.classList.add("active");
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
        const searchMatchesLoc = (item.locations || []).some(l => 
            l.friend.toLowerCase().includes(currentSearch)
        );

        return searchMatchesTf || searchMatchesMat || searchMatchesLoc;
    });

    gridCount.textContent = `${filtered.length} 組寶物魚配方`;

    if (currentViewMode === "cards") {
        renderCards(filtered);
    } else if (currentViewMode === "missing") {
        renderMissingView();
    } else if (currentViewMode === "friends") {
        renderFriendsView();
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

// Check if material should be ignored when "忽略特殊寶物" option is enabled
function shouldIgnoreMaterial(m, ignoreRare = true) {
    if (ignoreRare) {
        const matName = m.name || "";
        const treasureName = m.treasure || "";
        const keywords = ["寶物遊樂場", "神秘寶箱", "免費禮物", "道具"];
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
        const isTargetFishMissing = tf.fishes.some(f => missingFishSet.has(f.name));
        card.className = `treasure-card ${isTargetFishMissing ? 'is-missing-card' : ''}`;

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
            const isMissing = missingFishSet.has(f.name);
            fishesContentHTML = `
                <div class="dual-fish-item">
                    <div class="tf-avatar">${renderAvatarHTML(f.icon, '👑')}</div>
                    <div class="tf-title">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <h3>${f.name}</h3>
                            <button class="btn-toggle-stamp ${isMissing ? 'active' : ''}" data-name="${f.name}">
                                ${isMissing ? '已標缺' : '+ 缺'}
                            </button>
                        </div>
                        <div class="tf-reward">✨ 合成解鎖寶物：【${f.rewardTreasure}】</div>
                    </div>
                </div>
            `;
        } else {
            const dividerSymbol = (yieldType === "random") ? "or" : "+";
            const fishesListHTML = tf.fishes.map((f, i) => {
                const isMissing = missingFishSet.has(f.name);
                return `
                    <div class="dual-fish-item">
                        <div class="tf-avatar">${renderAvatarHTML(f.icon, i === 0 ? '👑' : '🐟')}</div>
                        <div class="tf-title">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <h3>${f.name}</h3>
                                <button class="btn-toggle-stamp ${isMissing ? 'active' : ''}" data-name="${f.name}">
                                    ${isMissing ? '已標缺' : '+ 缺'}
                                </button>
                            </div>
                            <div class="tf-reward">✨ 解鎖：【${f.rewardTreasure}】</div>
                        </div>
                    </div>
                `;
            }).join(`<div class="dual-plus-divider">${dividerSymbol}</div>`);

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

        const materialsHTML = tf.materials.map((m, index) => {
            const isMissingMat = missingFishSet.has(m.name);
            const mLocs = m.locations || [];
            const mFriendMap = new Map();
            mLocs.forEach(loc => {
                if (!mFriendMap.has(loc.friend)) mFriendMap.set(loc.friend, []);
                if (!mFriendMap.get(loc.friend).includes(loc.tank)) mFriendMap.get(loc.friend).push(loc.tank);
            });
            const mLocStr = Array.from(mFriendMap.entries()).map(([fr, tanks]) => {
                tanks.sort((a,b)=>a-b);
                return `${fr}(缸${tanks.join(",")})`;
            }).join(" ");

            return `
                <div class="mat-item-box ${isMissingMat ? 'is-missing-mat' : ''}">
                    <div class="mat-info-left btn-edit-mat-location" data-name="${m.name}" style="cursor:pointer;" title="點擊設定【${m.name}】的好友摸魚地點">
                        <div class="mat-icon">${renderAvatarHTML(m.icon, '🐟')}</div>
                        <div>
                            <div class="mat-name">#${index + 1} ${m.name}</div>
                            <div class="mat-treasure">寶物：【${m.treasure}】</div>
                            ${mLocStr ? `<div style="font-size:0.72rem; color:var(--primary); margin-top:2px;">📍 摸寶：${mLocStr}</div>` : ''}
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button class="btn-toggle-stamp ${isMissingMat ? 'active' : ''}" data-name="${m.name}">
                            ${isMissingMat ? '已標缺' : '+ 缺'}
                        </button>
                        <div class="mat-qty">x${m.qty}</div>
                    </div>
                </div>
            `;
        }).join("");

        // Build grouped location chips HTML (Group tanks for same friend: e.g., 王詩斌 (缸1,2,3))
        const locations = tf.locations || [];
        const friendTanksMap = new Map();
        locations.forEach(loc => {
            if (!friendTanksMap.has(loc.friend)) {
                friendTanksMap.set(loc.friend, []);
            }
            if (!friendTanksMap.get(loc.friend).includes(loc.tank)) {
                friendTanksMap.get(loc.friend).push(loc.tank);
            }
        });

        let locationChipsHTML = Array.from(friendTanksMap.entries()).map(([friend, tanks]) => {
            tanks.sort((a, b) => a - b);
            const tanksStr = tanks.join(",");
            return `
                <span class="location-chip" data-friend="${friend}">
                    📍 ${friend} (缸${tanksStr})
                </span>
            `;
        }).join("");

        locationChipsHTML += `
            <button class="location-chip location-chip-add btn-edit-fish-locations" data-id="${tf.id}">
                ➕ 設定摸魚地點
            </button>
        `;

        card.innerHTML = `
            <div class="treasure-card-header">
                <div class="tf-header-left">
                    ${fishesContentHTML}
                </div>
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; flex-shrink: 0;">
                    <div class="order-controls-group ${isOwner ? '' : 'admin-only-hidden'}" title="${isSearching ? '搜尋過濾狀態下暫停調整排序' : '調整寶物魚排序'}">
                        <button class="btn-order btn-move-top" data-id="${tf.id}" title="移至最前 (Top)" ${isFirst || isSearching ? 'disabled' : ''}>⏫</button>
                        <button class="btn-order btn-move-up" data-id="${tf.id}" title="上移 (Up)" ${isFirst || isSearching ? 'disabled' : ''}>▲</button>
                        <button class="btn-order btn-move-down" data-id="${tf.id}" title="下移 (Down)" ${isLast || isSearching ? 'disabled' : ''}>▼</button>
                        <button class="btn-order btn-move-bottom" data-id="${tf.id}" title="移至最後 (Bottom)" ${isLast || isSearching ? 'disabled' : ''}>⏬</button>
                    </div>

                    ${isOwner ? `
                        <button class="btn btn-sm btn-secondary btn-edit" data-id="${tf.id}">✏️ 編輯</button>
                        <button class="btn btn-sm btn-danger btn-delete" data-id="${tf.id}">🗑️ 刪除</button>
                    ` : ''}
                </div>
            </div>

            <div class="materials-title-bar">
                <span>需求材料：底下 ${tf.materials.length} 隻材料魚寶物 (獨立不重疊)</span>
                <span>共 ${tf.materials.length} 種寶物</span>
            </div>

            <div class="materials-grid-3x3">
                ${materialsHTML}
            </div>

            <div class="location-chips-container">
                <span style="font-size: 0.8rem; color: var(--text-muted); display:flex; align-items:center;">📍 好友摸魚地點：</span>
                ${locationChipsHTML}
            </div>
        `;

        card.querySelector(".btn-move-top")?.addEventListener("click", () => moveTreasureFish(tf.id, "top"));
        card.querySelector(".btn-move-up")?.addEventListener("click", () => moveTreasureFish(tf.id, "up"));
        card.querySelector(".btn-move-down")?.addEventListener("click", () => moveTreasureFish(tf.id, "down"));
        card.querySelector(".btn-move-bottom")?.addEventListener("click", () => moveTreasureFish(tf.id, "bottom"));

        card.querySelector(".btn-edit")?.addEventListener("click", () => openFormModal(tf.id));
        card.querySelector(".btn-delete")?.addEventListener("click", () => deleteTreasureFish(tf.id));

        card.querySelector(".btn-edit-fish-locations")?.addEventListener("click", () => openFishLocationModal(tf.fishes[0]?.name || tf.name));

        card.querySelectorAll(".btn-edit-mat-location").forEach(btn => {
            btn.addEventListener("click", () => {
                openFishLocationModal(btn.dataset.name);
            });
        });

        card.querySelectorAll(".btn-toggle-stamp").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                toggleMissingFish(btn.dataset.name);
            });
        });

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

    const sortEl = document.getElementById("select-analytics-sort");
    const sortMode = sortEl ? sortEl.value : "qty";

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
        .sort((a, b) => {
            if (sortMode === "count") {
                if (b[1].usedInCount !== a[1].usedInCount) {
                    return b[1].usedInCount - a[1].usedInCount;
                }
                return b[1].qty - a[1].qty;
            } else {
                if (b[1].qty !== a[1].qty) {
                    return b[1].qty - a[1].qty;
                }
                return b[1].usedInCount - a[1].usedInCount;
            }
        });

    if (sortedDemand.length === 0) {
        analyticsDashboard.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
                ${ignoreRare ? '所有材料寶物皆已被過濾（含寶物遊樂場、神秘寶箱、免費禮物）' : '所有寶物來源皆為「免費禮物」，無須計算額外寶物需求！'}
            </div>
        `;
        return;
    }

    const maxVal = sortMode === "count" 
        ? Math.max(...sortedDemand.map(([_, d]) => d.usedInCount))
        : sortedDemand[0][1].qty;

    const topDemandChartHTML = sortedDemand.slice(0, 100).map(([name, data], idx) => {
        const currentVal = sortMode === "count" ? data.usedInCount : data.qty;
        const percentage = Math.round((currentVal / maxVal) * 100);
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
                    <span style="color:var(--primary); font-weight:bold;">${sortMode === "count" ? `${data.usedInCount} 組配方 (共 ${data.qty} 個)` : `${data.qty} 個`}</span>
                </div>
                <div class="bar-track">
                    <div class="bar-fill" style="width: ${percentage}%;"></div>
                </div>
            </div>
        `;
    }).join("");

    const subtitleText = ignoreRare 
        ? "已勾選「忽略特殊寶物」，已排除含【寶物遊樂場】、【神秘寶箱】、【免費禮物】、【道具】之項目" 
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
                <th style="width: 22%;">產出寶物魚名稱</th>
                <th style="width: 18%;">解鎖寶物</th>
                <th>9 種材料需求總覽 (魚名 / 產出寶物 / 數量)</th>
                <th style="width: 10%; text-align: center;">順序調整</th>
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
                        <span style="font-weight:bold;">${f.name}</span>
                    </div>
                `).join(`<div style="font-size:0.75rem; color:var(--primary); font-weight:bold; padding-left:12px;">${dividerSymbol}</div>`);
                
                const rewardsHTML = tf.fishes.map(f => `<div>💎 ${f.rewardTreasure}</div>`).join("");

                const materialsGridHTML = `
                    <div class="table-mat-grid">
                        ${tf.materials.map((m, idx) => `
                            <div class="table-mat-chip">
                                <div style="display:flex; align-items:center; gap:6px; min-width:0; overflow:hidden;">
                                    <span style="color:var(--primary); font-weight:bold; font-size:0.75rem; flex-shrink:0;">#${idx + 1}</span>
                                    <div class="mat-icon" style="width:24px; height:24px; font-size:0.95rem; flex-shrink:0;">${renderAvatarHTML(m.icon, '🐟')}</div>
                                    <div style="display:flex; flex-direction:column; min-width:0; overflow:hidden;">
                                        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600;" title="${m.name}">${m.name}</span>
                                        <span style="font-size:0.75rem; color:#ffd700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${m.treasure}">【${m.treasure}】</span>
                                    </div>
                                </div>
                                <span style="font-weight:bold; color:var(--primary); flex-shrink:0;">x${m.qty}</span>
                            </div>
                        `).join("")}
                    </div>
                `;

                return `
                    <tr>
                        <td style="vertical-align:middle; border-right:1px solid var(--border-color);">
                            ${fishNamesHTML} 
                            <span style="font-size:0.75rem; color:var(--primary);">${yieldBadgeText}</span>
                        </td>
                        <td style="color:#ffd700; font-weight:bold; vertical-align:middle; border-right:1px solid var(--border-color);">
                            ${rewardsHTML}
                        </td>
                        <td style="vertical-align:middle;">
                            ${materialsGridHTML}
                        </td>
                        <td style="vertical-align:middle; text-align:center;">
                            <div class="order-controls-group" style="justify-content:center;">
                                <button class="btn-order btn-move-top" data-id="${tf.id}" title="移至最前" ${isFirst || isSearching ? 'disabled' : ''}>⏫</button>
                                <button class="btn-order btn-move-up" data-id="${tf.id}" title="上移" ${isFirst || isSearching ? 'disabled' : ''}>▲</button>
                                <button class="btn-order btn-move-down" data-id="${tf.id}" title="下移" ${isLast || isSearching ? 'disabled' : ''}>▼</button>
                                <button class="btn-order btn-move-bottom" data-id="${tf.id}" title="移至最後" ${isLast || isSearching ? 'disabled' : ''}>⏬</button>
                            </div>
                        </td>
                    </tr>
                `;
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

    const defaultQtys = [25, 15, 25, 25, 20, 15, 30, 20, 30];

    // Load Material Fishes
    let materialsToLoad = [];
    if (existingData && existingData.materials && existingData.materials.length > 0) {
        materialsToLoad = existingData.materials;
    } else {
        materialsToLoad = Array.from({ length: 9 }, (_, i) => ({
            name: `材料魚 ${i + 1}`,
            treasure: `材料魚 ${i + 1}寶石`,
            qty: defaultQtys[i] !== undefined ? defaultQtys[i] : 25,
            icon: "🐟"
        }));
    }

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

        const initialIsImg = isImageSource(fishData.icon);
        const initialIsUrl = initialIsImg && !fishData.icon.startsWith("data:");
        const initialType = initialIsUrl ? "url" : (initialIsImg ? "upload" : "emoji");

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
                        <label><input type="radio" name="tf-avatar-type-${uniqueId}" value="emoji" ${initialType === 'emoji' ? 'checked' : ''}> Emoji</label>
                        <label><input type="radio" name="tf-avatar-type-${uniqueId}" value="upload" ${initialType === 'upload' ? 'checked' : ''}> 上傳圖片</label>
                        <label><input type="radio" name="tf-avatar-type-${uniqueId}" value="url" ${initialType === 'url' ? 'checked' : ''}> 網址</label>
                    </div>
                    <input type="text" class="tf-icon-emoji-in" placeholder="輸入 Emoji" value="${!initialIsImg ? (fishData.icon || (index === 0 ? '👑' : '🐟')) : ''}" style="${initialType === 'emoji' ? 'display:block;' : 'display:none;'}">
                    <input type="file" class="tf-file-upload-in" accept="image/*" style="${initialType === 'upload' ? 'display:block;' : 'display:none;'}">
                    <input type="text" class="tf-icon-url-in" placeholder="圖片網址 (https://...)" value="${initialIsUrl ? fishData.icon : ''}" style="${initialType === 'url' ? 'display:block;' : 'display:none;'}">
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

    fishCard.getCurrentAvatar = () => {
        const checkedRadio = fishCard.querySelector(`input[name='tf-avatar-type-${uniqueId}']:checked`);
        const type = checkedRadio ? checkedRadio.value : "emoji";
        if (type === "url" && urlIn.value.trim()) {
            return urlIn.value.trim();
        } else if (type === "upload" && currentAvatar && isImageSource(currentAvatar)) {
            return currentAvatar;
        } else if (type === "emoji" && emojiIn.value.trim()) {
            return emojiIn.value.trim();
        }
        return currentAvatar || (index === 0 ? "👑" : "🐟");
    };

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
    const defaultQtys = [25, 15, 25, 25, 20, 15, 30, 20, 30];
    if (!matData) {
        matData = {
            name: `材料魚 ${index + 1}`,
            treasure: `材料魚 ${index + 1}寶石`,
            qty: defaultQtys[index] || 25,
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
            <input type="number" class="mat-qty-in" min="1" max="99999" value="${matData.qty}" style="width:80px; text-align:center;" required>
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
                if (f && f.name && !f.name.startsWith("材料魚") && !f.name.startsWith("解鎖寶物魚") && !map.has(f.name)) {
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
                if (m && m.name && !m.name.startsWith("材料魚") && !map.has(m.name)) {
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
            const oldItem = treasureFishList[idx];

            // Global Cascade Update: Check if target fish names or material names/treasures changed
            if (oldItem.fishes && fishes) {
                oldItem.fishes.forEach((oldF, i) => {
                    const newF = fishes[i];
                    if (newF && oldF.name !== newF.name && oldF.name) {
                        cascadeUpdateFishName(oldF.name, newF.name);
                    }
                    if (newF && oldF.rewardTreasure !== newF.rewardTreasure && oldF.rewardTreasure) {
                        cascadeUpdateTreasureName(oldF.rewardTreasure, newF.rewardTreasure);
                    }
                });
            }

            if (oldItem.materials && materials) {
                oldItem.materials.forEach((oldM, i) => {
                    const newM = materials[i];
                    if (newM && oldM.name !== newM.name && oldM.name) {
                        cascadeUpdateFishName(oldM.name, newM.name);
                    }
                    if (newM && oldM.treasure !== newM.treasure && oldM.treasure) {
                        cascadeUpdateTreasureName(oldM.treasure, newM.treasure);
                    }
                });
            }

            treasureFishList[idx] = { ...oldItem, id, yieldType, fishes, materials };
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

    syncFriendsToTreasureFishLocations();
    saveFriendsData();
    saveData();
    closeFormModal();
    render();
}

// Cascade Update Fish Name across all recipes & friends list
function cascadeUpdateFishName(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return;

    // 1. Update target fishes and material fishes across all recipes
    treasureFishList.forEach(tf => {
        if (tf.fishes) {
            tf.fishes.forEach(f => {
                if (f.name === oldName) f.name = newName;
            });
        }
        if (tf.materials) {
            tf.materials.forEach(m => {
                if (m.name === oldName) m.name = newName;
            });
        }
    });

    // 2. Update friendsList tank fish names
    friendsList.forEach(friend => {
        (friend.tanks || []).forEach(tank => {
            if (tank.fishes) {
                tank.fishes = tank.fishes.map(fName => fName === oldName ? newName : fName);
            }
        });
    });
}

// Cascade Update Treasure Name across all recipes
function cascadeUpdateTreasureName(oldTreasure, newTreasure) {
    if (!oldTreasure || !newTreasure || oldTreasure === newTreasure) return;

    treasureFishList.forEach(tf => {
        if (tf.fishes) {
            tf.fishes.forEach(f => {
                if (f.rewardTreasure === oldTreasure) f.rewardTreasure = newTreasure;
            });
        }
        if (tf.materials) {
            tf.materials.forEach(m => {
                if (m.treasure === oldTreasure) m.treasure = newTreasure;
            });
        }
    });
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

// ==========================================
// 👥 好友魚缸簿與摸魚地點 雙向連動邏輯 (Option C)
// ==========================================

function renderFriendsView() {
    const container = document.getElementById("friends-cards-container");
    if (!container) return;
    container.innerHTML = "";

    const searchKeyword = currentSearch.toLowerCase();
    const filteredFriends = friendsList.filter(fr => {
        const nameMatch = fr.name.toLowerCase().includes(searchKeyword);
        const fishMatch = (fr.tanks || []).some(t => 
            (t.fishes || []).some(f => f.toLowerCase().includes(searchKeyword))
        );
        return nameMatch || fishMatch;
    });

    if (filteredFriends.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: var(--text-muted); background: var(--bg-card); border: 1px dashed var(--border-color); border-radius: var(--radius-md);">
                <p style="font-size: 1.3rem; font-weight: 600; color: var(--text-main); margin-bottom: 8px;">尚無好友魚缸資料 👥</p>
                <p style="font-size: 0.9rem; margin-bottom: 20px;">點擊「新增好友與魚缸」按鈕，開始登記好友與他們的魚缸！</p>
                <button class="btn btn-primary" onclick="openFriendFormModal()">+ 立即新增好友與魚缸</button>
            </div>
        `;
        return;
    }

    const allExistingFishList = getAllExistingFishOptions();

    filteredFriends.forEach(friend => {
        const card = document.createElement("div");
        card.className = "friend-card";

        let tanksHTML = (friend.tanks || []).map(tank => {
            // Group duplicate fish names in the same tank (e.g., 炫紫時光雞 x3)
            const fishCountMap = new Map();
            (tank.fishes || []).forEach(fishName => {
                fishCountMap.set(fishName, (fishCountMap.get(fishName) || 0) + 1);
            });

            const fishTagsHTML = Array.from(fishCountMap.entries()).map(([fishName, count]) => {
                const fishObj = allExistingFishList.find(f => f.name === fishName);
                const icon = fishObj ? fishObj.icon : "🐠";
                const countBadge = count > 1 ? `<span style="background:var(--primary); color:#000; font-weight:bold; font-size:0.7rem; padding:1px 5px; border-radius:10px; margin-left:auto;">x${count}</span>` : '';
                return `
                    <div class="tank-fish-tag">
                        <div class="tank-fish-icon">${renderAvatarHTML(icon, '🐠')}</div>
                        <span class="tank-fish-name">${fishName}</span>
                        ${countBadge}
                    </div>
                `;
            }).join("");

            const totalCount = (tank.fishes || []).length;
            return `
                <div class="tank-item">
                    <div class="tank-title">
                        <span>水族缸 #${tank.tankNo}</span>
                        <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">共 ${totalCount} 隻 (包含 ${fishCountMap.size} 種)</span>
                    </div>
                    <div class="tank-fish-tags">
                        ${fishTagsHTML || '<span style="color:var(--text-muted); font-size:0.8rem; grid-column:1/-1;">(空魚缸)</span>'}
                    </div>
                </div>
            `;
        }).join("");

        const totalTanks = (friend.tanks || []).length;
        let totalFishCount = 0;
        (friend.tanks || []).forEach(t => { totalFishCount += (t.fishes || []).length; });

        card.innerHTML = `
            <div class="friend-card-header" style="cursor:pointer;" title="點擊展開/收起魚缸列表">
                <div class="friend-name" style="flex:1; min-width:0;">
                    <span class="friend-toggle-icon" style="transition: transform 0.2s ease; display:inline-block; font-size:0.85rem;">▶</span>
                    <span style="flex-shrink:0;">👤</span> 
                    <span class="friend-name-text" style="font-weight:700; flex-shrink:0; cursor:copy;" title="點擊複製好友名稱">${friend.name}</span>
                    <span class="copy-hint-toast" style="font-size:0.75rem; color:var(--primary); font-weight:normal; display:none; margin-left:4px;">📋 已複製!</span>
                    <span class="friend-summary-badge">(${totalTanks}缸/${totalFishCount}隻)</span>
                </div>
                <div style="display:flex; gap:6px; flex-shrink:0;" onclick="event.stopPropagation();">
                    <button class="btn btn-sm btn-secondary btn-edit-friend" data-id="${friend.id}" style="padding:2px 8px; font-size:0.8rem;">✏️ 編輯</button>
                    <button class="btn btn-sm btn-danger btn-delete-friend" data-id="${friend.id}" style="padding:2px 8px; font-size:0.8rem;">🗑️</button>
                </div>
            </div>
            <div class="friend-tanks-collapsible" style="display:none; flex-direction:column; gap:8px; margin-top:6px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.12);">
                ${tanksHTML || '<p style="color:var(--text-muted); font-size:0.85rem;">尚無魚缸紀錄</p>'}
            </div>
        `;

        const headerEl = card.querySelector(".friend-card-header");
        const bodyEl = card.querySelector(".friend-tanks-collapsible");
        const iconEl = card.querySelector(".friend-toggle-icon");
        const nameTextEl = card.querySelector(".friend-name-text");
        const copyToastEl = card.querySelector(".copy-hint-toast");

        // Copy name to clipboard on name text click
        nameTextEl.addEventListener("click", (e) => {
            e.stopPropagation(); // prevent toggling accordion
            navigator.clipboard.writeText(friend.name).then(() => {
                copyToastEl.style.display = "inline";
                setTimeout(() => {
                    copyToastEl.style.display = "none";
                }, 1500);
            }).catch(err => {
                console.error("Copy failed", err);
            });
        });

        headerEl.addEventListener("click", () => {
            const isCurrentlyExpanded = card.classList.contains("is-expanded");

            // Close all other expanded cards first (Accordion mode)
            container.querySelectorAll(".friend-card").forEach(c => {
                c.classList.remove("is-expanded");
                const b = c.querySelector(".friend-tanks-collapsible");
                const i = c.querySelector(".friend-toggle-icon");
                if (b) b.style.display = "none";
                if (i) i.style.transform = "rotate(0deg)";
            });

            if (!isCurrentlyExpanded) {
                card.classList.add("is-expanded");
                bodyEl.style.display = "flex";
                iconEl.style.transform = "rotate(90deg)";
            }
        });

        card.querySelector(".btn-edit-friend").addEventListener("click", () => openFriendFormModal(friend.id));
        card.querySelector(".btn-delete-friend").addEventListener("click", () => deleteFriend(friend.id));

        container.appendChild(card);
    });
}

// Manage Friends Modal
const modalFriendForm = document.getElementById("modal-friend-form");
const friendForm = document.getElementById("friend-form");
const friendTanksContainer = document.getElementById("friend-tanks-container");

function openFriendFormModal(friendId = null) {
    document.getElementById("friend-form-id").value = friendId || "";
    document.getElementById("friend-modal-title").textContent = friendId ? "✏️ 編輯好友魚缸紀錄" : "👤 新增好友魚缸紀錄";
    friendTanksContainer.innerHTML = "";

    let friendData = null;
    if (friendId) {
        friendData = friendsList.find(f => f.id === friendId);
    }

    document.getElementById("friend-name-input").value = friendData ? friendData.name : "";

    const tanks = (friendData && friendData.tanks && friendData.tanks.length > 0) 
        ? friendData.tanks 
        : [{ tankNo: 1, fishes: [] }, { tankNo: 2, fishes: [] }];

    tanks.forEach(tank => addTankRow(tank.tankNo, tank.fishes));

    modalFriendForm.classList.add("active");
}

function closeFriendFormModal() {
    modalFriendForm.classList.remove("active");
}

function addTankRow(tankNo = null, initialFishes = []) {
    const existingRows = friendTanksContainer.querySelectorAll(".friend-tank-row");
    const actualTankNo = tankNo || (existingRows.length + 1);

    const row = document.createElement("div");
    row.className = "friend-tank-row";
    row.style.cssText = "background:rgba(0,0,0,0.25); padding:10px; border-radius:var(--radius-sm); border:1px solid var(--border-color); display:flex; flex-direction:column; gap:8px;";

    row.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:600; color:var(--primary); font-size:0.9rem;">第 <input type="number" class="tank-no-input" value="${actualTankNo}" style="width:45px; padding:2px 4px; background:var(--bg-dark); border:1px solid var(--border-color); color:var(--text-main); border-radius:4px; text-align:center;"> 缸</span>
            <button type="button" class="btn btn-sm btn-danger btn-remove-tank" style="padding:2px 6px;">✕ 刪除缸</button>
        </div>
        <div class="tank-fish-select-container" style="display:flex; flex-direction:column; gap:6px;">
            <!-- Select rows -->
        </div>
        <button type="button" class="btn btn-sm btn-secondary btn-add-fish-to-tank" style="font-size:0.8rem;">+ 新增養殖魚隻</button>
    `;

    const fishSelectContainer = row.querySelector(".tank-fish-select-container");
    const addFishBtn = row.querySelector(".btn-add-fish-to-tank");

    const addFishSelectRow = (selectedFishName = "", qty = 1) => {
        const selectRow = document.createElement("div");
        selectRow.style.cssText = "display:flex; gap:6px; align-items:center; position:relative;";
        selectRow.innerHTML = `
            <input type="text" class="tank-fish-select" value="${selectedFishName}" placeholder="選擇或輸入魚隻名稱..." style="flex:1; padding:6px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-color); border-radius:4px;">
            <div style="display:flex; align-items:center; gap:2px; flex-shrink:0;">
                <span style="font-size:0.8rem; color:var(--text-muted);">x</span>
                <input type="number" class="tank-fish-qty-input" min="1" max="999" value="${qty}" style="width:50px; padding:6px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-color); border-radius:4px; text-align:center;" title="數量">
            </div>
            <button type="button" class="btn btn-sm btn-danger btn-remove-fish-select" style="padding:2px 6px;">✕</button>
            <div class="mat-suggestions-popup"></div>
        `;

        const fishInput = selectRow.querySelector(".tank-fish-select");
        const popupDiv = selectRow.querySelector(".mat-suggestions-popup");

        function hidePopup() {
            popupDiv.classList.remove("active");
            popupDiv.innerHTML = "";
        }

        function showSuggestions(query) {
            const trimmed = query.toLowerCase().trim();
            const existingFishes = getAllExistingFishOptions();
            const matches = trimmed 
                ? existingFishes.filter(item => item.name.toLowerCase().includes(trimmed))
                : existingFishes;

            if (matches.length === 0) {
                hidePopup();
                return;
            }

            popupDiv.innerHTML = matches.map(item => `
                <div class="suggestion-item" data-name="${item.name}">
                    <div class="suggestion-avatar">${renderAvatarHTML(item.icon, '🐟')}</div>
                    <div class="suggestion-info">
                        <span class="suggestion-name">${item.name}</span>
                    </div>
                </div>
            `).join("");

            popupDiv.querySelectorAll(".suggestion-item").forEach(itemEl => {
                itemEl.addEventListener("mousedown", (evt) => {
                    evt.preventDefault();
                    fishInput.value = itemEl.dataset.name;
                    hidePopup();
                });
            });

            popupDiv.classList.add("active");
        }

        fishInput.addEventListener("input", (e) => showSuggestions(e.target.value));
        fishInput.addEventListener("focus", (e) => showSuggestions(e.target.value));
        fishInput.addEventListener("blur", () => setTimeout(hidePopup, 200));

        selectRow.querySelector(".btn-remove-fish-select").addEventListener("click", () => selectRow.remove());
        fishSelectContainer.appendChild(selectRow);
    };

    // Process initialFishes (supports both array of strings or array of objects/counts)
    if (Array.isArray(initialFishes)) {
        // Group string array into name and qty
        const countMap = new Map();
        initialFishes.forEach(item => {
            if (typeof item === 'string') {
                countMap.set(item, (countMap.get(item) || 0) + 1);
            } else if (typeof item === 'object' && item.name) {
                countMap.set(item.name, (countMap.get(item.name) || 0) + (item.qty || 1));
            }
        });

        countMap.forEach((qty, fName) => {
            addFishSelectRow(fName, qty);
        });
    }

    addFishBtn.addEventListener("click", () => addFishSelectRow("", 1));
    row.querySelector(".btn-remove-tank").addEventListener("click", () => row.remove());

    friendTanksContainer.appendChild(row);
}

function handleFriendFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("friend-form-id").value;
    const name = document.getElementById("friend-name-input").value.trim();
    if (!name) return;

    const tankRows = friendTanksContainer.querySelectorAll(".friend-tank-row");
    const tanks = [];
    let hasDuplicateError = false;

    tankRows.forEach(row => {
        const tankNo = parseInt(row.querySelector(".tank-no-input").value, 10) || (tanks.length + 1);
        const selectRows = row.querySelectorAll(".tank-fish-select-container > div");
        const fishes = [];
        const seenFishNames = new Set();
        let duplicateFound = null;

        selectRows.forEach(sRow => {
            const fishName = sRow.querySelector(".tank-fish-select")?.value.trim();
            const qty = parseInt(sRow.querySelector(".tank-fish-qty-input")?.value, 10) || 1;
            if (fishName) {
                if (seenFishNames.has(fishName)) {
                    duplicateFound = fishName;
                } else {
                    seenFishNames.add(fishName);
                }
                // Expand fishes array based on qty to maintain full backward compatibility with system links
                for (let i = 0; i < qty; i++) {
                    fishes.push(fishName);
                }
            }
        });

        if (duplicateFound) {
            alert(`【第 ${tankNo} 缸】中存在重複的魚隻：【${duplicateFound}】！\n請勿在同一缸重複新增相同魚隻，若需增加數量請直接修改「x數量」。`);
            hasDuplicateError = true;
            return;
        }

        tanks.push({ tankNo, fishes });
    });

    if (hasDuplicateError) return;

    if (id) {
        const idx = friendsList.findIndex(f => f.id === id);
        if (idx !== -1) {
            friendsList[idx] = { id, name, tanks };
        }
    } else {
        friendsList.push({
            id: "fr_" + Date.now(),
            name,
            tanks
        });
    }

    // Sync locations back into treasureFishList for Option C bi-directional link
    syncFriendsToTreasureFishLocations();

    saveFriendsData();
    saveData();
    closeFriendFormModal();
    render();
}

function deleteFriend(id) {
    const friend = friendsList.find(f => f.id === id);
    if (!friend) return;

    if (confirm(`確定要刪除好友【${friend.name}】的魚缸紀錄嗎？`)) {
        friendsList = friendsList.filter(f => f.id !== id);
        syncFriendsToTreasureFishLocations();
        saveFriendsData();
        saveData();
        render();
    }
}

// Bi-directional Link Sync: Update treasureFishList[].locations and materials locations based on friendsList
function syncFriendsToTreasureFishLocations() {
    // 1. Clear existing locations in treasureFishList & material locations
    treasureFishList.forEach(tf => {
        tf.locations = [];
        (tf.materials || []).forEach(m => {
            m.locations = [];
        });
    });

    // 2. Iterate friendsList and push to corresponding treasure fish & materials
    friendsList.forEach(friend => {
        (friend.tanks || []).forEach(tank => {
            (tank.fishes || []).forEach(fishName => {
                // Find matching target treasure fish item
                const matchedTf = treasureFishList.find(tf => 
                    tf.fishes.some(f => f.name === fishName) || tf.name === fishName
                );
                if (matchedTf) {
                    if (!matchedTf.locations) matchedTf.locations = [];
                    const exists = matchedTf.locations.some(l => l.friend === friend.name && l.tank === tank.tankNo);
                    if (!exists) {
                        matchedTf.locations.push({ friend: friend.name, tank: tank.tankNo });
                    }
                }

                // Also find matching material fish items across recipes
                treasureFishList.forEach(tf => {
                    (tf.materials || []).forEach(m => {
                        if (m.name === fishName) {
                            if (!m.locations) m.locations = [];
                            const exists = m.locations.some(l => l.friend === friend.name && l.tank === tank.tankNo);
                            if (!exists) {
                                m.locations.push({ friend: friend.name, tank: tank.tankNo });
                            }
                        }
                    });
                });
            });
        });
    });
}

// Modal Quick Edit Location on Fish Card
const modalFishLocation = document.getElementById("modal-fish-location");
const fishLocationRowsContainer = document.getElementById("fish-location-rows-container");

function openFishLocationModal(fishName) {
    document.getElementById("fish-location-target-name").value = fishName;
    document.getElementById("fish-location-modal-title").textContent = `📍 管理【${fishName}】的好友摸魚點`;
    fishLocationRowsContainer.innerHTML = "";

    // Count locations and quantities directly from friendsList for accuracy
    const locationMap = new Map(); // key: friendName__tankNo => count

    friendsList.forEach(fr => {
        (fr.tanks || []).forEach(tank => {
            let count = 0;
            (tank.fishes || []).forEach(f => {
                if (f === fishName) count++;
            });
            if (count > 0) {
                const key = `${fr.name}__${tank.tankNo}`;
                locationMap.set(key, { friend: fr.name, tank: tank.tankNo, qty: count });
            }
        });
    });

    const locations = Array.from(locationMap.values());
    locations.forEach(loc => addFishLocationRow(loc.friend, loc.tank, loc.qty));
    if (locations.length === 0) {
        addFishLocationRow("", 1, 1);
    }

    modalFishLocation.classList.add("active");
}

function closeFishLocationModal() {
    modalFishLocation.classList.remove("active");
}

function addFishLocationRow(friendName = "", tankNo = 1, qty = 1) {
    const row = document.createElement("div");
    row.className = "fish-loc-item-row";
    row.style.cssText = "display:flex; gap:8px; align-items:center; background:rgba(0,0,0,0.2); padding:8px; border-radius:6px; border:1px solid var(--border-color);";

    let friendOptionsHTML = friendsList.map(fr => `<option value="${fr.name}">${fr.name}</option>`).join("");

    row.innerHTML = `
        <div style="flex:1;">
            <input type="text" list="existing-friends-list" class="loc-friend-input" value="${friendName}" placeholder="好友名字 (例如：小明)" style="width:100%; padding:6px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-color); border-radius:4px;">
            <datalist id="existing-friends-list">
                ${friendOptionsHTML}
            </datalist>
        </div>
        <div style="display:flex; align-items:center; gap:4px;">
            <span style="font-size:0.85rem; color:var(--text-muted);">第</span>
            <input type="number" class="loc-tank-input" min="1" max="99" value="${tankNo}" style="width:45px; padding:6px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-color); border-radius:4px; text-align:center;">
            <span style="font-size:0.85rem; color:var(--text-muted);">缸</span>
        </div>
        <div style="display:flex; align-items:center; gap:2px;">
            <span style="font-size:0.85rem; color:var(--text-muted);">x</span>
            <input type="number" class="loc-qty-input" min="1" max="999" value="${qty}" style="width:50px; padding:6px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-color); border-radius:4px; text-align:center;" title="養殖數量">
            <span style="font-size:0.85rem; color:var(--text-muted);">隻</span>
        </div>
        <button type="button" class="btn btn-sm btn-danger btn-remove-loc-row" style="padding:6px 10px;">✕</button>
    `;

    row.querySelector(".btn-remove-loc-row").addEventListener("click", () => row.remove());
    fishLocationRowsContainer.appendChild(row);
}

function saveFishLocationChanges() {
    const fishName = document.getElementById("fish-location-target-name").value;
    const rows = fishLocationRowsContainer.querySelectorAll(".fish-loc-item-row");

    const newLocations = [];
    const seenLocs = new Set();
    let duplicateLocError = null;

    rows.forEach(r => {
        const friendInput = r.querySelector(".loc-friend-input");
        const tankInput = r.querySelector(".loc-tank-input");
        const qtyInput = r.querySelector(".loc-qty-input");
        if (friendInput && friendInput.value.trim()) {
            const friend = friendInput.value.trim();
            const tank = parseInt(tankInput.value, 10) || 1;
            const qty = parseInt(qtyInput.value, 10) || 1;
            const key = `${friend}__${tank}`;
            if (seenLocs.has(key)) {
                duplicateLocError = `【${friend}】的【第 ${tank} 缸】`;
            } else {
                seenLocs.add(key);
            }
            newLocations.push({ friend, tank, qty });
        }
    });

    if (duplicateLocError) {
        alert(`設定地點失敗：在 ${duplicateLocError} 設定了重複的欄位！\n相同魚缸若要修改數量，請直接更改該列的數量數字。`);
        return;
    }

    // 1. First, remove fishName from all tanks in friendsList for clean sync
    friendsList.forEach(fr => {
        (fr.tanks || []).forEach(tank => {
            if (tank.fishes) {
                tank.fishes = tank.fishes.filter(f => f !== fishName);
            }
        });
    });

    // 2. Add fishName to selected friends & tanks in friendsList with qty
    newLocations.forEach(loc => {
        let fr = friendsList.find(f => f.name === loc.friend);
        if (!fr) {
            fr = { id: "fr_" + Date.now() + "_" + Math.random().toString(36).substr(2,4), name: loc.friend, tanks: [] };
            friendsList.push(fr);
        }
        let tank = fr.tanks.find(t => t.tankNo === loc.tank);
        if (!tank) {
            tank = { tankNo: loc.tank, fishes: [] };
            fr.tanks.push(tank);
        }
        for (let i = 0; i < loc.qty; i++) {
            tank.fishes.push(fishName);
        }
    });

    // 3. Bi-directionally sync to all target fishes and material fishes locations in treasureFishList
    syncFriendsToTreasureFishLocations();

    saveFriendsData();
    saveData();
    closeFishLocationModal();
    render();
}

// Bind Friends & Location Modal Triggers
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btn-open-friends-modal")?.addEventListener("click", () => {
        setViewMode("friends");
    });
    document.getElementById("btn-add-friend")?.addEventListener("click", () => openFriendFormModal());
    document.getElementById("modal-friend-close")?.addEventListener("click", closeFriendFormModal);
    document.getElementById("btn-cancel-friend-form")?.addEventListener("click", closeFriendFormModal);
    document.getElementById("btn-add-tank-row")?.addEventListener("click", () => addTankRow());
    friendForm?.addEventListener("submit", handleFriendFormSubmit);

    document.getElementById("modal-fish-location-close")?.addEventListener("click", closeFishLocationModal);
    document.getElementById("btn-cancel-fish-location")?.addEventListener("click", closeFishLocationModal);
    document.getElementById("btn-add-location-row")?.addEventListener("click", () => addFishLocationRow());
    document.getElementById("btn-save-fish-location")?.addEventListener("click", saveFishLocationChanges);
});

// Render Missing Fishes View (Clean Table View)
function renderMissingView() {
    const missingTableBody = document.getElementById("missing-table-body");
    const missingCountBadge = document.getElementById("missing-count");
    if (!missingTableBody) return;

    missingTableBody.innerHTML = "";

    if (missingFishSet.size === 0) {
        missingCountBadge.textContent = "0 隻缺少";
        missingTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 50px 20px; color: var(--text-muted);">
                    <p style="font-size: 1.2rem; font-weight: 600; color: var(--text-main); margin-bottom: 6px;">目前沒有標記任何缺少的魚 🎉</p>
                    <p style="font-size: 0.88rem;">在「寶物魚圖鑑」中點擊任何魚或材料旁邊的『+ 缺』按鈕，即可將其加入此清單！</p>
                </td>
            </tr>
        `;
        return;
    }

    // Collect all missing items: Target fishes & Material fishes
    const missingItemsList = [];

    treasureFishList.forEach(tf => {
        const allTargetNames = tf.fishes.map(x => x.name);

        // Check target fishes (Target fishes do not add versatility recipe count)
        tf.fishes.forEach(f => {
            if (missingFishSet.has(f.name)) {
                missingItemsList.push({
                    type: "target",
                    name: f.name,
                    icon: f.icon,
                    detailText: `✨ 合成解鎖：【${f.rewardTreasure}】`,
                    parentRecipeName: `-`,
                    locations: tf.locations || [],
                    qtyStr: `<span style="color:#ffd700; font-weight:bold;">1 隻 (目標魚)</span>`,
                    isTargetFish: true
                });
            }
        });

        // Check material fishes
        tf.materials.forEach(m => {
            if (missingFishSet.has(m.name)) {
                const recipeLabel = `合成【${allTargetNames.join(" + ")}】`;

                missingItemsList.push({
                    type: "material",
                    name: m.name,
                    icon: m.icon,
                    detailText: `寶物：【${m.treasure}】`,
                    parentRecipeName: recipeLabel,
                    locations: m.locations || [],
                    qtyStr: `<span style="color:var(--primary); font-weight:bold;">x${m.qty} (材料魚)</span>`,
                    isTargetFish: false
                });
            }
        });
    });

    // Deduplicate by name if same material appears in multiple recipes, merging locations and counting appearances
    const mergedMissingMap = new Map();
    missingItemsList.forEach(item => {
        if (!mergedMissingMap.has(item.name)) {
            mergedMissingMap.set(item.name, {
                ...item,
                parentRecipes: item.parentRecipeName !== '-' ? [item.parentRecipeName] : [],
                allLocations: [...(item.locations || [])],
                recipeCount: item.parentRecipeName !== '-' ? 1 : 0
            });
        } else {
            const existing = mergedMissingMap.get(item.name);
            // If item has a material role (is used as material in a recipe), make sure type shows material or both
            if (item.type === "material") {
                existing.type = "material";
            }
            if (item.parentRecipeName !== '-' && !existing.parentRecipes.includes(item.parentRecipeName)) {
                existing.parentRecipes.push(item.parentRecipeName);
                existing.recipeCount += 1;
            }
            (item.locations || []).forEach(loc => {
                if (!existing.allLocations.some(l => l.friend === loc.friend && l.tank === loc.tank)) {
                    existing.allLocations.push(loc);
                }
            });
        }
    });

    // Helper to get normalized family key (e.g., "瞌睡蝸牛" from "桃粉瞌睡蝸牛" / "樹棕瞌睡蝸牛")
    function getFishFamilyKey(name) {
        if (!name) return "";
        // Common suffixes/keywords for fish families
        const keywords = ["瞌睡蝸牛", "斑馬燈", "孔雀魚", "神仙魚", "金魚", "熊貓金魚", "泡螺", "雪橇犬", "鼠寶寶", "蝴蝶魚", "海蛾", "鱂魚", "劍魚", "裙魚", "小鯉"];
        for (const kw of keywords) {
            if (name.includes(kw)) return kw;
        }
        // Fallback: use last 2 characters as family key
        return name.length >= 2 ? name.slice(-2) : name;
    }

    // Sort by recipeCount descending, then secondary sort by family group & name
    const finalMissingList = Array.from(mergedMissingMap.values()).sort((a, b) => {
        if (b.recipeCount !== a.recipeCount) {
            return b.recipeCount - a.recipeCount;
        }
        // Secondary sort: group by fish family key (e.g. all 瞌睡蝸牛 together)
        const famA = getFishFamilyKey(a.name);
        const famB = getFishFamilyKey(b.name);
        if (famA !== famB) {
            return famA.localeCompare(famB, "zh-Hant");
        }
        // Tertiary sort: alphabetically by full name
        return a.name.localeCompare(b.name, "zh-Hant");
    });
    missingCountBadge.textContent = `${finalMissingList.length} 種缺少`;

    finalMissingList.forEach((item, index) => {
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid rgba(255, 255, 255, 0.08)";

        // High demand badge if appears in multiple recipes
        const isTopDemand = item.recipeCount > 1;
        const topDemandBadge = isTopDemand 
            ? `<span style="font-size:0.68rem; background:linear-gradient(135deg, #f59e0b, #ef4444); color:#fff; padding:1px 6px; border-radius:10px; font-weight:bold; box-shadow:0 0 6px rgba(245,158,11,0.5);" title="泛用性極高！共被 ${item.recipeCount} 組寶物魚配方需求">🔥 高需求 (使用於 ${item.recipeCount} 組配方)</span>` 
            : '';

        // Determine precise fish badge: Is it a top Target Fish? Does it also serve as Material?
        const isMasterTreasureFish = treasureFishList.some(tf => tf.fishes.some(f => f.name === item.name));
        let typeBadgeHTML = "";

        if (isMasterTreasureFish && item.recipeCount > 0) {
            typeBadgeHTML = `<span style="font-size:0.68rem; background:linear-gradient(135deg, #ef4444, #8b5cf6); color:#fff; padding:1px 6px; border-radius:10px; font-weight:600; white-space:nowrap;">👑 寶物魚 (亦為材料)</span>`;
        } else if (isMasterTreasureFish) {
            typeBadgeHTML = `<span style="font-size:0.68rem; background:#ef4444; color:#fff; padding:1px 6px; border-radius:10px; font-weight:600; white-space:nowrap;">👑 缺寶物魚</span>`;
        } else {
            typeBadgeHTML = `<span style="font-size:0.68rem; background:rgba(0,210,255,0.2); color:var(--primary); padding:1px 6px; border-radius:10px; font-weight:600; white-space:nowrap;">🐟 缺材料魚</span>`;
        }

        // Group location chips
        const mFriendMap = new Map();
        (item.allLocations || []).forEach(loc => {
            if (!mFriendMap.has(loc.friend)) mFriendMap.set(loc.friend, []);
            if (!mFriendMap.get(loc.friend).includes(loc.tank)) mFriendMap.get(loc.friend).push(loc.tank);
        });

        const locationChipsStr = Array.from(mFriendMap.entries()).map(([fr, tanks]) => {
            tanks.sort((a, b) => a - b);
            return `<span class="location-chip btn-copy-friend" data-friend="${fr}" style="font-size:0.75rem; background:rgba(0, 210, 255, 0.12); border-color:var(--primary); cursor:pointer; padding:3px 8px; margin-right:4px; margin-bottom:4px; display:inline-flex; align-items:center; gap:4px;" title="點擊複製姓名【${fr}】">📍 ${fr} (缸${tanks.join(",")}) 📋</span>`;
        }).join("");

        tr.innerHTML = `
            <td style="padding: 12px 14px; vertical-align: middle;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="tf-avatar" style="width:42px; height:42px; font-size:1.4rem; flex-shrink:0;">
                        ${renderAvatarHTML(item.icon, isMasterTreasureFish ? '👑' : '🐟')}
                    </div>
                    <div style="min-width:0;">
                        <div style="font-weight:700; font-size:0.98rem; color:var(--text-main); line-height:1.3; white-space:nowrap;">${item.name}</div>
                        <div style="display:flex; align-items:center; gap:6px; margin-top:4px; flex-wrap:wrap;">
                            ${typeBadgeHTML}
                            ${topDemandBadge}
                        </div>
                    </div>
                </div>
            </td>
            <td style="padding: 12px 14px; vertical-align: middle;">
                <div style="font-size:0.85rem; color:#ffd700;">${item.detailText}</div>
                <div style="font-size:0.78rem; margin-top:2px;">${item.qtyStr}</div>
            </td>
            <td style="padding: 12px 14px; vertical-align: middle; font-size:0.85rem; color:var(--text-muted);">
                <div style="display:flex; flex-wrap:wrap; gap:4px;">
                    ${item.parentRecipes.map(r => `<span style="background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.1); display:inline-block;">${r}</span>`).join("")}
                </div>
            </td>
            <td style="padding: 12px 14px; vertical-align: middle;">
                <div style="display:flex; flex-wrap:wrap; align-items:center; gap:4px;">
                    ${locationChipsStr || '<span style="color:var(--text-muted); font-size:0.78rem;">尚未設定地點</span>'}
                    <button class="location-chip location-chip-add btn-edit-missing-loc" data-name="${item.name}" style="font-size:0.72rem; padding:2px 8px;">
                        ➕ 設定地點
                    </button>
                </div>
            </td>
            <td style="padding: 12px 14px; vertical-align: middle; text-align: center;">
                <button class="btn-remove-missing btn-toggle-stamp active" data-name="${item.name}" title="解除標記" style="font-size:0.72rem;">
                    ✓ 取消缺
                </button>
            </td>
        `;

        tr.querySelector(".btn-remove-missing").addEventListener("click", () => {
            toggleMissingFish(item.name);
        });

        tr.querySelector(".btn-edit-missing-loc").addEventListener("click", () => {
            openFishLocationModal(item.name);
        });

        tr.querySelectorAll(".btn-copy-friend").forEach(chip => {
            chip.addEventListener("click", (e) => {
                e.stopPropagation();
                const friendName = chip.dataset.friend;
                if (!friendName) return;
                navigator.clipboard.writeText(friendName).then(() => {
                    showToast(`📋 已成功複製好友名稱：【${friendName}】`);
                }).catch(err => {
                    console.error("Copy failed", err);
                });
            });
        });

        missingTableBody.appendChild(tr);
    });
}

// Toast notification helper
function showToast(msg) {
    let toast = document.getElementById("toast-notification");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast-notification";
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: rgba(0, 210, 255, 0.95);
            color: #000;
            font-weight: bold;
            padding: 10px 20px;
            border-radius: 20px;
            box-shadow: 0 4px 15px rgba(0,210,255,0.4);
            z-index: 9999;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            font-size: 0.9rem;
            pointer-events: none;
            opacity: 0;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.transform = "translateX(-50%) translateY(0)";
    toast.style.opacity = "1";

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.style.transform = "translateX(-50%) translateY(100px)";
        toast.style.opacity = "0";
    }, 2200);
}

