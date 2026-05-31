import { auth, API_BASE } from './gcp-client.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

(function () {
  // TODO: Po vytvorení GCS bucketu nahraďte 'YOUR_GCS_BUCKET_NAME' názvom vášho bucketu
  // Napríklad: 'atelierinak-media'
  const STORAGE_BASE = 'https://storage.googleapis.com/atelierinak/';
  const container = document.querySelector('.news .row.gy-4');
  const adminContainer = document.getElementById('admin-news-controls');
  
  if (!container) return;

  // Pomocná funkcia na získanie autorizačných hlavičiek s čerstvým Firebase tokenom
  async function getHeaders(isJson = true) {
    const user = auth.currentUser;
    if (!user) return {};
    const token = await user.getIdToken();
    const headers = { 'Authorization': `Bearer ${token}` };
    if (isJson) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  }

  async function init() {
    // Sledujeme stav prihlásenia
    onAuthStateChanged(auth, async (user) => {
      let isAdmin = false;

      if (user) {
        try {
          const headers = await getHeaders();
          const checkRes = await fetch(`${API_BASE}/check-admin`, { headers });
          if (checkRes.ok) {
            const data = await checkRes.json();
            isAdmin = data.is_admin || false;
          }
        } catch (err) {
          console.error("Chyba overenia roly admina:", err);
        }
      }

      if (isAdmin) {
        setupAdminUI();
      }

      loadNews(isAdmin);
      setupModalReader();
    });
  }

  function setupAdminUI() {
    if (!adminContainer) return;
    adminContainer.style.display = 'block';
    adminContainer.innerHTML = `
      <div style="text-align: left; background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 1px solid #eee; margin-bottom: 30px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 15px;">
            <h4 style="margin: 0; color: #e67e22; font-family: 'Raleway', sans-serif; font-weight: 700; min-width: 200px;">Administrácia Noviniek</h4>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button id="admin-news-save-all-btn" style="background: #28a745; color: white; border: none; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: bold; white-space: nowrap;">Uložiť zmeny</button>
            </div>
        </div>
        
        <div style="background: #fcfcfc; padding: 20px; border-radius: 10px; border: 1px solid #eaeaea;">
            <p style="font-size: 0.9rem; margin-bottom: 15px; color: #444; font-weight: bold;">Pridať novú novinku:</p>
            <div style="display: flex; flex-direction: column; gap: 15px;">
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                  <label for="admin-news-file-input" style="background: #e67e22; color: white; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: bold;">+ Zvoliť obrázok/plagát</label>
                  <input type="file" id="admin-news-file-input" accept="image/*" style="display:none;">
                  <div id="admin-news-preview-container"></div>
              </div>
              <input type="text" id="admin-news-title-input" placeholder="Nadpis novinky" style="padding: 10px 15px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem; width: 100%;">
              <textarea id="admin-news-desc-input" placeholder="Celý text článku (môže byť akokoľvek dlhý)" style="padding: 10px 15px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem; min-height: 120px; width: 100%;"></textarea>
              <button id="admin-news-upload-btn" style="background: #007bff; color: white; border: none; padding: 11px 30px; border-radius: 6px; cursor: pointer; font-weight: bold; display: none; align-self: flex-start;">Pridať novinku</button>
            </div>
            <div id="admin-news-upload-status" style="margin-top: 15px; font-size: 0.85rem; font-weight: bold; color: #666;"></div>
        </div>
      </div>
    `;

    const fileInput = document.getElementById('admin-news-file-input');
    const previewContainer = document.getElementById('admin-news-preview-container');
    const uploadBtn = document.getElementById('admin-news-upload-btn');
    const status = document.getElementById('admin-news-upload-status');

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        previewContainer.innerHTML = '';
        if (file) {
            uploadBtn.style.display = 'block';
            const reader = new FileReader();
            reader.onload = (re) => {
                previewContainer.innerHTML = `<img src="${re.target.result}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; border: 2px solid #ddd;">`;
            };
            reader.readAsDataURL(file);
        } else {
            uploadBtn.style.display = 'none';
        }
    }

    document.getElementById('admin-news-save-all-btn').onclick = async () => {
        const btn = document.getElementById('admin-news-save-all-btn');
        btn.disabled = true;
        btn.innerText = 'Ukladám...';
        
        const items = Array.from(document.querySelectorAll('.news-item-wrap'));
        let updates = items.map(el => ({
            id: el.dataset.id,
            title: el.querySelector('.admin-news-title-edit').value,
            description: el.querySelector('.admin-news-desc-edit').value,
            requested_sort: parseFloat(el.querySelector('.admin-news-sort-edit').value) || 999
        }));
        
        updates.sort((a, b) => a.requested_sort - b.requested_sort);
        for (let i = 0; i < updates.length; i++) {
            updates[i].sort_order = i;
        }

        try {
            const headers = await getHeaders();
            const res = await fetch(`${API_BASE}/news/batch`, {
              method: 'PUT',
              headers,
              body: JSON.stringify({ updates })
            });

            if (!res.ok) throw new Error('Hromadná úprava noviniek zlyhala');
            location.reload();
        } catch (err) {
            console.error(err);
            alert(`Chyba pri ukladaní: ${err.message}`);
            btn.disabled = false;
            btn.innerText = 'Uložiť zmeny';
        }
    };

    uploadBtn.onclick = async () => {
      const file = fileInput.files[0];
      const title = document.getElementById('admin-news-title-input').value;
      const desc = document.getElementById('admin-news-desc-input').value;
      
      if (!title) { alert('Prosím zadajte nadpis'); return; }
      if (!file) { alert('Prosím vyberte obrázok'); return; }
      
      uploadBtn.disabled = true;
      status.style.color = '#666';
      status.innerText = `Nahrávam: ${file.name}...`;

      try {
          const headers = await getHeaders();

          // 1. Získanie signed URL pre nahrávanie
          const signRes = await fetch(`${API_BASE}/get-upload-url`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ fileName: file.name, contentType: file.type, folder: 'news' })
          });
          if (!signRes.ok) throw new Error('Nepodarilo sa získať link na nahranie');
          const signData = await signRes.json();

          // 2. Nahrávanie priamo do Google Cloud Storage
          const uploadRes = await fetch(signData.uploadUrl, { 
              method: 'PUT', 
              body: file, 
              headers: { 'Content-Type': file.type } 
          });
          if (!uploadRes.ok) throw new Error('Nahranie plagátu na GCS zlyhalo');

          // 3. Zápis informácií do PostgreSQL databázy
          const dbRes = await fetch(`${API_BASE}/news`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                  s3_key: signData.key, 
                  title: title,
                  description: desc,
                  mime_type: file.type, 
                  file_size: file.size, 
                  sort_order: -Math.floor(Date.now() / 1000)
              })
          });
          if (!dbRes.ok) throw new Error('Zápis do databázy zlyhal');

          status.style.color = 'green';
          status.innerText = `Novinka úspešne pridaná!`;
          setTimeout(() => location.reload(), 1000);
      } catch (err) {
          console.error(err);
          status.style.color = 'red';
          status.innerText = `Chyba: ${err.message}`;
          uploadBtn.disabled = false;
      }
    };
  }

  async function loadNews(isAdmin) {
    try {
      const res = await fetch(`${API_BASE}/news`);
      if (!res.ok) throw new Error('Nepodarilo sa načítať novinky');
      const news = await res.json();

      container.innerHTML = '';
      
      news.forEach((item, index) => {
          const fullUrl = STORAGE_BASE + item.s3_key;
          const dateStr = new Date(item.created_at).toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });
          
          const col = document.createElement('div');
          col.className = 'col-lg-4 col-md-6 news-item-wrap';
          col.dataset.id = item.id;
          
          let adminControls = '';
          if (isAdmin) {
              adminControls = `
              <div style="margin-top: 15px; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #ddd; margin-bottom: 20px; text-align: left;">
                  <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
                      <div style="display: flex; gap: 10px;">
                          <div style="flex-grow: 1;">
                              <label style="font-size: 0.7rem; color: #777; display: block; margin-bottom: 2px; font-weight: bold;">NADPIS</label>
                              <input type="text" class="admin-news-title-edit" value="${item.title || ''}" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 5px; font-size: 0.85rem;">
                          </div>
                          <div style="width: 60px;">
                              <label style="font-size: 0.7rem; color: #777; display: block; margin-bottom: 2px; font-weight: bold;">PORADIE</label>
                              <input type="number" class="admin-news-sort-edit" value="${index + 1}" style="width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 5px; text-align: center; font-size: 0.85rem;">
                          </div>
                      </div>
                      <div>
                          <label style="font-size: 0.7rem; color: #777; display: block; margin-bottom: 2px; font-weight: bold;">OBSAH ČLÁNKU</label>
                          <textarea class="admin-news-desc-edit" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 5px; min-height: 80px; font-size: 0.85rem;">${item.description || ''}</textarea>
                      </div>
                  </div>
                  <div style="text-align: right;">
                      <button class="admin-news-del-btn" data-id="${item.id}" data-key="${item.s3_key}" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 5px; cursor: pointer; font-size: 0.8rem; font-weight: bold;">Zmazať novinku</button>
                  </div>
              </div>
              `;
          }

          // Vytvorenie skráteného textu pre kartu (napr. 130 znakov)
          const limit = 130;
          let shortText = item.description || '';
          if (shortText.length > limit) {
            shortText = shortText.substring(0, limit) + '...';
          }

          col.innerHTML = `
            <div class="news-item" style="height: 100%; display: flex; flex-direction: column;">
              <div class="news-img">
                <img src="${fullUrl}" alt="${item.title || ''}" class="img-fluid">
              </div>
              <div class="news-content" style="display: flex; flex-direction: column; flex-grow: 1;">
                <span class="date">${dateStr}</span>
                <h3>${item.title}</h3>
                <p style="flex-grow: 1;">${shortText}</p>
                <a href="#" class="readmore stretched-link" data-full-content="${encodeURIComponent(item.description || '')}">
                  <span>Zistiť viac</span><i class="bi bi-arrow-right"></i>
                </a>
              </div>
              ${adminControls}
            </div>
          `;
          container.appendChild(col);
      });

      if (isAdmin) {
          document.querySelectorAll('.admin-news-del-btn').forEach(btn => {
              btn.onclick = async () => {
                  if (!confirm('Naozaj zmazať túto novinku?')) return;
                  btn.disabled = true;
                  btn.innerText = 'Mažem...';
                  try {
                      const headers = await getHeaders();
                      const delRes = await fetch(`${API_BASE}/news`, {
                        method: 'DELETE',
                        headers,
                        body: JSON.stringify({ id: btn.dataset.id, s3Key: btn.dataset.key })
                      });
                      if (!delRes.ok) throw new Error('Vymazanie novinky zlyhalo.');
                      location.reload();
                  } catch (err) {
                      console.error(err);
                      alert(`Chyba pri mazaní novinky: ${err.message}`);
                      btn.disabled = false;
                      btn.innerText = 'Zmazať novinku';
                  }
              };
          });
      }
    } catch (err) {
      console.error("Error loading news:", err);
    }
  }

  function setupModalReader() {
    // Spracovanie kliknutia na "Zistiť viac" na otvorenie modálu s plným článkom
    document.addEventListener('click', function (e) {
      const readmore = e.target.closest('.news-item .readmore');
      if (!readmore) return;
      
      e.preventDefault();
      const itemWrap = readmore.closest('.news-item');
      const title = itemWrap.querySelector('h3').innerText;
      const imgUrl = itemWrap.querySelector('.news-img img').src;
      const date = itemWrap.querySelector('.date').innerText;
      const fullContent = decodeURIComponent(readmore.getAttribute('data-full-content') || '');

      // Nájdeme prvky v modáli
      const modalTitle = document.getElementById('modalNewsTitle');
      const modalImg = document.getElementById('modalNewsImg');
      const modalDate = document.getElementById('modalNewsDate');
      const modalContent = document.getElementById('modalNewsContent');

      if (modalTitle && modalImg && modalDate && modalContent) {
        modalTitle.innerText = title;
        modalImg.src = imgUrl;
        modalDate.innerText = date;
        modalContent.textContent = fullContent;

        // Otvoríme modal (pomocou Bootstrap 5 JS API)
        if (window.bootstrap && window.bootstrap.Modal) {
          const modalEl = document.getElementById('newsModal');
          let modalInstance = bootstrap.Modal.getInstance(modalEl);
          if (!modalInstance) {
            modalInstance = new bootstrap.Modal(modalEl);
          }
          modalInstance.show();
        }
      }
    });
  }

  init();
})();
