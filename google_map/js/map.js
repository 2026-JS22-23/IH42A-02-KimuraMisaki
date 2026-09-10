// =========================================================
// 1. 定数
// =========================================================


// ### タイムライン設定

const TIMELINE_MIN_YEAR = 1978;
const TIMELINE_MAX_YEAR = 2026;

// タイムラインの開始年
const TIMELINE_START_YEAR = 1978;
// タイムラインの終了年
const TIMELINE_END_YEAR = 2026;
// 1年進める間隔（ミリ秒）
const TIMELINE_INTERVAL = 500;



// =========================================================
// 2. アプリケーション状態
// =========================================================


// ### Google Maps 初期化

let map;

// 世界遺産データ
let heritageData = [];
// 現在のカテゴリ・タイムライン条件で表示するデータ
let filteredHeritageData = [];

// 現在選択されているカテゴリ
let selectedCategories = [
    "Cultural",
    "Natural",
    "Mixed"
];

// 現在選択されている世界遺産
let selectedHeritage = null;
// 現在選択されているcenterマーカー
let selectedCenterMarker = null;


// 現在MarkerClustererに登録されているcenterマーカー
let clusteredMarkers = new Set();
let myMarkerClusterer = null;


let centerMarkers = [];
// 現在表示しているcomponentsマーカー
let componentMarkers = [];
// 現在表示しているcomponents同士を結ぶ線
let componentLines = [];


// 現在選択されている年
let currentYear = TIMELINE_MAX_YEAR;
// 現在表示している説明言語
let currentLanguage = "ja";

// ### タイムライン再生

// 再生中かどうか
let isTimelinePlaying = false;
// 再生用タイマー
let timelineTimer = null;


// =========================================================
// 3. 初期化
// =========================================================
async function initMap() {

    // パネル開閉ボタンの設定
    setupPanelToggle();

    // 詳細パネルの設定
    setupDetailPanel();

    // カテゴリフィルタの登録
    setupCategoryFilter();

    // Google Mapsの「maps」ライブラリを読み込む
    const { Map } = await google.maps.importLibrary("maps");

    const { AdvancedMarkerElement } =
        await google.maps.importLibrary("marker");


    // 地図の初期位置
    const center = {
        lat: 35.681236,
        lng: 139.767125
    };


    // -----------------------------------------------------
    // Google Mapsを生成
    // -----------------------------------------------------
    map = new Map(
        document.getElementById("map"),
        {
            center: center,

            // 世界全体を表示
            zoom: 4,

            // ズーム範囲
            minZoom: 3,
            maxZoom: 18,

            // ---------------------------------------------
            // 世界地図の表示範囲を制限
            // ---------------------------------------------
            restriction: {
                latLngBounds: {
                    north: 85,
                    south: -85,
                    west: -180,
                    east: 180
                },

                // 範囲外へドラッグできないようにする
                strictBounds: true
            },

            // Map ID
            mapId: "DEMO_MAP_ID",

            // 地図の表示設定
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,

            // Google標準のズームボタンは使わない
            // 自分たちで作ったボタンを使用する
            zoomControl: false,

            // マウス・タッチで地図を操作可能
            gestureHandling: "greedy"
        }
    );

    // -----------------------------------------------------
    // 独自ズームボタン
    // -----------------------------------------------------

    const zoomInButton = document.getElementById("zoom-in");
    const zoomOutButton = document.getElementById("zoom-out");


    // ズームイン
    zoomInButton.addEventListener("click", () => {

        const currentZoom = map.getZoom();

        if (currentZoom !== undefined) {
            map.setZoom(
                Math.min(
                    currentZoom + 1,
                    18
                )
            );
        }

    });


    // ズームアウト
    zoomOutButton.addEventListener("click", () => {

        const currentZoom = map.getZoom();

        if (currentZoom !== undefined) {
            map.setZoom(
                Math.max(
                    currentZoom - 1,
                    3
                )
            );
        }

    });


    // 地図の空き領域クリックで選択を解除
    map.addListener("click", () => {
        resetSelection();
    });


    // GeoJSONを読み込む
    await loadHeritageData();

    // 初期状態では全世界遺産を表示
    filteredHeritageData = [...heritageData];

    // 世界遺産一覧を生成
    renderHeritageList(filteredHeritageData);

    // centerマーカー作成
    await createCenterMarkers(AdvancedMarkerElement);

    // タイムラインの設定
    setupTimeline();
}



// =========================================================
// 4. データ
// =========================================================

// 世界遺産データ読み込み
async function loadHeritageData() {

    try {

        const response =
            await fetch("data/heritage.json");

        if (!response.ok) {
            throw new Error(
                `HTTP error: ${response.status}`
            );
        }

        heritageData = await response.json();

        console.log(
            "世界遺産データ:",
            heritageData
        );

    } catch (error) {

        console.error(
            "世界遺産データの読み込みに失敗しました。",
            error
        );

    }

}

// =========================================================
// 5. データ処理
// =========================================================

// -----------------------------------------------------
// 現在年とカテゴリで世界遺産をフィルタリングする
// -----------------------------------------------------
function updateHeritageFilter() {

    filteredHeritageData =
        heritageData.filter((heritage) => {


            // カテゴリ条件
            const categoryMatch =
                selectedCategories.includes(
                    heritage.category
                );


            // 登録年条件
            const yearMatch =
                heritage.year <= currentYear;


            // 両方の条件を満たすものだけ表示
            return categoryMatch && yearMatch;

        });

    // 新しく追加された世界遺産のIDだけ取得
    // const newlyAddedIds =
    //     newlyAddedHeritage.map(
    //         (heritage) => heritage.id
    //     );


    // 世界遺産一覧を更新
    renderHeritageList(filteredHeritageData);



    // 地図マーカーを更新
    updateCenterMarkersByFilter();


    // カテゴリ別件数を現在年基準で更新
    updateCategoryCounts();

    // ---------------------------------------------
    // 総合ヒット件数（例: 1,273 件）を動的更新
    // ---------------------------------------------
    const resultCountEl = document.querySelector(".result-count");

    if (resultCountEl) {
        const count = filteredHeritageData.length;

        // 3桁カンマ区切りで表示（例: 1,273 件）
        resultCountEl.textContent = `${count.toLocaleString()} 件`;
    }


    console.log(
        "現在年:",
        currentYear,
        "表示件数:",
        filteredHeritageData.length
    );

}


// -----------------------------------------------------
// 前回の年から現在の年までに新しく登録された世界遺産を取得
// -----------------------------------------------------
function getNewlyVisibleHeritage(oldYear, newYear) {

    // 年を戻した場合は新規追加なし
    if (newYear <= oldYear) {
        return [];
    }


    // ---------------------------------------------
    // oldYearより後、
    // newYear以下に登録された世界遺産を取得
    // ---------------------------------------------
    return heritageData.filter((heritage) => {

        // 前回の年には存在していなかった
        const isNew =
            heritage.year > oldYear &&
            heritage.year <= newYear;


        // 現在選択されているカテゴリ
        const categoryMatch =
            selectedCategories.includes(
                heritage.category
            );


        return isNew && categoryMatch;

    });

}


// -----------------------------------------------------
// カテゴリフィルタを更新
// -----------------------------------------------------
function updateCategoryFilter() {

    const checkboxes =
        document.querySelectorAll(
            ".category-item input[type='checkbox']"
        );


    // ---------------------------------------------
    // チェックされているカテゴリを取得
    // ---------------------------------------------

    selectedCategories = [];

    checkboxes.forEach((checkbox) => {

        if (checkbox.checked) {

            selectedCategories.push(
                checkbox.dataset.category
            );

        }

    });


    console.log(
        "選択カテゴリ:",
        selectedCategories
    );


    // ---------------------------------------------
    // 世界遺産データをフィルタリング
    // ---------------------------------------------

    filteredHeritageData =
        heritageData.filter((heritage) => {

            return selectedCategories.includes(
                heritage.category
            );

        });


    console.log(
        "フィルタ後の世界遺産:",
        filteredHeritageData
    );

    // 現在年 + カテゴリの両方で再計算
    updateHeritageFilter();

}


// -----------------------------------------------------
// カテゴリごとの件数を更新する（現在年基準）
// -----------------------------------------------------
function updateCategoryCounts() {

    // 現在年（currentYear）以前に登録されたデータのみ対象とする
    const currentYearHeritages = heritageData.filter(
        (heritage) => heritage.year <= currentYear
    );

    // ---------------------------------------------
    // 各カテゴリごとの件数を集計
    // ---------------------------------------------
    const counts = {
        Cultural: 0,
        Natural: 0,
        Mixed: 0
    };

    currentYearHeritages.forEach((heritage) => {
        if (counts.hasOwnProperty(heritage.category)) {
            counts[heritage.category]++;
        }
    });

    // ---------------------------------------------
    // DOM（<span class="category-count">）へ反映
    // ---------------------------------------------
    const categoryItems = document.querySelectorAll(".category-item");

    categoryItems.forEach((item) => {
        const checkbox = item.querySelector("input[type='checkbox']");
        const countSpan = item.querySelector(".category-count");

        if (checkbox && countSpan) {
            const category = checkbox.dataset.category;
            const count = counts[category] || 0;

            countSpan.textContent = `${count}`;
        }
    });
}


// =========================================================
// 6. 世界遺産一覧
// =========================================================

// -----------------------------------------------------
// 世界遺産一覧を生成する
// （引数がない場合は全データ heritageData を使用）
// -----------------------------------------------------
function renderHeritageList(heritageData, newlyAddedIds = []) {

    const list =
        document.getElementById("heritage-list");


    // 一覧を一度空にする
    list.replaceChildren();


    // 世界遺産データを1件ずつ処理
    heritageData.forEach((heritage, index) => {

        // ---------------------------------------------
        // 一覧アイテム
        // ---------------------------------------------

        const item =
            document.createElement("button");

        item.type = "button";

        item.className = "heritage-item";


        // ---------------------------------------------
        // 表示する番号
        // ---------------------------------------------

        const number =
            document.createElement("span");

        number.className =
            "heritage-item-number";

        number.textContent =
            String(index + 1).padStart(2, "0");


        // ---------------------------------------------
        // 名前・国・登録年
        // ---------------------------------------------

        const content =
            document.createElement("span");

        content.className =
            "heritage-item-content";


        const name =
            document.createElement("span");

        name.className =
            "heritage-item-name";

        name.textContent =
            heritage.name_ja || heritage.name;


        const meta =
            document.createElement("span");

        meta.className =
            "heritage-item-meta";


        const countries =
            heritage.countries_ja ||
            heritage.countries ||
            [];


        meta.textContent =
            `${countries.join(" · ")} · ${heritage.year}`;


        content.appendChild(name);
        content.appendChild(meta);


        // ---------------------------------------------
        // 矢印
        // ---------------------------------------------

        const arrow =
            document.createElement("span");

        arrow.className =
            "heritage-item-arrow";

        arrow.textContent = "→";


        // ---------------------------------------------
        // アイテムに追加
        // ---------------------------------------------

        item.appendChild(number);
        item.appendChild(content);
        item.appendChild(arrow);


        // ---------------------------------------------
        // クリックイベント
        // ---------------------------------------------

        item.addEventListener("click", () => {

            selectHeritageFromList(heritage);

        });


        // ---------------------------------------------
        // 一覧に追加
        // ---------------------------------------------

        list.appendChild(item);

    });


    console.log(
        "世界遺産一覧を生成しました。",
        heritageData.length,
        "件"
    );

}


// -----------------------------------------------------
// 一覧から世界遺産を選択する
// -----------------------------------------------------
async function selectHeritageFromList(heritage) {

    const { AdvancedMarkerElement } =
        await google.maps.importLibrary("marker");


    // 対応するcenterマーカーを探す
    const marker =
        centerMarkers.find((marker) => {

            return marker.heritageId === heritage.id;

        });


    // 世界遺産を選択
    selectHeritage(
        heritage,
        marker,
        AdvancedMarkerElement
    );

}


// =========================================================
// 7. マーカー
// =========================================================

// -----------------------------------------------------
// centerマーカー作成
// -----------------------------------------------------
async function createCenterMarkers(AdvancedMarkerElement) {

    centerMarkers = [];

    heritageData.forEach((heritage) => {

        // centerが存在しないデータはスキップ
        if (!heritage.center) {
            return;
        }


        // centerの座標
        const position = {
            lat: heritage.center.lat,
            lng: heritage.center.lng
        };


        // -------------------------------------------------
        // Center MarkerのHTML
        // -------------------------------------------------

        const markerContent = document.createElement("div");

        // カテゴリに応じたクラスを追加
        markerContent.className =
            `center-marker ${getCategoryMarkerClass(heritage.category)}`;

        // 構成資産数
        const componentCount =
            heritage.components?.length || 0;

        // HTML生成
        markerContent.innerHTML = `
            <div class="center-marker-dot"></div>
            <span class="center-marker-label">
                ${heritage.name}
            </span>

            ${
                componentCount > 1
                    ? `<span class="components-count">
                        ${componentCount}
                    </span>`
                    : ""
            }
        `;

        const marker = new AdvancedMarkerElement({

            position: position,

            // title: heritage.name,

            content: markerContent,

            zIndex: 1
        });

        // 世界遺産IDを紐付ける
        marker.heritageId = heritage.id;

        marker.heritage = heritage;


        // -------------------------------------------------
        // マーカークリック
        // -------------------------------------------------

        marker.addListener("gmp-click", () => {


            selectHeritage(
                heritage,
                marker,
                AdvancedMarkerElement
            );


            console.log(
                "選択された世界遺産:",
                selectedHeritage
            );

        });

        centerMarkers.push(marker);

    });


    // =================================================
    // Marker Clustering
    // =================================================

    const { MarkerClusterer, DefaultRenderer } = window.markerClusterer;

    myMarkerClusterer = new MarkerClusterer({

        map: map,

        markers: centerMarkers,

        // 標準のレンダラーを使用（エラーを出さない）
        renderer: new DefaultRenderer()
    });

}


// -----------------------------------------------------
// centerマーカーをカテゴリ・タイムラインで更新
// -----------------------------------------------------
function updateCenterMarkersByFilter() {

    // ---------------------------------------------
    // ポップアニメーション状態をリセット
    // ---------------------------------------------

    resetPopAnimations();


    // ---------------------------------------------
    // 現在表示すべきマーカーを取得
    // ---------------------------------------------

    const visibleMarkers = new Set();

    centerMarkers.forEach((marker) => {

        const heritage = marker.heritage;

        if (!heritage) {
            return;
        }


        const isVisible =
            filteredHeritageData.some(
                (item) => item.id === heritage.id
            );


        if (isVisible) {

            visibleMarkers.add(marker);

        }

    });


    // ---------------------------------------------
    // 新しく追加するマーカー
    // ---------------------------------------------

    const newMarkers = [];

    visibleMarkers.forEach((marker) => {

        // まだクラスタに入っていない
        if (!clusteredMarkers.has(marker)) {

            newMarkers.push(marker);

        }

    });


    // ---------------------------------------------
    // 不要になったマーカー
    // ---------------------------------------------

    const removedMarkers = [];

    clusteredMarkers.forEach((marker) => {

        // 現在の表示対象に存在しない
        if (!visibleMarkers.has(marker)) {

            removedMarkers.push(marker);

        }

    });


    // ---------------------------------------------
    // 新しいマーカーだけ追加
    // ---------------------------------------------

    if (newMarkers.length > 0) {

        myMarkerClusterer.addMarkers(
            newMarkers
        );

    }


    // ---------------------------------------------
    // 不要になったマーカーだけ削除
    // ---------------------------------------------

    if (removedMarkers.length > 0) {

        myMarkerClusterer.removeMarkers(
            removedMarkers
        );

    }


    // ---------------------------------------------
    // 現在のクラスタ状態を更新
    // ---------------------------------------------

    newMarkers.forEach((marker) => {

        clusteredMarkers.add(marker);

    });


    removedMarkers.forEach((marker) => {

        clusteredMarkers.delete(marker);

    });


    console.log(
        "追加:",
        newMarkers.length,
        "削除:",
        removedMarkers.length,
        "現在:",
        clusteredMarkers.size
    );

}


// -----------------------------------------------------
// centerマーカー選択時、状態を更新（）
// -----------------------------------------------------
function updateCenterMarkerState(selectedMarker) {

    centerMarkers.forEach((marker) => {

        const content = marker.content;

        if (!content) {
            return;
        }


        // ---------------------------------------------
        // 選択されたマーカー
        // ---------------------------------------------

        if (marker === selectedMarker) {

            content.classList.add("is-selected");

            content.classList.remove("is-dimmed");

        }

        // ---------------------------------------------
        // その他のマーカー
        // ---------------------------------------------

        else {

            content.classList.remove("is-selected");

            content.classList.add("is-dimmed");

        }

    });


    selectedCenterMarker = selectedMarker;

}


// -----------------------------------------------------
// Center Markerのカテゴリクラスを取得
// -----------------------------------------------------
function getCategoryMarkerClass(category) {

    switch (category) {

        case "Cultural":
            return "cultural-marker";

        case "Natural":
            return "natural-marker";

        case "Mixed":
            return "mixed-marker";

        default:
            return "";

    }

}


// =========================================================
// 8. 世界遺産選択
// =========================================================

// -----------------------------------------------------
// 世界遺産を選択する
// -----------------------------------------------------
function selectHeritage(
    heritage,
    marker,
    AdvancedMarkerElement
) {

    // 選択された世界遺産を保存
    selectedHeritage = heritage;


    // centerマーカーの選択状態を更新
    if (marker) {
        updateCenterMarkerState(marker);
    }


    // componentsを表示
    showComponents(
        heritage,
        AdvancedMarkerElement
    );


    // components全体が見えるようにする
    fitMapToComponents(heritage);


    // 詳細パネルを表示
    showDetailPanel(heritage);


    console.log(
        "選択された世界遺産:",
        selectedHeritage
    );

}


// -----------------------------------------------------
// 選択状態をリセット（解除）する
// -----------------------------------------------------
function resetSelection() {
    // 選択データをクリア
    selectedHeritage = null;
    selectedCenterMarker = null;

    // すべてのcenterマーカーから選択・減衰クラスを削除
    centerMarkers.forEach((marker) => {
        const content = marker.content;
        if (content) {
            content.classList.remove("is-selected", "is-dimmed");
        }
    });

    // 描画中のcomponentsと線を削除
    clearComponents();

    // 詳細パネルを閉じる（is-detail クラスを削除して検索パネルに戻す）
    const sidePanel = document.querySelector(".side-panel");
    if (sidePanel) {
        sidePanel.classList.remove("is-detail");
    }
}


// =========================================================
// 9. Components
// =========================================================

// -----------------------------------------------------
// componentsを地図上に表示する
// -----------------------------------------------------
function showComponents(
    heritage,
    AdvancedMarkerElement
) {

    // 前のcomponentsを削除
    clearComponents();


    // componentsがない場合
    if (
        !heritage.components ||
        heritage.components.length === 0
    ) {

        console.log(
            "この世界遺産にはcomponentsがありません。"
        );

        return;

    }


    // -----------------------------------------------------
    // componentsマーカーを作成
    // -----------------------------------------------------

    heritage.components.forEach((component) => {

        // 座標がない場合はスキップ
        if (
            component.lat === undefined ||
            component.lng === undefined
        ) {
            return;
        }

        // components専用のHTML
        const element = document.createElement("div");

        element.className = "component-marker";

        element.innerHTML = `
            <span class="component-marker-dot"></span>
            <span class="component-marker-label">
                ${component.name}
            </span>
        `;


        // AdvancedMarkerElement
        const marker = new AdvancedMarkerElement({

            map: map,

            position: {
                lat: component.lat,
                lng: component.lng
            },

            content: element,

            zIndex: 3

            // title: component.name

        });


        // componentsはcenterとは別物なので、
        // 世界遺産選択処理は行わない
        marker.addListener("gmp-click", () => {

            console.log(
                "選択された構成地点:",
                component
            );

        });


        componentMarkers.push(marker);

    });


    // -----------------------------------------------------
    // components同士を線で結ぶ
    // -----------------------------------------------------

    createComponentLines(heritage);

}


// -----------------------------------------------------
// componentsを地図から削除する
// -----------------------------------------------------
function clearComponents() {

    // -----------------------------------------------------
    // componentsマーカーを削除
    // -----------------------------------------------------

    componentMarkers.forEach((marker) => {

        marker.map = null;

    });

    componentMarkers = [];


    // -----------------------------------------------------
    // components同士を結ぶ線を削除
    // -----------------------------------------------------

    componentLines.forEach((line) => {

        line.setMap(null);

    });

    componentLines = [];

}


// -----------------------------------------------------
// components同士を線で結ぶ
// -----------------------------------------------------
function createComponentLines(heritage) {

    if (
        !heritage.components ||
        heritage.components.length < 2
    ) {

        return;

    }


    // componentsの座標を取得
    const path = heritage.components.map(
        (component) => ({
            lat: component.lat,
            lng: component.lng
        })
    );


    // Polylineを作成
    const line = new google.maps.Polyline({

        path: path,

        geodesic: true,

        strokeColor: "#344640",

        strokeOpacity: 0.55,

        strokeWeight: 2,

        clickable: false

    });


    line.setMap(map);


    componentLines.push(line);

}


// -----------------------------------------------------
// components全体が画面に入るように地図を調整する
// -----------------------------------------------------
function fitMapToComponents(heritage) {

    // componentsがない場合
    if (
        !heritage.components ||
        heritage.components.length === 0
    ) {

        return;

    }


    // 表示範囲を作成
    const bounds = new google.maps.LatLngBounds();


    // -----------------------------------------------------
    // componentsの座標をすべて追加
    // -----------------------------------------------------

    heritage.components.forEach((component) => {

        if (
            component.lat === undefined ||
            component.lng === undefined
        ) {
            return;
        }


        bounds.extend({
            lat: component.lat,
            lng: component.lng
        });

    });


    // -----------------------------------------------------
    // componentsが1つだけの場合
    // -----------------------------------------------------

    if (heritage.components.length === 1) {

        const component = heritage.components[0];

        map.setCenter({
            lat: component.lat,
            lng: component.lng
        });

        map.setZoom(10);

        return;

    }


    // -----------------------------------------------------
    // components全体が画面に入るように調整
    // -----------------------------------------------------

    map.fitBounds(bounds, 80);

}


// =========================================================
// 10. 詳細パネル
// =========================================================

// -----------------------------------------------------
// 詳細パネルのイベント設定
// -----------------------------------------------------
function setupDetailPanel() {

    // -----------------------------------------------------
    // 戻るボタン
    // -----------------------------------------------------

    const backButton =
        document.getElementById("back-to-list");


    backButton.addEventListener("click", () => {

        const sidePanel =
            document.querySelector(".side-panel");

        sidePanel.classList.remove("is-detail");

    });


    // -----------------------------------------------------
    // 言語タブ
    // -----------------------------------------------------

    const languageTabs =
        document.querySelectorAll(".language-tab");


    languageTabs.forEach((tab) => {

        tab.addEventListener("click", () => {

            const language =
                tab.dataset.language;

            setDescriptionLanguage(language);

        });

    });

}


// -----------------------------------------------------
// 詳細パネルを表示する
// -----------------------------------------------------
function showDetailPanel(heritage) {

    // -----------------------------------------------------
    // 詳細パネルに表示する要素を取得
    // -----------------------------------------------------

    const sidePanel =
        document.querySelector(".side-panel");

    const detailImage =
        document.getElementById("detail-image");

    const placeholder =
        document.getElementById("detail-image-placeholder");

    const title_en =
        document.getElementById("detail-title-en");

    const title_ja =
        document.getElementById("detail-title-ja");

    const eyebrow =
        document.getElementById("detail-eyebrow");

    const location =
        document.getElementById("detail-location");

    const year =
        document.getElementById("detail-year");

    const category =
        document.getElementById("detail-category");

    const criteria =
        document.getElementById("detail-criteria");

    const descriptionJa =
        document.getElementById("detail-description-ja");

    const descriptionEn =
        document.getElementById("detail-description-en");

    const componentsCount =
        document.getElementById("detail-components-count");

    const componentsLists =
        document.getElementById("components-lists");


    // -----------------------------------------------------
    // データを表示
    // -----------------------------------------------------

    // 画像
    if (
        heritage.images &&
        heritage.images.length > 0
    ) {

        detailImage.src = heritage.images[0];

        detailImage.alt =
            heritage.name_ja || heritage.name;

        detailImage.style.display = "block";
        placeholder.style.display = "none";

    } else {

        detailImage.removeAttribute("src");

        detailImage.alt = "";

        detailImage.style.display = "none";
        placeholder.style.display = "flex";

    }

    title_en.textContent =
        heritage.name || "Name unknown";

    title_ja.textContent =
        heritage.name_ja || "名称不明";


    eyebrow.textContent =
        `WORLD HERITAGE · ${heritage.year}`;


    // 国名
    if (
        heritage.countries_ja &&
        heritage.countries_ja.length > 0
    ) {

        location.textContent =
            heritage.countries_ja.join(" · ");

    } else if (
        heritage.countries &&
        heritage.countries.length > 0
    ) {

        location.textContent =
            heritage.countries.join(" · ");

    } else {

        location.textContent =
            "国情報なし";

    }


    // 登録年
    year.textContent =
        heritage.year ?? "-";


    // カテゴリ
    category.textContent =
        convertCategoryName(heritage.category);


    // 登録基準
    criteria.textContent =
        heritage.criteria || "-";


    // 日本語説明
    descriptionJa.textContent =
        heritage.description_ja ||
        "日本語の説明はありません。";


    // 英語説明
    descriptionEn.textContent =
        heritage.description ||
        "No English description available.";


    // components数
    if (
        heritage.components &&
        heritage.components.length > 0
    ) {

        componentsCount.textContent =
            `${heritage.components.length}件の構成資産`;

        // componentsLists
        componentsLists.replaceChildren();

        heritage.components.forEach((component) => {

            // ない場合はスキップ
            if (
                component.name === undefined
            ) {
                componentsLists.remove();
            }

            // リストを作成し、追加する
            const element = document.createElement('li');

            element.textContent = component.name;

            componentsLists.appendChild(element);

        });

    } else {

        componentsCount.textContent =
            "構成資産なし";

        componentsLists.remove();

    }


    // -----------------------------------------------------
    // 日本語タブを初期状態にする
    // -----------------------------------------------------

    setDescriptionLanguage("ja");


    // -----------------------------------------------------
    // 詳細モードへ切り替える
    // -----------------------------------------------------

    sidePanel.classList.add("is-detail");

}


// -----------------------------------------------------
// 説明言語を切り替える
// -----------------------------------------------------
function setDescriptionLanguage(language) {

    const descriptionJa =
        document.getElementById("detail-description-ja");

    const descriptionEn =
        document.getElementById("detail-description-en");

    const tabs =
        document.querySelectorAll(".language-tab");


    // -----------------------------------------------------
    // 日本語
    // -----------------------------------------------------

    if (language === "ja") {

        descriptionJa.style.display = "block";
        descriptionEn.style.display = "none";

    }


    // -----------------------------------------------------
    // English
    // -----------------------------------------------------

    else {

        descriptionJa.style.display = "none";
        descriptionEn.style.display = "block";

    }


    // -----------------------------------------------------
    // タブの選択状態
    // -----------------------------------------------------

    tabs.forEach((tab) => {

        if (
            tab.dataset.language === language
        ) {

            tab.classList.add("is-active");

        } else {

            tab.classList.remove("is-active");

        }

    });


    currentLanguage = language;

}


// -----------------------------------------------------
// カテゴリ名を日本語に変換
// -----------------------------------------------------
function convertCategoryName(category) {

    switch (category) {

        case "Cultural":
            return "文化遺産";

        case "Natural":
            return "自然遺産";

        case "Mixed":
            return "複合遺産";

        default:
            return category || "-";

    }

}


// =========================================================
// 11. カテゴリUI
// =========================================================

// -----------------------------------------------------
// カテゴリフィルタの設定
// -----------------------------------------------------
function setupCategoryFilter() {

    const checkboxes =
        document.querySelectorAll(
            ".category-item input[type='checkbox']"
        );


    checkboxes.forEach((checkbox) => {

        checkbox.addEventListener("change", () => {

            updateCategoryFilter();

        });

    });

}


// =========================================================
// 12. サイドパネルUI
// =========================================================

// -----------------------------------------------------
// サイドパネル開閉ボタンの設定
// -----------------------------------------------------
function setupPanelToggle() {

    const toggleButton =
        document.querySelector(".panel-toggle");

    const main =
        document.querySelector(".main");


    // 要素が存在しない場合は何もしない
    if (!toggleButton || !main) {
        return;
    }


    // -----------------------------------------------------
    // パネル開閉
    // -----------------------------------------------------

    toggleButton.addEventListener("click", () => {

        main.classList.toggle("panel-closed");


        // -------------------------------------------------
        // ボタンの表示を変更
        // -------------------------------------------------

        if (main.classList.contains("panel-closed")) {

            toggleButton.textContent = "›";

            toggleButton.setAttribute(
                "aria-label",
                "パネルを開く"
            );

        } else {

            toggleButton.textContent = "‹";

            toggleButton.setAttribute(
                "aria-label",
                "パネルを閉じる"
            );

        }


        // -------------------------------------------------
        // Google Mapsの表示サイズを再計算
        // -------------------------------------------------

        setTimeout(() => {

            if (map) {
                google.maps.event.trigger(
                    map,
                    "resize"
                );
            }

        }, 350);

    });

}


// =========================================================
// 13. タイムラインUI
// =========================================================

// -----------------------------------------------------
// タイムラインの設定
// -----------------------------------------------------
function setupTimeline() {

    const track =
        document.querySelector(".controller-track");

    const thumb =
        document.querySelector(".controller-thumb");

    if (!track || !thumb) {
        return;
    }


    // -----------------------------------------------------
    // タイムラインをクリックしたとき
    // -----------------------------------------------------

    track.addEventListener("click", (event) => {

        const rect =
            track.getBoundingClientRect();

        // クリック位置を0～1に変換
        let ratio =
            (event.clientX - rect.left) / rect.width;

        // 範囲外にならないようにする
        ratio = Math.max(0, Math.min(1, ratio));


        // クリック位置から年を計算
        const year =
            Math.round(
                TIMELINE_MIN_YEAR +
                (TIMELINE_MAX_YEAR - TIMELINE_MIN_YEAR) * ratio
            );


        updateCurrentYear(year);

    });


    // -----------------------------------------------------
    // 再生ボタン
    // -----------------------------------------------------

    const playButton =
        document.querySelector(".play-button");


    playButton.addEventListener("click", () => {

        if (isTimelinePlaying) {

            stopTimeline();

        } else {

            startTimeline();

        }

    });


    // 初期表示
    updateCurrentYear(currentYear);

}


// -----------------------------------------------------
// 現在年を更新する
// -----------------------------------------------------
function updateCurrentYear(year) {

    // ---------------------------------------------
    // 前回の年を保存
    // ---------------------------------------------

    const oldYear = currentYear;


    // ---------------------------------------------
    // 現在年を更新
    // (年を範囲内に制限)
    // -----------------------------------------------------

    currentYear =
        Math.max(
            TIMELINE_MIN_YEAR,
            Math.min(
                TIMELINE_MAX_YEAR,
                year
            )
        );


    // ---------------------------------------------
    // 年表示を更新
    // ---------------------------------------------

    // 1978～2026の中で何％の位置か計算
    const ratio =
        (currentYear - TIMELINE_MIN_YEAR) /
        (TIMELINE_MAX_YEAR - TIMELINE_MIN_YEAR);


    const percentage =
        ratio * 100;


    // -----------------------------------------------------
    // タイムラインコントローラー
    // -----------------------------------------------------

    const controllerThumb =
        document.querySelector(".controller-thumb");

    const controllerProgress =
        document.querySelector(".controller-progress");

    if (controllerThumb) {

        controllerThumb.style.left =
            `${percentage}%`;

        controllerThumb.style.right =
            "auto";

    }

    if (controllerProgress) {

        controllerProgress.style.width =
            `${percentage}%`;

    }


    // -----------------------------------------------------
    // コントローラーの現在年
    // -----------------------------------------------------

    const controllerYear =
        document.querySelector(
            ".controller-header strong"
        );

    if (controllerYear) {

        controllerYear.textContent =
            currentYear;

    }


    // -----------------------------------------------------
    // 左パネルの現在年
    // -----------------------------------------------------

    const rangePosition =
        document.querySelector(
            ".range-position"
        );

    if (rangePosition) {

        rangePosition.style.left =
            `${percentage}%`;

    }


    const rangeYear =
        document.querySelector(
            ".range-position span"
        );

    if (rangeYear) {

        rangeYear.textContent =
            currentYear;

    }


    // -----------------------------------------------------
    // 左パネル「○○までの登録」
    // -----------------------------------------------------

    const timelineLabel =
        document.querySelector(
            ".timeline-label strong"
        );

    if (timelineLabel) {

        timelineLabel.textContent =
            currentYear;

    }


    // -----------------------------------------------------
    // 地図上の年表示
    // -----------------------------------------------------

    const mapYear =
        document.querySelector(
            ".map-year strong"
        );

    if (mapYear) {

        mapYear.textContent =
            `${TIMELINE_MIN_YEAR} — ${currentYear}`;

    }


    // ---------------------------------------------
    // 新しく表示された世界遺産を取得
    // ---------------------------------------------

    const newHeritage =
        getNewlyVisibleHeritage(
            oldYear,
            currentYear
        );


    // ---------------------------------------------
    // 世界遺産の表示条件を更新
    // ---------------------------------------------

    updateHeritageFilter();


    // ---------------------------------------------
    // 新規マーカーだけポップ
    // ---------------------------------------------

    if (newHeritage.length > 0) {

        requestAnimationFrame(() => {

            requestAnimationFrame(() => {

                // ポップアニメーション
                animateNewHeritage(
                    newHeritage
                );

            });

        });

    }


    console.log(
        "現在年:",
        currentYear,
        "新規登録:",
        newHeritage.length,
        "件"
    );

}


// -----------------------------------------------------
// タイムライン再生開始
// -----------------------------------------------------
function startTimeline() {

    // すでに再生中なら何もしない
    if (isTimelinePlaying) {
        return;
    }


    // -----------------------------------------------------
    // 2026年まで到達していた場合
    // -----------------------------------------------------

    if (currentYear >= TIMELINE_END_YEAR) {

        // 最初から再生
        updateCurrentYear(
            TIMELINE_START_YEAR
        );

    }


    // 再生状態
    isTimelinePlaying = true;


    // ボタン表示を変更
    updatePlayButton();


    // -----------------------------------------------------
    // 1年ずつ進める
    // -----------------------------------------------------

    timelineTimer =
        setInterval(() => {

            if (
                currentYear >=
                TIMELINE_END_YEAR
            ) {

                stopTimeline();

                return;

            }


            updateCurrentYear(
                currentYear + 1
            );

        }, TIMELINE_INTERVAL);

}


// -----------------------------------------------------
// タイムライン停止処理
// -----------------------------------------------------
function stopTimeline() {

    // 再生タイマーを停止
    if (timelineTimer !== null) {

        clearInterval(
            timelineTimer
        );

        timelineTimer = null;

    }


    // 再生状態を解除
    isTimelinePlaying = false;


    // ボタン表示を更新
    updatePlayButton();

}


// -----------------------------------------------------
// ▶を「停止ボタン」に変える
// -----------------------------------------------------
function updatePlayButton() {

    const playButton =
        document.querySelector(".play-button");


    if (!playButton) {
        return;
    }


    if (isTimelinePlaying) {

        playButton.textContent = "■";

        playButton.setAttribute(
            "aria-label",
            "タイムラインを停止"
        );

    } else {

        playButton.textContent = "▶";

        playButton.setAttribute(
            "aria-label",
            "タイムラインを再生"
        );

    }

}



// =========================================================
// 14. アニメーション
// =========================================================

// -----------------------------------------------------
// すべてのポップアニメーション状態をリセット
// -----------------------------------------------------
function resetPopAnimations() {

    centerMarkers.forEach((marker) => {

        if (!marker.content) {
            return;
        }

        marker.content.classList.remove("is-pop");

    });

}


// -----------------------------------------------------
// 新しく表示された世界遺産をポップ表示
// -----------------------------------------------------

function animateNewHeritage(newHeritage) {

    newHeritage.forEach((heritage) => {

        // 対応するcenterマーカーを探す
        const marker =
            centerMarkers.find((marker) => {

                return marker.heritageId === heritage.id;

            });


        // マーカーが存在しない場合
        if (!marker || !marker.content) {
            return;
        }


        // -------------------------------------------------
        // ポップアニメーション開始
        // -------------------------------------------------
        marker.content.classList.add("is-pop");


        // -------------------------------------------------
        // アニメーション終了後にクラスを削除
        // -------------------------------------------------
        marker.content.addEventListener(
            "animationend",
            () => {

                marker.content.classList.remove(
                    "is-pop"
                );

            },
            { once: true }
        );

    });

}


// =========================================================
// 15. 起動
// =========================================================

// -----------------------------------------------------
// Google Maps APIの読み込み完了後に実行
// -----------------------------------------------------
window.addEventListener("load", () => {

    initMap();

});