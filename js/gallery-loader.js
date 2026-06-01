import { auth, API_BASE } from './gcp-client.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

(function () {
  const STORAGE_BASE = 'https://storage.googleapis.com/atelierinak/';
  const container = document.querySelector('.portfolio .isotope-container');
  const adminContainer = document.getElementById('admin-gallery-controls');
  
  if (!container) return;

  let galleryList = [];
  let currentPage = 1;
  let adminMode = false;

  // Track if view is mobile or desktop to detect shifts
  let isMobile = window.innerWidth <= 768;

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

      adminMode = isAdmin;
      if (adminMode) {
        setupAdminUI();
      }

      loadGallery();
      setupInputListeners();

      // Listen to resize events and trigger layout adjustments on breakpoint cross
      window.addEventListener('resize', () => {
        const currentMobile = window.innerWidth <= 768;
        if (currentMobile !== isMobile) {
          isMobile = currentMobile;
          currentPage = 1; // reset page on layout transition
          renderGallery();
        }
      });
    });
  }

  function setupInputListeners() {
    // Keep internal galleryList Alt text up-to-date when admin types
    container.addEventListener('input', (e) => {
      if (e.target.classList.contains('admin-alt-edit')) {
        const itemEl = e.target.closest('.gallery-item-wrap');
        if (!itemEl) return;
        const id = itemEl.dataset.id;
        const item = galleryList.find(p => p.id == id);
        if (item) {
          item.alt_text = e.target.value;
        }
      }
    });

    // Commit sort order and swap on change (blur or Enter)
    container.addEventListener('change', (e) => {
      if (e.target.classList.contains('admin-sort-edit')) {
        const itemEl = e.target.closest('.gallery-item-wrap');
        if (!itemEl) return;
        const id = itemEl.dataset.id;
        const newSort = parseFloat(e.target.value) || 999;
        
        const item = galleryList.find(p => p.id == id);
        if (!item) return;
        
        const oldSort = item.requested_sort;
        if (oldSort === newSort) return;

        // Find if another item has newSort
        const otherItem = galleryList.find(p => p.id != id && p.requested_sort === newSort);
        if (otherItem) {
          otherItem.requested_sort = oldSort;
        }
        item.requested_sort = newSort;

        // Sort and re-render
        galleryList.sort((a, b) => a.requested_sort - b.requested_sort);
        renderGallery();
      }
    });

    // Blur on Enter keypress to trigger change event
    container.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('admin-sort-edit')) {
        e.preventDefault();
        e.target.blur();
      }
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
        
        let updates = galleryList.map(item => ({
            id: item.id,
            alt_text: item.alt_text,
            category: 'hlina',
            requested_sort: parseFloat(item.requested_sort) || 999
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
                  s3_key: signData.key,
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

  async function loadGallery() {
    try {
      const res = await fetch(`${API_BASE}/gallery`);
      if (!res.ok) throw new Error('Nepodarilo sa stiahnuť položky galérie.');
      const photos = await res.json();

      photos.forEach((photo, index) => {
        photo.requested_sort = index + 1;
      });
      galleryList = photos;
      currentPage = 1;
      renderGallery();
    } catch (err) {
      console.error('Chyba načítania galérie:', err);
    }
  }

  function renderGallery() {
    container.innerHTML = '';

    const itemsPerPage = window.innerWidth <= 768 ? 6 : 9;
    const totalPages = Math.ceil(galleryList.length / itemsPerPage);

    if (currentPage > totalPages) currentPage = totalPages || 1;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = galleryList.slice(start, end);

    pageItems.forEach((photo) => {
        const overallIndex = galleryList.indexOf(photo);
        const fullUrl = STORAGE_BASE + photo.s3_key;
        const col = document.createElement('div');
        col.className = 'col-lg-4 col-md-6 portfolio-item isotope-item gallery-item-wrap';
        col.dataset.id = photo.id;
        
        let adminControls = '';
        if (adminMode) {
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
                            <input type="number" class="admin-sort-edit" value="${photo.requested_sort || (overallIndex + 1)}" 
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
              <div class="position-relative overflow-hidden">
                <img src="${fullUrl}" class="img-fluid" alt="${photo.alt_text || ''}">
                <div class="portfolio-info">
                  <p>${photo.alt_text || ''}</p>
                  <a href="${fullUrl}" title="${photo.alt_text || ''}" data-gallery="portfolio-gallery-all"
                    class="glightbox preview-link"><i class="bi bi-zoom-in"></i></a>
                </div>
              </div>
              ${adminControls}
            </div>`;
        container.appendChild(col);
    });

    setupDeleteButtons();
    renderPaginationControls(totalPages);

    // Re-initialize Isotope & GLightbox
    if (window.Isotope && window.imagesLoaded) {
      imagesLoaded(container, function () {
        const iso = new Isotope(container, {
          itemSelector: '.isotope-item',
          layoutMode: 'masonry',
          filter: '*',
          sortBy: 'original-order'
        });
        
        iso.layout();

        if (typeof AOS !== 'undefined') {
          AOS.refresh();
        }
      });
    }

    if (window.GLightbox) {
      GLightbox({
        selector: '.glightbox'
      });
    }
  }

  function setupDeleteButtons() {
    if (!adminMode) return;
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

  function renderPaginationControls(totalPages) {
    const portfolioContainer = container.closest('.container');
    if (!portfolioContainer) return;

    let paginationDiv = document.getElementById('gallery-pagination');
    if (!paginationDiv) {
      paginationDiv = document.createElement('div');
      paginationDiv.id = 'gallery-pagination';
      paginationDiv.className = 'd-flex justify-content-center align-items-center gap-2 mt-5';
      portfolioContainer.appendChild(paginationDiv);
    }
    paginationDiv.innerHTML = '';

    if (totalPages <= 1) {
      return;
    }

    function scrollToGallery() {
      const el = document.getElementById('portfolio');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }

    // Prev Button
    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '<i class="bi bi-chevron-left"></i>';
    prevBtn.disabled = currentPage === 1;
    prevBtn.style.cssText = 'border: 1px solid #ddd; background: #fff; color: #444; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.3s;';
    if (currentPage > 1) {
      prevBtn.onmouseenter = () => { prevBtn.style.borderColor = '#e67e22'; prevBtn.style.color = '#e67e22'; };
      prevBtn.onmouseleave = () => { prevBtn.style.borderColor = '#ddd'; prevBtn.style.color = '#444'; };
      prevBtn.onclick = () => { currentPage--; renderGallery(); scrollToGallery(); };
    } else {
      prevBtn.style.opacity = '0.5';
      prevBtn.style.cursor = 'not-allowed';
    }
    paginationDiv.appendChild(prevBtn);

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.innerText = i;
      pageBtn.style.cssText = 'border: 1px solid #ddd; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: 0.3s; font-family: "Raleway", sans-serif; font-weight: bold; cursor: pointer;';
      if (i === currentPage) {
        pageBtn.style.background = '#e67e22';
        pageBtn.style.borderColor = '#e67e22';
        pageBtn.style.color = '#fff';
      } else {
        pageBtn.style.background = '#fff';
        pageBtn.style.color = '#444';
        pageBtn.onmouseenter = () => { pageBtn.style.borderColor = '#e67e22'; pageBtn.style.color = '#e67e22'; };
        pageBtn.onmouseleave = () => {
          if (i !== currentPage) {
            pageBtn.style.borderColor = '#ddd';
            pageBtn.style.color = '#444';
          }
        };
        pageBtn.onclick = () => { currentPage = i; renderGallery(); scrollToGallery(); };
      }
      paginationDiv.appendChild(pageBtn);
    }

    // Next Button
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = '<i class="bi bi-chevron-right"></i>';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.style.cssText = 'border: 1px solid #ddd; background: #fff; color: #444; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.3s;';
    if (currentPage < totalPages) {
      nextBtn.onmouseenter = () => { nextBtn.style.borderColor = '#e67e22'; nextBtn.style.color = '#e67e22'; };
      nextBtn.onmouseleave = () => { nextBtn.style.borderColor = '#ddd'; nextBtn.style.color = '#444'; };
      nextBtn.onclick = () => { currentPage++; renderGallery(); scrollToGallery(); };
    } else {
      nextBtn.style.opacity = '0.5';
      nextBtn.style.cursor = 'not-allowed';
    }
    paginationDiv.appendChild(nextBtn);
  }

  init();
})();
