import { auth, API_BASE } from './gcp-client.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

(function () {
  // TODO: Po vytvorení GCS bucketu nahraďte 'YOUR_GCS_BUCKET_NAME' názvom vášho bucketu
  // Napríklad: 'atelierinak-media'
  const STORAGE_BASE = 'https://storage.googleapis.com/atelierinak/';
  const container = document.querySelector('.portfolio .isotope-container');
  const adminContainer = document.getElementById('admin-gallery-controls');
  
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
    // Sledujeme zmenu stavu prihlásenia
    onAuthStateChanged(auth, async (user) => {
      let isAdmin = false;

      if (user) {
        try {
          const headers = await getHeaders();
          // Overenie admin práv na backend-e
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

      loadGallery(isAdmin);
    });
  }

  function setupAdminUI() {
    if (!adminContainer) return;
    adminContainer.style.display = 'block';
    adminContainer.innerHTML = `
      <div style="text-align: left; background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 1px solid #eee; margin-bottom: 30px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 15px;">
            <h4 style="margin: 0; color: #e67e22; font-family: 'Raleway', sans-serif; font-weight: 700; min-width: 200px;">Administrácia Galérie</h4>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button id="admin-save-all-btn" style="background: #28a745; color: white; border: none; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: bold; transition: .3s; white-space: nowrap;">Uložiť zmeny</button>
                <button id="admin-logout-btn" style="background: #f8f9fa; border: 1px solid #ddd; padding: 10px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; color: #666; white-space: nowrap;">Odhlásiť sa</button>
            </div>
        </div>
        
        <div style="background: #fcfcfc; padding: 20px; border-radius: 10px; border: 1px solid #eaeaea;">
            <p style="font-size: 0.9rem; margin-bottom: 15px; color: #444; font-weight: bold;">Pridať nové fotky (aj viac naraz):</p>
            <div style="display: flex; gap: 15px; flex-wrap: wrap; align-items: center; margin-bottom: 15px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                  <label for="admin-file-input" style="background: #e67e22; color: white; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: bold; transition: .2s;">+ Zvoliť fotky</label>
                  <input type="file" id="admin-file-input" accept="image/*" multiple style="display:none;">
              </div>
              <input type="text" id="admin-alt-input" placeholder="Spoločný popis (voliteľné)" style="padding: 10px 15px; border: 1px solid #ddd; border-radius: 6px; flex-grow: 1; font-size: 0.9rem;">
              <button id="admin-upload-btn" style="background: #007bff; color: white; border: none; padding: 11px 30px; border-radius: 6px; cursor: pointer; font-weight: bold; display: none;">Nahrať všetko</button>
            </div>
            
            <!-- Preview Section -->
            <div id="admin-preview-container" style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;"></div>
            
            <div id="admin-upload-status" style="margin-top: 15px; font-size: 0.85rem; font-weight: bold; color: #666;"></div>
        </div>
      </div>
    `;

    const fileInput = document.getElementById('admin-file-input');
    const previewContainer = document.getElementById('admin-preview-container');
    const uploadBtn = document.getElementById('admin-upload-btn');
    const status = document.getElementById('admin-upload-status');

    fileInput.onchange = (e) => {
        const files = Array.from(e.target.files);
        previewContainer.innerHTML = '';
        
        if (files.length > 0) {
            uploadBtn.style.display = 'block';
            uploadBtn.innerText = files.length > 1 ? `Nahrať všetko (${files.length})` : 'Nahrať fotku';
            
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (re) => {
                    const imgWrap = document.createElement('div');
                    imgWrap.style.cssText = 'width: 80px; height: 80px; border-radius: 6px; overflow: hidden; border: 2px solid #ddd; position: relative;';
                    imgWrap.innerHTML = `<img src="${re.target.result}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    previewContainer.appendChild(imgWrap);
                };
                reader.readAsDataURL(file);
            });
        } else {
            uploadBtn.style.display = 'none';
        }
    }

    document.getElementById('admin-logout-btn').onclick = async () => {
        if(confirm('Naozaj sa chcete odhlásiť?')) {
            await signOut(auth);
            location.reload();
        }
    };

    document.getElementById('admin-save-all-btn').onclick = async () => {
        const btn = document.getElementById('admin-save-all-btn');
        btn.disabled = true;
        btn.innerText = 'Ukladám...';
        
        const items = Array.from(document.querySelectorAll('.gallery-item-wrap'));
        let updates = items.map(el => ({
            id: el.dataset.id,
            alt_text: el.querySelector('.admin-alt-edit').value,
            category: 'hlina',
            requested_sort: parseFloat(el.querySelector('.admin-sort-edit').value) || 999
        }));
        
        updates.sort((a, b) => a.requested_sort - b.requested_sort);
        // Priradíme čisté indexy triedenia (0, 1, 2...)
        for (let i = 0; i < updates.length; i++) {
            updates[i].sort_order = i;
        }

        try {
            const headers = await getHeaders();
            const res = await fetch(`${API_BASE}/gallery/batch`, {
              method: 'PUT',
              headers,
              body: JSON.stringify({ updates })
            });

            if (!res.ok) throw new Error('Hromadný zápis zmien zlyhal');
            location.reload();
        } catch (err) {
            console.error(err);
            alert(`Chyba pri ukladaní zmien: ${err.message}`);
            btn.disabled = false;
            btn.innerText = 'Uložiť zmeny';
        }
    };

    uploadBtn.onclick = async () => {
      const files = Array.from(fileInput.files);
      const alt = document.getElementById('admin-alt-input').value;
      const category = 'hlina';
      
      uploadBtn.disabled = true;
      let completed = 0;

      for (const file of files) {
          status.innerText = `Nahrávam ${completed + 1} z ${files.length}: ${file.name}...`;
          try {
              const headers = await getHeaders();
              
              // 1. Získanie podpísanej adresy z Cloud Function
              const signRes = await fetch(`${API_BASE}/get-upload-url`, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({ fileName: file.name, contentType: file.type, folder: 'gallery' })
              });
              if (!signRes.ok) throw new Error(`Nepodarilo sa získať podpis pre ${file.name}`);
              const signData = await signRes.json();

              // 2. Samotné nahranie súboru priamo na Google Cloud Storage
              const uploadRes = await fetch(signData.uploadUrl, { 
                  method: 'PUT', 
                  body: file, 
                  headers: { 'Content-Type': file.type } 
              });
              if (!uploadRes.ok) throw new Error(`Upload na GCS zlyhal pre ${file.name}`);

              // 3. Uloženie záznamu do databázy PostgreSQL
              const dbRes = await fetch(`${API_BASE}/gallery`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  s3_key: signData.key, // s3_key používame kvôli zachovaniu štruktúry stĺpcov
                  alt_text: alt,
                  category: category,
                  mime_type: file.type,
                  file_size: file.size,
                  sort_order: -Math.floor(Date.now() / 1000) + completed
                })
              });
              if (!dbRes.ok) throw new Error(`Uloženie do databázy zlyhalo pre ${file.name}`);

              completed++;
          } catch (err) {
              console.error(err);
              status.style.color = 'red';
              status.innerText = `Chyba pri súbore ${file.name}: ${err.message}`;
              uploadBtn.disabled = false;
              return;
          }
      }

      status.style.color = 'green';
      status.innerText = `Úspešne nahraných ${completed} fotiek! Obnovujem...`;
      setTimeout(() => location.reload(), 1500);
    };
  }

  async function loadGallery(isAdmin) {
    try {
      const res = await fetch(`${API_BASE}/gallery`);
      if (!res.ok) throw new Error('Nepodarilo sa stiahnuť položky galérie.');
      const photos = await res.json();

      container.innerHTML = '';
      
      photos.forEach((photo, index) => {
          const fullUrl = STORAGE_BASE + photo.s3_key;
          const col = document.createElement('div');
          col.className = 'col-lg-4 col-md-6 portfolio-item isotope-item gallery-item-wrap';
          col.dataset.id = photo.id;
          
          let adminControls = '';
          if (isAdmin) {
              adminControls = `
              <div style="margin-top: 15px; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #ddd; box-shadow: 0 4px 10px rgba(0,0,0,0.05); text-align: left;">
                  <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
                      <div>
                          <label style="font-size: 0.7rem; color: #777; display: block; margin-bottom: 2px; font-weight: bold; text-transform: uppercase;">Popis (Alt)</label>
                          <input type="text" class="admin-alt-edit" value="${photo.alt_text || ''}" 
                              style="width: 100%; padding: 6px 10px; font-size: 0.85rem; border: 1px solid #ccc; border-radius: 5px;">
                      </div>
                      <div style="display: flex; gap: 10px;">
                          <div style="width: 100%;">
                              <label style="font-size: 0.7rem; color: #777; display: block; margin-bottom: 2px; font-weight: bold; text-transform: uppercase;">Poradie</label>
                              <input type="number" class="admin-sort-edit" value="${index + 1}" 
                                  style="width: 100%; padding: 5px; font-size: 0.85rem; border: 1px solid #ccc; border-radius: 5px; text-align: center;">
                          </div>
                      </div>
                  </div>
                  <div style="text-align: right;">
                      <button class="admin-del-btn" data-id="${photo.id}" data-key="${photo.s3_key}" 
                              style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 5px; cursor: pointer; font-size: 0.8rem; font-weight: bold;">
                          Zmazať
                      </button>
                  </div>
              </div>
              `;
          }

          col.innerHTML = `
              <div class="portfolio-content h-100">
                <img src="${fullUrl}" class="img-fluid" alt="${photo.alt_text || ''}">
                <div class="portfolio-info">
                  <p>${photo.alt_text || ''}</p>
                  <a href="${fullUrl}" title="${photo.alt_text || ''}" data-gallery="portfolio-gallery-all"
                    class="glightbox preview-link"><i class="bi bi-zoom-in"></i></a>
                </div>
                ${adminControls}
              </div>`;
          container.appendChild(col);
      });

      if (isAdmin) {
          document.querySelectorAll('.admin-del-btn').forEach(btn => {
              btn.onclick = async () => {
                  if (!confirm('Naozaj zmazať túto fotku?')) return;
                  btn.disabled = true;
                  btn.innerText = 'Mažem...';
                  try {
                      const headers = await getHeaders();
                      const delRes = await fetch(`${API_BASE}/gallery`, {
                        method: 'DELETE',
                        headers,
                        body: JSON.stringify({ id: btn.dataset.id, s3Key: btn.dataset.key })
                      });
                      if (!delRes.ok) throw new Error('Vymazanie na API zlyhalo.');
                      location.reload();
                  } catch (err) {
                      console.error(err);
                      alert(`Chyba pri mazaní: ${err.message}`);
                      btn.disabled = false;
                      btn.innerText = 'Zmazať';
                  }
              };
          });
      }

      // Re-inicializácia Isotope a GLightbox pre dynamický obsah
      if (window.Isotope && window.imagesLoaded) {
        imagesLoaded(container, function () {
          const iso = new Isotope(container, {
            itemSelector: '.isotope-item',
            layoutMode: 'masonry',
            filter: '*',
            sortBy: 'original-order'
          });

          document.querySelectorAll('.portfolio .portfolio-filters li').forEach(filterBtn => {
            filterBtn.onclick = function() {
              document.querySelector('.portfolio .portfolio-filters .filter-active').classList.remove('filter-active');
              this.classList.add('filter-active');
              iso.arrange({
                filter: this.getAttribute('data-filter')
              });
              if (typeof AOS !== 'undefined') {
                AOS.refresh();
              }
            };
          });
        });
      }

      if (window.GLightbox) {
        GLightbox({
          selector: '.glightbox'
        });
      }
    } catch (err) {
      console.error('Chyba načítania galérie:', err);
    }
  }

  init();
})();
