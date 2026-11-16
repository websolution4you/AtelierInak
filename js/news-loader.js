import { auth, db } from './firebase-config.js?v=2.3';
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

function compressImageToDataUrl(file, maxWidth = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Nepodarilo sa načítať obrázok na kompresiu.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Nepodarilo sa prečítať súbor.'));
    reader.readAsDataURL(file);
  });
}

(function () {
  const STORAGE_BASE = 'https://storage.googleapis.com/atelierinak/';
  const container = document.querySelector('.news .row.gy-4');
  const adminContainer = document.getElementById('admin-news-controls');
  
  if (!container) return;

  const DEFAULT_NEWS = [
    {
      id: 'def-news-1',
      title: 'Aktuálne z ateliéru',
      description: 'Vitajte v Ateliéri INAK! Ponúkame priestor pre senzoriku, emócie, osobný rozvoj a cestu k sebe cez tvorbu. Sledujte naše aktivity a workshopy.',
      s3_key: 'news/1784036184082-20260713_135441.jpg',
      created_at: '2026-07-14T13:36:25.180Z',
      sort_order: 1
    }
  ];

  let newsList = [];
  let currentPage = 1;
  let adminMode = false;
  let isMobile = window.innerWidth <= 768;

  async function init() {
    onAuthStateChanged(auth, async (user) => {
      adminMode = !!user;

      if (adminMode) {
        setupAdminUI();
      }

      await loadNews();
      setupModalReader();
      setupInputListeners();

      window.addEventListener('resize', () => {
        const currentMobile = window.innerWidth <= 768;
        if (currentMobile !== isMobile) {
          isMobile = currentMobile;
          currentPage = 1;
          renderNews();
        }
      });
    });
  }

  function setupInputListeners() {
    container.addEventListener('input', (e) => {
      const itemEl = e.target.closest('.news-item-wrap');
      if (!itemEl) return;
      const id = itemEl.dataset.id;
      const item = newsList.find(n => n.id == id);
      if (!item) return;

      if (e.target.classList.contains('admin-news-title-edit')) {
        item.title = e.target.value;
      } else if (e.target.classList.contains('admin-news-desc-edit')) {
        item.description = e.target.value;
      }
    });

    container.addEventListener('change', (e) => {
      if (e.target.classList.contains('admin-news-sort-edit')) {
        const itemEl = e.target.closest('.news-item-wrap');
        if (!itemEl) return;
        const id = itemEl.dataset.id;
        const newSort = parseFloat(e.target.value) || 999;
        
        const item = newsList.find(n => n.id == id);
        if (!item) return;
        
        const oldSort = item.requested_sort;
        if (oldSort === newSort) return;

        const otherItem = newsList.find(n => n.id != id && n.requested_sort === newSort);
        if (otherItem) {
          otherItem.requested_sort = oldSort;
        }
        item.requested_sort = newSort;

        newsList.sort((a, b) => a.requested_sort - b.requested_sort);
        renderNews();
      }
    });

    container.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('admin-news-sort-edit')) {
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
            <h4 style="margin: 0; color: #e67e22; font-family: 'Raleway', sans-serif; font-weight: 700; min-width: 200px;">Administrácia Aktuálne</h4>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button id="admin-news-save-all-btn" style="background: #28a745; color: white; border: none; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: bold; white-space: nowrap;">Uložiť zmeny</button>
                <button id="admin-news-logout-btn" style="background: #f8f9fa; border: 1px solid #ddd; padding: 10px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; color: #666; white-space: nowrap;">Odhlásiť sa</button>
            </div>
        </div>
        
        <div style="background: #fcfcfc; padding: 20px; border-radius: 10px; border: 1px solid #eaeaea;">
            <p style="font-size: 0.9rem; margin-bottom: 15px; color: #444; font-weight: bold;">Pridať nový príspevok:</p>
            <div style="display: flex; flex-direction: column; gap: 15px;">
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                  <label for="admin-news-file-input" style="background: #e67e22; color: white; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: bold;">+ Zvoliť obrázok/plagát</label>
                  <input type="file" id="admin-news-file-input" accept="image/*" style="display:none;">
                  <div id="admin-news-preview-container"></div>
              </div>
              <input type="text" id="admin-news-title-input" placeholder="Nadpis príspevku" style="padding: 10px 15px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem; width: 100%;">
              <textarea id="admin-news-desc-input" placeholder="Celý text článku (môže byť akokoľvek dlhý)" style="padding: 10px 15px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem; min-height: 120px; width: 100%;"></textarea>
              <button id="admin-news-upload-btn" style="background: #007bff; color: white; border: none; padding: 11px 30px; border-radius: 6px; cursor: pointer; font-weight: bold; display: none; align-self: flex-start;">Pridať príspevok</button>
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
    };

    document.getElementById('admin-news-logout-btn').onclick = async () => {
        if (confirm('Naozaj sa chcete odhlásiť?')) {
            await signOut(auth);
            location.reload();
        }
    };

    document.getElementById('admin-news-save-all-btn').onclick = async () => {
        const btn = document.getElementById('admin-news-save-all-btn');
        btn.disabled = true;
        btn.innerText = 'Ukladám...';
        
        try {
            const batch = writeBatch(db);
            for (let i = 0; i < newsList.length; i++) {
                const item = newsList[i];
                const sortOrder = i;

                if (String(item.id).startsWith('def-')) {
                    const newDocRef = doc(collection(db, 'news'));
                    batch.set(newDocRef, {
                        title: item.title || '',
                        description: item.description || '',
                        s3_key: item.s3_key || '',
                        imageUrl: item.imageUrl || (STORAGE_BASE + item.s3_key),
                        sort_order: sortOrder,
                        is_active: true,
                        created_at: item.created_at || new Date().toISOString()
                    });
                } else {
                    const docRef = doc(db, 'news', String(item.id));
                    batch.update(docRef, {
                        title: item.title || '',
                        description: item.description || '',
                        sort_order: sortOrder
                    });
                }
            }
            await batch.commit();
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
          const downloadUrl = await compressImageToDataUrl(file);

          await addDoc(collection(db, 'news'), {
              title: title,
              description: desc,
              imageUrl: downloadUrl,
              s3_key: '',
              mime_type: 'image/jpeg',
              file_size: downloadUrl.length,
              sort_order: -Math.floor(Date.now() / 1000),
              is_active: true,
              created_at: new Date().toISOString()
          });

          status.style.color = 'green';
          status.innerText = `Príspevok úspešne pridaný!`;
          setTimeout(() => location.reload(), 1000);
      } catch (err) {
          console.error(err);
          status.style.color = 'red';
          status.innerText = `Chyba: ${err.message}`;
          uploadBtn.disabled = false;
      }
    };
  }

  async function loadNews() {
    try {
      const q = query(collection(db, 'news'), orderBy('sort_order', 'asc'));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        newsList = DEFAULT_NEWS.map(item => ({ ...item, requested_sort: item.sort_order }));
      } else {
        const news = [];
        querySnapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.is_active !== false) {
            news.push({
              id: docSnap.id,
              ...data
            });
          }
        });
        news.forEach((item, index) => {
          item.requested_sort = index + 1;
        });
        newsList = news;
      }
    } catch (err) {
      console.warn('Používam predvolené novinky:', err);
      newsList = DEFAULT_NEWS.map(item => ({ ...item, requested_sort: item.sort_order }));
    }

    currentPage = 1;
    renderNews();
  }

  function renderNews() {
    container.innerHTML = '';
    
    const itemsPerPage = window.innerWidth <= 768 ? 3 : 6;
    const totalPages = Math.ceil(newsList.length / itemsPerPage);

    if (currentPage > totalPages) currentPage = totalPages || 1;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = newsList.slice(start, end);

    pageItems.forEach((item) => {
        const overallIndex = newsList.indexOf(item);
        const fullUrl = item.imageUrl || (STORAGE_BASE + item.s3_key);
        const dateStr = new Date(item.created_at).toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });
        
        const col = document.createElement('div');
        col.className = 'col-lg-4 col-md-6 news-item-wrap';
        col.dataset.id = item.id;
        
        let adminControls = '';
        if (adminMode) {
            adminControls = `
            <div style="position: relative; z-index: 2; margin-top: 15px; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #ddd; margin-bottom: 20px; text-align: left;">
                <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
                    <div style="display: flex; gap: 10px;">
                        <div style="flex-grow: 1;">
                            <label style="font-size: 0.7rem; color: #777; display: block; margin-bottom: 2px; font-weight: bold;">NADPIS</label>
                            <input type="text" class="admin-news-title-edit" value="${item.title || ''}" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 5px; font-size: 0.85rem;">
                        </div>
                        <div style="width: 60px;">
                            <label style="font-size: 0.7rem; color: #777; display: block; margin-bottom: 2px; font-weight: bold;">PORADIE</label>
                            <input type="number" class="admin-news-sort-edit" value="${item.requested_sort || (overallIndex + 1)}" style="width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 5px; text-align: center; font-size: 0.85rem;">
                        </div>
                    </div>
                    <div>
                        <label style="font-size: 0.7rem; color: #777; display: block; margin-bottom: 2px; font-weight: bold;">OBSAH ČLÁNKU</label>
                        <textarea class="admin-news-desc-edit" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 5px; min-height: 80px; font-size: 0.85rem;">${item.description || ''}</textarea>
                    </div>
                </div>
                <div style="text-align: right;">
                    <button class="admin-news-del-btn" data-id="${item.id}" data-key="${item.s3_key || ''}" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 5px; cursor: pointer; font-size: 0.8rem; font-weight: bold;">Zmazať príspevok</button>
                </div>
            </div>
            `;
        }

        const limit = 130;
        let shortText = item.description || '';
        if (shortText.length > limit) {
          shortText = shortText.substring(0, limit) + '...';
        }

        col.innerHTML = `
          <div class="news-item" style="position: relative; height: 100%; display: flex; flex-direction: column;">
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

    setupDeleteButtons();
    renderPaginationControls(totalPages);
  }

  function setupDeleteButtons() {
    if (!adminMode) return;
    document.querySelectorAll('.admin-news-del-btn').forEach(btn => {
        btn.onclick = async () => {
            if (!confirm('Naozaj zmazať tento príspevok?')) return;
            btn.disabled = true;
            btn.innerText = 'Mažem...';
            const id = btn.dataset.id;
            const key = btn.dataset.key;
            try {
                if (!String(id).startsWith('def-')) {
                    await deleteDoc(doc(db, 'news', String(id)));
                }
                if (key && !key.startsWith('news/1784036184082')) {
                    try {
                        await deleteObject(ref(storage, key));
                    } catch (storageErr) {
                        console.warn('Storage warn:', storageErr);
                    }
                }
                location.reload();
            } catch (err) {
                console.error(err);
                alert(`Chyba pri mazaní príspevku: ${err.message}`);
                btn.disabled = false;
                btn.innerText = 'Zmazať príspevok';
            }
        };
    });
  }

  function renderPaginationControls(totalPages) {
    let paginationDiv = document.getElementById('news-pagination');
    if (!paginationDiv) {
      paginationDiv = document.createElement('div');
      paginationDiv.id = 'news-pagination';
      paginationDiv.className = 'd-flex justify-content-center align-items-center gap-2 mt-5';
      container.parentNode.appendChild(paginationDiv);
    }
    paginationDiv.innerHTML = '';

    if (totalPages <= 1) {
      return;
    }

    function scrollToNews() {
      const el = document.getElementById('aktualne');
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
      prevBtn.onclick = () => { currentPage--; renderNews(); scrollToNews(); };
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
        pageBtn.onclick = () => { currentPage = i; renderNews(); scrollToNews(); };
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
      nextBtn.onclick = () => { currentPage++; renderNews(); scrollToNews(); };
    } else {
      nextBtn.style.opacity = '0.5';
      nextBtn.style.cursor = 'not-allowed';
    }
    paginationDiv.appendChild(nextBtn);
  }

  function setupModalReader() {
    document.addEventListener('click', function (e) {
      const readmore = e.target.closest('.news-item .readmore');
      if (!readmore) return;
      
      e.preventDefault();
      const itemWrap = readmore.closest('.news-item');
      const title = itemWrap.querySelector('h3').innerText;
      const imgUrl = itemWrap.querySelector('.news-img img').src;
      const date = itemWrap.querySelector('.date').innerText;
      const fullContent = decodeURIComponent(readmore.getAttribute('data-full-content') || '');

      const modalTitle = document.getElementById('modalNewsTitle');
      const modalImg = document.getElementById('modalNewsImg');
      const modalDate = document.getElementById('modalNewsDate');
      const modalContent = document.getElementById('modalNewsContent');

      if (modalTitle && modalImg && modalDate && modalContent) {
        modalTitle.innerText = title;
        modalImg.src = imgUrl;
        modalDate.innerText = date;
        modalContent.textContent = fullContent;

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
