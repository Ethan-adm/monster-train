// --- DECK BUILDER LOGIC ---
let monDeckPersonnalise = [];
const LIMITES_ETOILES = { 1: 15, 2: 19, 3: 15, 4: 9, 5: 2 };
let compteurEtoiles = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
const GENRES = ['Humain', 'Dragon', 'Fantasy', 'Dark fantasy', 'Mythologie', 'Légende urbaine', 'Apocalypse', 'Aztec'];
let catalogueComplet = [];

function genererCatalogue() {
    GENRES.forEach(g => { for(let e=1; e<=5; e++) catalogueComplet.push({ genre: g, etoiles: e }); });
}

function initDeckBuilder() {
    genererCatalogue();
    filtrerGenre('Humain');
    
    // Charger le deck depuis la session si existant
    let savedDeck = sessionStorage.getItem('monsterTrainDeck');
    if(savedDeck) {
        monDeckPersonnalise = JSON.parse(savedDeck);
        monDeckPersonnalise.forEach(c => compteurEtoiles[c.etoiles]++);
        actualiserUIBuilder();
    }
}

function filtrerGenre(genre) {
    const grid = document.getElementById('catalog-grid'); grid.innerHTML = '';
    catalogueComplet.filter(c => c.genre === genre).forEach(carte => {
        let div = document.createElement('div'); div.className = 'catalog-card';
        div.innerHTML = `<span>${carte.genre}</span><span class="stars">${'⭐'.repeat(carte.etoiles)}</span>`;
        div.onclick = () => ajouterAuDeck(carte); grid.appendChild(div);
    });
}

function ajouterAuDeck(carte) {
    if (monDeckPersonnalise.length >= 60) return;
    if (compteurEtoiles[carte.etoiles] >= LIMITES_ETOILES[carte.etoiles]) return;
    monDeckPersonnalise.push({ ...carte, id: `C${Math.random()}`, type: 'combat' });
    compteurEtoiles[carte.etoiles]++;
    actualiserUIBuilder();
}

function viderDeck() {
    monDeckPersonnalise = [];
    compteurEtoiles = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    actualiserUIBuilder();
}

function actualiserUIBuilder() {
    document.getElementById('deck-total-count').innerText = monDeckPersonnalise.length;
    for(let i=1; i<=5; i++) {
        document.getElementById(`count-${i}star`).innerText = compteurEtoiles[i];
        let pLimit = document.getElementById(`p-limit-${i}`);
        if (compteurEtoiles[i] === LIMITES_ETOILES[i]) pLimit.classList.add('limit-reached');
        else pLimit.classList.remove('limit-reached');
    }
    let list = document.getElementById('my-deck-list'); list.innerHTML = '';
    // On groupe par nom pour l'affichage propre
    monDeckPersonnalise.forEach(c => { list.innerHTML += `<div><span>${c.genre}</span> <span style="color:#f1c40f">${'⭐'.repeat(c.etoiles)}</span></div>`; });
    
    // Sauvegarde en direct
    sessionStorage.setItem('monsterTrainDeck', JSON.stringify(monDeckPersonnalise));
    document.getElementById('error-msg').style.display = 'none'; // Cache l'erreur si on modifie
}

window.onload = initDeckBuilder;

// --- AUTH LOGIC ---
function verifierInputs() {
    let pseudo = document.getElementById('pseudo').value;
    let roomCode = document.getElementById('room-code').value;
    let errorMsg = document.getElementById('error-msg');

    if (pseudo === "" || roomCode === "") {
        errorMsg.innerText = "Veuillez entrer un pseudo et un code de salon !";
        errorMsg.style.display = 'block';
        return null;
    }
    if (monDeckPersonnalise.length !== 60) {
        errorMsg.innerText = `Impossible de lancer, le deck n'est pas complet (${monDeckPersonnalise.length}/60).`;
        errorMsg.style.display = 'block';
        return null;
    }
    
    return { pseudo, roomCode };
}

function creerPartie() {
    let data = verifierInputs();
    if (data) window.location.href = `game.html?pseudo=${data.pseudo}&room=${data.roomCode}&action=create`;
}

function rejoindrePartie() {
    let data = verifierInputs();
    if (data) window.location.href = `game.html?pseudo=${data.pseudo}&room=${data.roomCode}&action=join`;
}
