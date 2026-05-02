let currentPage = 1;
let lastKeyword = "";

async function searchJurnal() {
    let keyword = document.getElementById("keyword").value.trim();

    if (!keyword) {
        alert("Masukkan kata kunci dulu!");
        return;
    }

    if (keyword !== lastKeyword) {
        currentPage = 1;
    }
    lastKeyword = keyword;

    let resultDiv = document.getElementById("result");
    resultDiv.innerHTML = "<p style='color:white'>🔄 Sedang mencari jurnal...</p>";

    let allData = [];

    // ======================
    // PUBMED
    // ======================
    let pubmedPromise = (async () => {
        try {
            let start = (currentPage - 1) * 3;
            let pubmedUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term=${keyword}&retmax=3&retstart=${start}`;
            let pubRes = await fetch(pubmedUrl);
            let pubData = await pubRes.json();
            let ids = pubData.esearchresult.idlist;

            if (ids.length > 0) {
                let summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`;
                let sumRes = await fetch(summaryUrl);
                let sumData = await sumRes.json();

                return ids.map(id => {
                    let p = sumData.result[id];
                    return {
                        title: p.title,
                        year: p.pubdate,
                        link: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
                        source: "PubMed"
                    };
                });
            }
        } catch (e) {
            console.warn("PubMed gagal");
        }
        return [];
    })();

    // ======================
    // SEMANTIC
    // ======================
    let semanticPromise = (async () => {
        try {
            let offset = (currentPage - 1) * 3;
            let semUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${keyword}&limit=3&offset=${offset}&fields=title,year,url`;
            let res = await fetch(semUrl);
            let data = await res.json();

            return data.data.map(p => ({
                title: p.title,
                year: p.year,
                link: p.url,
                source: "Semantic Scholar"
            }));
        } catch (e) {
            console.warn("Semantic gagal");
            return [];
        }
    })();

    // ======================
    // DOAJ
    // ======================
    let doajPromise = (async () => {
        try {
            let pageDoaj = currentPage;
            let doajUrl = `https://doaj.org/api/search/articles/${keyword}?pageSize=3&page=${pageDoaj}`;
            let res = await fetch(doajUrl);
            let data = await res.json();

            return data.results.map(item => {
                let bib = item.bibjson;
                return {
                    title: bib.title,
                    year: bib.year,
                    link: bib.link?.[0]?.url || "#",
                    source: "DOAJ"
                };
            });
        } catch (e) {
            console.warn("DOAJ gagal");
            return [];
        }
    })();

    // ======================
    // JALANKAN TANPA BLOK UI
    // ======================
    Promise.allSettled([pubmedPromise, semanticPromise, doajPromise])
        .then(results => {

            results.forEach(r => {
                if (r.status === "fulfilled") {
                    allData.push(...r.value);
                }
            });

            renderHasil(allData);
        });
}

// ======================
// RENDER HASIL (OPTIMIZED)
// ======================
function renderHasil(allData) {
    let resultDiv = document.getElementById("result");

    if (allData.length === 0) {
        resultDiv.innerHTML = "<p>Tidak ada hasil ditemukan</p>";
        return;
    }

    // ambil bookmark SEKALI SAJA
    let bookmarkData = JSON.parse(localStorage.getItem("bookmark") || "[]");

    let hasil = "";

    allData.forEach(paper => {

        let badgeClass = "";
        if (paper.source === "PubMed") badgeClass = "pubmed";
        else if (paper.source === "Semantic Scholar") badgeClass = "semantic";
        else if (paper.source === "DOAJ") badgeClass = "doaj";

        let isSaved = bookmarkData.some(item => item.link === paper.link);

        hasil += `
            <div class="card">
                <h3>${paper.title}</h3>
                <p><b>Tahun:</b> ${paper.year || "-"}</p>
                <span class="badge ${badgeClass}">${paper.source}</span>
                <br>
                <a href="${paper.link}" target="_blank">🔗 Buka Jurnal</a>
                <br><br>
                <button 
                    onclick='saveBookmark(this)' 
                    data-paper='${encodeURIComponent(JSON.stringify(paper))}'
                    ${isSaved ? "disabled" : ""}
                >
                    ${isSaved ? "✅ Tersimpan" : "⭐ Simpan"}
                </button>
            </div>
        `;
    });

    hasil += `
        <div style="margin-top:20px;">
            <button onclick="prevPage()">⬅ Prev</button>
            <span style="color:white; margin:0 10px;">Page ${currentPage}</span>
            <button onclick="nextPage()">Next ➡</button>
        </div>
    `;

    resultDiv.innerHTML = hasil;
}

// ======================
// ENTER KEY
// ======================
document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("keyword")
    .addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
            searchJurnal();
        }
    });
});

// ======================
// CLEAR INPUT
// ======================
function clearInput() {
    document.getElementById("keyword").value = "";
    document.getElementById("result").innerHTML = "";
}

// ======================
// PAGINATION
// ======================
function nextPage() {
    currentPage++;
    document.getElementById("result").innerHTML = "<p style='color:white'>🔄 Loading halaman...</p>";
    searchJurnal();
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        document.getElementById("result").innerHTML = "<p style='color:white'>🔄 Loading halaman...</p>";
        searchJurnal();
    }
}

// ======================
// BOOKMARK
// ======================
function saveBookmark(btn) {
    let data = JSON.parse(localStorage.getItem("bookmark")) || [];

    let paper = JSON.parse(decodeURIComponent(btn.getAttribute("data-paper")));

    let sudahAda = data.some(item => item.link === paper.link);

    if (sudahAda) {
        alert("Jurnal sudah disimpan!");
        return;
    }

    data.push(paper);
    localStorage.setItem("bookmark", JSON.stringify(data));

    btn.innerText = "✅ Tersimpan";
    btn.disabled = true;
}

// ======================
// TAMPILKAN BOOKMARK
// ======================
function showBookmark() {
    let data = JSON.parse(localStorage.getItem("bookmark")) || [];

    let resultDiv = document.getElementById("result");

    if (data.length === 0) {
        resultDiv.innerHTML = "<p>Tidak ada bookmark</p>";
        return;
    }

    let hasil = "<h2 style='color:white'>📚 Bookmark</h2>";

    data.forEach(paper => {
        hasil += `
            <div class="card">
                <h3>${paper.title}</h3>
                <p>${paper.year}</p>
                <a href="${paper.link}" target="_blank">Buka</a>
                <br><br>
                <button onclick="deleteBookmark('${paper.link}')">🗑️ Hapus</button>
            </div>
        `;
    });

    resultDiv.innerHTML = hasil;
}

// ======================
// DELETE BOOKMARK
// ======================
function deleteBookmark(link) {
    let data = JSON.parse(localStorage.getItem("bookmark")) || [];

    data = data.filter(item => item.link !== link);

    localStorage.setItem("bookmark", JSON.stringify(data));

    showBookmark();
}