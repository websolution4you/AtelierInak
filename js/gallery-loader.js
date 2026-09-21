import { auth, db, storage } from './firebase-config.js?v=2.2';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  writeBatch 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

(function () {
  const STORAGE_BASE = 'https://storage.googleapis.com/atelierinak/';
  const container = document.querySelector('.portfolio .isotope-container');
  const adminContainer = document.getElementById('admin-gallery-controls');
  
  if (!container) return;

  const DEFAULT_GALLERY = [
    { id: 'def-1', s3_key: 'gallery/1780503966407-gallery_photo1.jpg', alt_text: 'Umelecké výrobky z Ateliéru', sort_order: 1 },
    { id: 'def-2', s3_key: 'gallery/1780503966994-gallery_photo2.jpg', alt_text: 'Tvorba s hlinou', sort_order: 2 },
    { id: 'def-3', s3_key: 'gallery/1780503967477-gallery_photo3.jpg', alt_text: 'Keramické dielo', sort_order: 3 },
    { id: 'def-4', s3_key: 'gallery/1780503967911-gallery_photo4.jpg', alt_text: 'Ručná práca v ateliéri', sort_order: 4 },
    { id: 'def-5', s3_key: 'gallery/1780503968450-gallery_photo5.jpg', alt_text: 'Ateliér INAK Levoča', sort_order: 5 },
    { id: 'def-6', s3_key: 'gallery/1780503969555-gallery_photo7.jpg', alt_text: 'Keramika a kreativita', sort_order: 6 },
    { id: 'def-7', s3_key: 'gallery/1780657265416-gallery_photo11.jpg', alt_text: 'Umenie a arteterapia', sort_order: 7 },
    { id: 'def-8', s3_key: 'gallery/1780503965592-background_home.jpg', alt_text: 'Tvorivý proces', sort_order: 8 }
  ];

  let galleryList = [];
  let currentPage = 1;
  let adminMode = false;
  let isMobile = window.innerWidth <= 768;

  async function init() {
    onAuthStateChanged(auth, async (user) => {
      adminMode = !!user;

      if (adminMode) {
        setupAdminUI();
      }

      await loadGallery();
      setupInputListeners();

      window.addEventListener('resize', () => {
        const currentMobile = window.innerWidth <= 768;
        if (currentMobile !== isMobile) {
          isMobile = currentMobile;
          currentPage = 1;
          renderGallery();
        }
      });
    });
  }

  function setupInputListeners() {
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

        const otherItem = galleryList.find(p => p.id != id && p.requested_sort === newSort);
        if (otherItem) {
          otherItem.requested_sort = oldSort;
        }
        item.requested_sort = newSort;

        galleryList.sort((a, b) => a.requested_sort - b.requested_sort);
        renderGallery();
      }
    });

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
    };

    document.getElementById('admin-logout-btn').onclick = async () => {
        if (confirm('Naozaj sa chcete odhlásiť?')) {
            await signOut(auth);
            location.reload();
        }
    };

    document.getElementById('admin-save-all-btn').onclick = async () => {
        const btn = document.getElementById('admin-save-all-btn');
        btn.disabled = true;
        btn.innerText = 'Ukladám...';

        try {
            const batch = writeBatch(db);
            for (let i = 0; i < galleryList.length; i++) {
                const item = galleryList[i];
                const sortOrder = i;

                if (String(item.id).startsWith('def-')) {
                    const newDocRef = doc(collection(db, 'gallery'));
                    batch.set(newDocRef, {
                        s3_key: item.s3_key || '',
                        imageUrl: item.imageUrl || (STORAGE_BASE + item.s3_key),
                        alt_text: item.alt_text || '',
                        category: item.category || 'hlina',
                        sort_order: sortOrder,
                        is_active: true,
                        created_at: new Date().toISOString()
                    });
                } else {
                    const docRef = doc(db, 'gallery', String(item.id));
                    batch.update(docRef, {
                        alt_text: item.alt_text || '',
                        sort_order: sortOrder
                    });
                }
            }
            await batch.commit();
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
              const sanitizedName = file.name.replace(/[^a-z0-9.-]/gi, '_');
              const fileKey = `gallery/${Date.now()}-${sanitizedName}`;
              const fileStorageRef = ref(storage, fileKey);

              await uploadBytes(fileStorageRef, file);
              const downloadUrl = await getDownloadURL(fileStorageRef);

              await addDoc(collection(db, 'gallery'), {
                  imageUrl: downloadUrl,
                  s3_key: fileKey,
                  alt_text: alt || '',
                  category: category,
                  mime_type: file.type,
                  file_size: file.size,
                  sort_order: -Math.floor(Date.now() / 1000) + completed,
                  is_active: true,
                  created_at: new Date().toISOString()
              });

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
      const q = query(collection(db, 'gallery'), orderBy('sort_order', 'asc'));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        galleryList = DEFAULT_GALLERY.map(item => ({ ...item, requested_sort: item.sort_order }));
      } else {
        const photos = [];
        querySnapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.is_active !== false) {
            photos.push({
              id: docSnap.id,
              ...data
            });
          }
        });
        photos.forEach((photo, index) => {
          photo.requested_sort = index + 1;
        });
        galleryList = photos;
      }
    } catch (err) {
      console.warn('Používam predvolené fotky galérie:', err);
      galleryList = DEFAULT_GALLERY.map(item => ({ ...item, requested_sort: item.sort_order }));
    }

    currentPage = 1;
    renderGallery();
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
        const fullUrl = photo.imageUrl || (STORAGE_BASE + photo.s3_key);
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
                    <button class="admin-del-btn" data-id="${photo.id}" data-key="${photo.s3_key || ''}" 
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
            const id = btn.dataset.id;
            const key = btn.dataset.key;
            try {
                if (!String(id).startsWith('def-')) {
                    await deleteDoc(doc(db, 'gallery', String(id)));
                }
                if (key && !key.startsWith('gallery/17805039') && !key.startsWith('gallery/17806572')) {
                    try {
                        await deleteObject(ref(storage, key));
                    } catch (storageErr) {
                        console.warn('Storage delete warn:', storageErr);
                    }
                }
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
