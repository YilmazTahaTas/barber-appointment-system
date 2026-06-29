let bookedAppointments = [];
let fp = null;
let globalSelectedDate = "";

document.addEventListener("DOMContentLoaded", function() {
    loadBookedAppointments();

    // --- SERVICE SELECTION LOGIC ---
    document.querySelectorAll('input[name="service"]').forEach(item => {
        item.addEventListener('change', (e) => {
            const selectedService = e.target.value;
            
            const getCb = (val) => Array.from(document.querySelectorAll('input[name="service"]')).find(cb => cb.value === val);
            const hairCb = getCb("Saç Tıraşı");
            const beardCb = getCb("Sakal Tıraşı");
            const packageCb = getCb("Saç ve Sakal Tıraşı");

            if (selectedService === "Saç ve Sakal Tıraşı" && e.target.checked) {
                if (hairCb) hairCb.checked = false;
                if (beardCb) beardCb.checked = false;
            }

            if ((selectedService === "Saç Tıraşı" || selectedService === "Sakal Tıraşı") && e.target.checked) {
                if (packageCb && packageCb.checked) {
                    packageCb.checked = false;
                    if (selectedService === "Saç Tıraşı" && beardCb) beardCb.checked = false;
                    if (selectedService === "Sakal Tıraşı" && hairCb) hairCb.checked = false;
                }
            }

            if (hairCb && beardCb && hairCb.checked && beardCb.checked) {
                hairCb.checked = false;
                beardCb.checked = false; 
                if (packageCb) packageCb.checked = true;
            }

            // Update price + POP animation
            const newPrice = calculatePrice();
            const priceSpan = document.getElementById('totalPrice');
            priceSpan.innerText = newPrice;
            priceSpan.classList.remove('price-pop');
            void priceSpan.offsetWidth;
            priceSpan.classList.add('price-pop');
        });
    });

    // --- AUTOMATIC PHONE FORMATTING ---
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function() {
            formatPhoneInput(this);
        });
    }
    const cancelPhoneInput = document.getElementById('cancelPhone');
    if (cancelPhoneInput) {
        cancelPhoneInput.addEventListener('input', function() {
            formatPhoneInput(this);
        });
    }
});

// =============================================
// PHONE FORMATTING
// =============================================
function formatPhoneInput(input) {
    let val = input.value.replace(/\D/g, '');
    if (val.length > 11) val = val.slice(0, 11);

    let formatted = '';
    if (val.length === 0) {
        formatted = '';
    } else if (val.length <= 4) {
        formatted = val;
    } else if (val.length <= 7) {
        formatted = val.slice(0, 4) + ' ' + val.slice(4);
    } else if (val.length <= 9) {
        formatted = val.slice(0, 4) + ' ' + val.slice(4, 7) + ' ' + val.slice(7);
    } else {
        formatted = val.slice(0, 4) + ' ' + val.slice(4, 7) + ' ' + val.slice(7, 9) + ' ' + val.slice(9);
    }

    input.value = formatted;
}

// =============================================
// DYNAMIC TIME BUTTONS
// =============================================
function createTimeButtons(selectedDate) {
    const timeGrid = document.querySelector('.saat-grid');
    if (!timeGrid) return;
    
    timeGrid.innerHTML = '';

    const today = new Date();
    const [year, month, day] = selectedDate.split('-');
    const isToday = today.getDate() === parseInt(day) &&
                    today.getMonth() === (parseInt(month) - 1) &&
                    today.getFullYear() === parseInt(year);

    const startHour = 10;
    const endHour = 22;

    for (let hour = startHour; hour < endHour; hour++) {
        const minutes = ['00', '30'];
        
        minutes.forEach(minute => {
            const timeString = `${hour.toString().padStart(2, '0')}:${minute}`;
            
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'saat-btn';
            btn.textContent = timeString;
            btn.setAttribute("data-time", timeString);

            const fullAppointmentFormat = `${selectedDate} ${timeString}`;
            const checkFormattedDate = frontendDateFormat(fullAppointmentFormat);

            const isTimeBooked = bookedAppointments.some(r => r.tarihStr === fullAppointmentFormat || r.tarihStr === checkFormattedDate);
            
            let isPastTime = false;
            if (isToday) {
                const checkTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, parseInt(minute));
                if (checkTime.getTime() < (today.getTime() + 30 * 60000)) {
                    isPastTime = true;
                }
            }

            if (isTimeBooked) {
                btn.setAttribute("disabled", "true");
                btn.style.cursor = "not-allowed";
            } else if (isPastTime) {
                btn.setAttribute("disabled", "true");
                btn.classList.add('gecmis');
                btn.style.cursor = "not-allowed";
                btn.style.textDecoration = "line-through";
                btn.style.opacity = "0.3";
            } else {
                btn.addEventListener('click', function() {
                    document.querySelectorAll('.saat-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    
                    if (globalSelectedDate) {
                        document.getElementById("randevu_tarihi").value = `${globalSelectedDate} ${timeString}`;
                    }
                });
            }

            timeGrid.appendChild(btn);
        });
    }
}

// =============================================
// FLATPICKR INITIALIZER
// =============================================
function initFlatpickr() {
    fp = flatpickr("#randevu_tarihi", {
        enableTime: false,
        dateFormat: "Y-m-d",
        minDate: "today", 
        disableMobile: "true",
        disable: [
            function(date) {
                return date.getDay() === 0; // 0 = Sunday closed
            }
        ],
        locale: {
            firstDayOfWeek: 1,
            weekdays: { shorthand: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'], longhand: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'] },
            months: { shorthand: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'], longhand: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'] }
        },
        onChange: function(selectedDates, dateStr, instance) {
            document.getElementById('noteGroup').style.display = 'block';
            if (selectedDates.length === 0) return;

            globalSelectedDate = dateStr;

            const timeSection = document.getElementById("saatSecimAlani");
            if (timeSection) {
                timeSection.style.display = "none";
                void timeSection.offsetWidth;
                timeSection.style.display = "block";
            }
            
            createTimeButtons(dateStr);
        }
    });
}

// =============================================
// FETCH BOOKED APPOINTMENTS FROM DATABASE
// =============================================
function loadBookedAppointments() {
    fetch('/api/dolu-randevular')
        .then(res => res.json())
        .then(resData => {
            if (resData.success) {
                bookedAppointments = resData.data.map(r => ({
                    tarihStr: r.randevu_tarihi,
                    telefon: r.telefon
                }));
                initFlatpickr();
            }
        }).catch(err => {
            console.error("Error loading booked hours:", err);
            initFlatpickr();
        });
}

// =============================================
// FORM SUBMIT — APPOINTMENT REGISTRATION
// =============================================
function submitForm(event) {
    event.preventDefault();
    document.querySelectorAll('.error-text').forEach(e => e.innerText = "");
    
    const checkboxes = document.querySelectorAll('input[name="service"]:checked');
    const fields = {
        fullname: document.getElementById('fullname').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        date: document.getElementById('randevu_tarihi').value.trim(),
        hasService: checkboxes.length > 0,
        note: document.getElementById('note').value.trim()
    };

    let isValid = true;

    if (!fields.fullname) { 
        document.getElementById('fullnameError').innerText = "Ad soyad giriniz!"; isValid = false; 
    } else if (fields.fullname.trim().split(/\s+/).length < 2) {
        document.getElementById('fullnameError').innerText = "Lütfen ad ve soyadınızı birlikte giriniz!"; isValid = false;
    }

    if (!fields.phone) { 
        document.getElementById('phoneError').innerText = "Telefon numarasını giriniz!"; isValid = false; 
    } else if (!validatePhoneNumber(fields.phone)) {
        document.getElementById('phoneError').innerText = "Geçerli bir telephone numarası giriniz!"; isValid = false;
    }
    
    if (!fields.date || !fields.date.includes(' ')) { 
        document.getElementById('dateError').innerText = "Lütfen listelenen butonlardan bir saat seçimi yapın!"; 
        isValid = false; 
    }
    if (!fields.hasService) { document.getElementById('serviceError').innerText = "En az bir hizmet seçiniz!"; isValid = false; }

    if (!isValid) {
        const firstError = document.querySelector('.error-text:not(:empty)');
        if (firstError) {
            const startScroll = window.scrollY;
            const targetScroll = firstError.getBoundingClientRect().top + window.scrollY - 150;
            const distance = targetScroll - startScroll;
            const duration = 600;
            let startTime = null;

            function scrollAnimation(time) {
                if (!startTime) startTime = time;
                const elapsed = time - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const ease = progress < 0.5 
                    ? 2 * progress * progress 
                    : -1 + (4 - 2 * progress) * progress;
                window.scrollTo(0, startScroll + distance * ease);
                if (elapsed < duration) requestAnimationFrame(scrollAnimation);
            }

            requestAnimationFrame(scrollAnimation);
        }
        return;
    }

    const cleanNumber = fields.phone.replace(/\D/g, '');
    const checkFormattedDate = frontendDateFormat(fields.date);

    const isAlreadyBooked = bookedAppointments.some(r => r.tarihStr === fields.date || r.tarihStr === checkFormattedDate);
    if (isAlreadyBooked) {
        document.getElementById('dateError').innerText = "Bu randevu saati dolu, lütfen başka bir saat seçin!";
        return; 
    }

    const parts = checkFormattedDate.split(' ');
    const onlyDayPart = `${parts[0]} ${parts[1]}`;
    const hasExistingAppointmentThatDay = bookedAppointments.some(r => r.telefon === cleanNumber && (r.tarihStr.includes(onlyDayPart)));
    if (hasExistingAppointmentThatDay) {
        document.getElementById('phoneError').innerText = "Bu telefon numarası ile zaten o güne ait bir randevunuz bulunuyor!";
        return; 
    }

    const selectedServices = getSelectedServicesText();
    const totalPrice = calculatePrice();

    Swal.fire({
        title: 'Randevu Bilgileriniz',
        html: `
            <div style="text-align: left; font-size: 1.1rem; line-height: 1.6;">
                <p><b>Ad Soyad:</b> ${fields.fullname}</p>
                <p><b>Telefon:</b> ${fields.phone}</p>
                <p><b>Tarih / Saat:</b> ${checkFormattedDate}</p>
                <p><b>Hizmetler:</b> ${selectedServices}</p>
                <p><b>Toplam Ücret:</b> <span style="color: gold; font-weight: bold;">${totalPrice} TL</span></p>
                ${fields.note ? `<p><b>Notunuz:</b> ${fields.note}</p>` : ''}
            </div>
            <br>
            <p style="font-size: 1rem; color: white;">Bilgileri onaylıyor musunuz?</p>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#2c4a3e',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Evet, Onaylıyorum',
        cancelButtonText: 'Düzenle'
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Randevunuz Kaydediliyor...',
                html: 'Lütfen bekleyiniz, işleminiz tamamlanıyor.',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            fetch('/api/randevular', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ad_soyad: fields.fullname, telefon: cleanNumber, randevu_tarihi: fields.date, 
                    tras_turu: selectedServices, fiyat: totalPrice, not: fields.note
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    Swal.close(); 
                    showStatusPage('success', {
                        fullname: fields.fullname,
                        phone: fields.phone,
                        date: checkFormattedDate,
                        services: selectedServices,
                        price: totalPrice,
                        note: fields.note
                    });
                } else {
                    Swal.close();
                    document.getElementById('dateError').innerText = data.message;
                }
            }).catch(() => {
                Swal.close();
                document.getElementById('dateError').innerText = "Bir hata oluştu.";
            });
        }
    });
}

// =============================================
// FORM SUBMIT — APPOINTMENT CANCELLATION
// =============================================
function submitCancel(event) {
    event.preventDefault();
    const phoneInput = document.getElementById('cancelPhone').value.trim();
    const reasonInput = document.getElementById('cancelReason').value.trim();
    const errorSpan = document.getElementById('cancelPhoneError');
    const submitBtn = event.target.querySelector('.btn-cancel-submit') || document.querySelector('.btn-cancel-submit');
    errorSpan.innerText = "";

    if (!phoneInput) { errorSpan.innerText = "Telefon numarasını giriniz!"; return; }
    if (!validatePhoneNumber(phoneInput)) { errorSpan.innerText = "Geçerli bir telefon numarası giriniz!"; return; }

    const cleanNumber = phoneInput.replace(/\D/g, '');

    if (submitBtn) submitBtn.disabled = true;
    Swal.fire({
        title: 'Randevu Sorgulanıyor...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    fetch('/api/randevu-sorgula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefon: cleanNumber })
    })
    .then(res => res.json())
    .then(data => {
        if (submitBtn) submitBtn.disabled = false; 
        Swal.close(); 

        if (data.success && data.data && data.data.length > 0) {
            const appointments = data.data;
            let currentIndex = 0;

            const updateCancelPopupContent = () => {
                const r = appointments[currentIndex];
                const totalCount = appointments.length;

                const htmlContent = `
                    <div style="text-align: center; font-weight: bold; color: #aaa; margin-bottom: 2px;">
                        Randevu ${currentIndex + 1} / ${totalCount}
                    </div>
                    <div style="text-align: center; font-size: 0.9rem; color: #c0392b; margin-bottom: 15px; font-weight: 500;">
                        İptal etmek istediğiniz randevuyu seçip aşağıdaki butona tıklayın.
                    </div>
                    <div style="text-align: left; background: #1e2622; padding: 15px; border-radius: 8px; border: 1px solid #2c4a3e; line-height: 1.6; color: #f0f0f0;">
                        <p style="margin: 5px 0; color: #ccc;"><b>Ad Soyad:</b> <span style="color: #52af84;">${r.ad_soyad}</span></p>
                        <p style="margin: 5px 0; color: #ccc;"><b>Tarih / Saat:</b> <b style="font-size: 1rem; color: #c0392b;">${r.randevu_tarihi}</b></p>
                        <p style="margin: 5px 0; color: #ccc;"><b>Hizmetler:</b> <span style="color: #52af84;">${r.tras_turu || 'Belirtilmedi'}</span></p>
                        <p style="margin: 5px 0; color: #ccc;"><b>Ücret:</b> <span style="font-weight:bold; color:#52af84;">${r.fiyat || 0} TL</span></p>
                        ${reasonInput ? `<p style="margin: 5px 0; color: #ccc;"><b>İptal Nedeni:</b> <span style="color: #e67e22;">${reasonInput}</span></p>` : ''}
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 20px; margin-bottom: 10px;">
                        <button id="cancel-swal-prev-btn" class="swal2-styled" style="background-color: #444; color: white !important; margin: 0; padding: 8px 16px; border-radius: 4px; border: none; font-weight: 500; cursor: pointer; display: ${currentIndex > 0 ? 'block' : 'none'};">← Önceki</button>
                        <div style="flex-grow: 1;"></div>
                        <button id="cancel-swal-next-btn" class="swal2-styled" style="background-color: #2c4a3e; color: white !important; margin: 0; padding: 8px 16px; border-radius: 4px; border: none; font-weight: 500; cursor: pointer; display: ${currentIndex < totalCount - 1 ? 'block' : 'none'};">Sonraki →</button>
                    </div>
                `;

                Swal.getHtmlContainer().innerHTML = htmlContent;

                const prevBtn = document.getElementById('cancel-swal-prev-btn');
                const nextBtn = document.getElementById('cancel-swal-next-btn');

                if (prevBtn) { prevBtn.onclick = () => { currentIndex--; updateCancelPopupContent(); }; }
                if (nextBtn) { nextBtn.onclick = () => { currentIndex++; updateCancelPopupContent(); }; }
            };

            Swal.fire({
                title: 'Randevu İptal Onayı',
                html: '<div id="swal-cancel-dynamic-content"></div>',
                icon: 'warning',
                width: '500px',
                showCancelButton: true,
                confirmButtonColor: '#c0392b',
                cancelButtonColor: '#333',
                confirmButtonText: 'Bu Randevuyu İptal Et',
                cancelButtonText: 'Kapat',
                didOpen: () => { updateCancelPopupContent(); }
            }).then((result) => {
                if (result.isConfirmed) {
                    const selectedAppointment = appointments[currentIndex];

                    Swal.fire({
                        title: 'Randevunuz İptal Ediliyor...',
                        allowOutsideClick: false,
                        didOpen: () => { Swal.showLoading(); }
                    });

                    fetch('/api/randevu-iptal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            telefon: cleanNumber, 
                            randevu_tarihi: selectedAppointment.randevu_tarihi, 
                            iptal_nedeni: reasonInput 
                        })
                    })
                    .then(res => res.json())
                    .then(cancelData => {
                        Swal.close();
                        if (cancelData.success) {
                            showStatusPage('cancel', {
                                fullname: selectedAppointment.ad_soyad,
                                phone: phoneInput,
                                date: selectedAppointment.randevu_tarihi,
                                reason: reasonInput || "Belirtilmedi"
                            });
                        } else {
                            errorSpan.innerText = cancelData.message;
                        }
                    }).catch(() => {
                        Swal.close();
                        errorSpan.innerText = "İptal işlemi yapılırken teknik bir hata oluştu.";
                    });
                }
            });
        } else {
            errorSpan.innerText = data.message || "Bu telefon numarasına ait aktif bir randevu bulunamadı!";
        }
    })
    .catch(() => {
        if (submitBtn) submitBtn.disabled = false;
        Swal.close();
        errorSpan.innerText = "Sorgulama esnasında bir hata oluştu.";
    });
}

// =============================================
// HELPER FUNCTIONS
// =============================================
function calculatePrice() {
    let total = 0;
    document.querySelectorAll('input[name="service"]:checked').forEach(cb => {
        total += parseInt(cb.getAttribute('data-price')) || 0;
    });
    return total;
}

function frontendDateFormat(dateStr) {
    if (!dateStr || !dateStr.includes('-')) return dateStr;
    const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const days = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    
    try {
        const [datePart, timePart] = dateStr.split(' ');
        const [year, month, day] = datePart.split('-');
        
        const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const dayName = days[d.getDay()];
        const monthName = months[d.getMonth()];
        
        return `${parseInt(day)} ${monthName} ${dayName} ${timePart || ''}`.trim();
    } catch(e) {
        console.error("Date formatting error:", e);
        return dateStr;
    }
}

function getSelectedServicesText() {
    let checked = [];
    document.querySelectorAll('input[name="service"]:checked').forEach(cb => checked.push(cb.value));
    return checked.join(', ');
}

function validatePhoneNumber(input) {
    const num = input.replace(/\D/g, '');
    return num.length >= 10 && (num.startsWith('5') || num.startsWith('05'));
}

// =============================================
// TOGGLE SECTIONS
// =============================================
function toggleSection(type) {
    const appSec = document.getElementById('appointmentSection');
    const cancelSec = document.getElementById('cancelSection');
    const footer = document.querySelector('footer');

    if (type === 'appointment') {
        cancelSec.classList.remove('active');
        appSec.classList.toggle('active');
        
        if (appSec.classList.contains('active')) {
            if (footer) footer.style.display = 'none';
            setTimeout(() => { appSec.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 300);
        } else {
            if (footer) footer.style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    } else {
        appSec.classList.remove('active');
        cancelSec.classList.toggle('active');
        
        if (cancelSec.classList.contains('active')) {
            if (footer) footer.style.display = 'none';
            setTimeout(() => { cancelSec.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150);
        } else {
            if (footer) footer.style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
}

// =============================================
// STATUS PAGE
// =============================================
function showStatusPage(type, details) {
    document.querySelector('.hero').style.display = 'none';
    const appSec = document.getElementById('appointmentSection');
    const cancelSec = document.getElementById('cancelSection');
    if(appSec) appSec.classList.remove('active');
    if(cancelSec) cancelSec.classList.remove('active');
    
    const container = document.getElementById('successPageContainer');
    if(!container) return;

    if (type === 'success') {
        container.innerHTML = `
            <div class="status-card success-card">
                <div class="status-icon success-icon">✓</div>
                <h2>Randevunuz Onaylandı!</h2>
                <div class="status-details">
                    <p><b>Ad Soyad:</b> <span>${details.fullname}</span></p>
                    <p><b>Telefon:</b> <span>${details.phone}</span></p>
                    <p><b>Tarih / Saat:</b> <span>${details.date}</span></p>
                    <p><b>Hizmetler:</b> <span>${details.services}</span></p>
                    <p><b>Toplam Ücret:</b> <span class="price-highlight">${details.price} TL</span></p>
                    ${details.note ? `<p><b>Notunuz:</b> <span>${details.note}</span></p>` : ''}
                </div>
                <div class="status-note success-note-box">
                    <strong>NOT:</strong> Lütfen randevu saatinizde dükkanda olun. Eğer gelemeyecekseniz ana menüden 'Randevumu İptal Et' bölümünden randevunuzu iptal edin.
                </div>
                <button class="btn btn-create" onclick="location.reload()">Ana Menü</button>
            </div>
        `;
        try {
            const colors = ['#2c4a3e', '#d4af37', '#1a3328', '#ffffff', '#b392ac'];
            const animationEnd = Date.now() + 2500;
            (function frame() {
                if (animationEnd - Date.now() <= 0) return;
                confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: colors, scalar: 1.2 });
                confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: colors, scalar: 1.2 });
                requestAnimationFrame(frame);
            }());
        } catch (e) { console.error("Confetti error:", e); }
    } else if (type === 'cancel') {
        container.innerHTML = `
            <div class="status-card cancel-page-card">
                <div class="status-icon success-icon">✓</div>
                <h2 style="color: var(--danger-color);">Randevunuz İptal Edildi</h2>
                <div class="status-details">
                    <p><b>Ad Soyad:</b> <span>${details.fullname}</span></p>
                    <p><b>Telefon Numarası:</b> <span>${details.phone}</span></p>
                    <p><b>Randevu Tarihi:</b> <span>${details.date}</span></p>
                    <p><b>İptal Nedeni:</b> <span>${details.reason}</span></p>
                </div>
                <div class="status-note cancel-note-box">
                    <strong>BİLGİLENDİRME:</strong> İptal talebiniz sistem tarafından başarıyla işlenmiştir.
                </div>
                <button class="btn btn-cancel-trigger" style="background-color: #333;" onclick="location.reload()">Ana Menü</button>
            </div>
        `;
    }
    container.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================
// INQUIRE APPOINTMENT
// =============================================
async function randevuSorgulaKutusu() {
    const { value: phone } = await Swal.fire({
        title: 'Randevu Sorgulama',
        input: 'tel',
        inputLabel: 'Sistemde kayıtlı telefon numaranızı giriniz',
        inputPlaceholder: 'Örn: 0555 555 5555',
        showCancelButton: true,
        confirmButtonText: 'Sorgula',
        cancelButtonText: 'Vazgeç',
        confirmButtonColor: '#2c4a3e',
        inputValidator: (value) => { if (!value) return 'Lütfen telefon numarası giriniz!'; }
    });

    if (phone) {
        try {
            Swal.fire({ title: 'Sorgulanıyor...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
            let cleanNumber = phone.replace(/\D/g, '');
            if (cleanNumber.length === 10 && cleanNumber.startsWith('5')) cleanNumber = '0' + cleanNumber;

            const response = await fetch('/api/randevu-sorgula', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telefon: cleanNumber })
            });
            const result = await response.json();

            if (result.success && result.data && result.data.length > 0) {
                const appointments = result.data; 
                let currentIndex = 0;

                const updatePopupContent = () => {
                    const r = appointments[currentIndex];
                    const totalCount = appointments.length;
                    const htmlContent = `
                        <div style="text-align: center; font-weight: bold; color: #aaa; margin-bottom: 2px;">Randevu ${currentIndex + 1} / ${totalCount}</div>
                        <div style="text-align: center; font-size: 0.9rem; color: #52af84; margin-bottom: 15px;">Sistemde ${totalCount} aktif randevunuz var.</div>
                        <div style="text-align: left; background: #1e2622; padding: 15px; border-radius: 8px; border: 1px solid #2c4a3e; line-height: 1.6; color: #f0f0f0;">
                            <p><b>Ad Soyad:</b> <span style="color: #52af84;">${r.ad_soyad}</span></p>
                            <p><b>Tarih / Saat:</b> <b style="color: #52af84;">${r.randevu_tarihi}</b></p>
                            <p><b>Hizmetler:</b> <span>${r.tras_turu || 'Belirtilmedi'}</span></p>
                            <p><b>Ücret:</b> <span>${r.fiyat || 0} TL</span></p>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 20px;">
                            <button id="swal-prev-btn" class="swal2-styled" style="background-color: #444; color: white; display: ${currentIndex > 0 ? 'block' : 'none'};">← Önceki</button>
                            <div style="flex-grow: 1;"></div>
                            <button id="swal-next-btn" class="swal2-styled" style="background-color: #2c4a3e; color: white; display: ${currentIndex < totalCount - 1 ? 'block' : 'none'};">Sonraki →</button>
                        </div>
                    `;
                    Swal.getHtmlContainer().innerHTML = htmlContent;
                    const prevBtn = document.getElementById('swal-prev-btn');
                    const nextBtn = document.getElementById('swal-next-btn');
                    if (prevBtn) prevBtn.onclick = () => { currentIndex--; updatePopupContent(); };
                    if (nextBtn) nextBtn.onclick = () => { currentIndex++; updatePopupContent(); };
                };

                Swal.fire({
                    icon: 'success',
                    title: `Aktif Randevular`,
                    html: '<div id="swal-dynamic-content"></div>',
                    width: '500px', 
                    confirmButtonText: 'Kapat',
                    confirmButtonColor: '#2c4a3e',
                    didOpen: () => { updatePopupContent(); }
                });
            } else {
                Swal.fire({ icon: 'error', title: 'Randevu Bulunamadı', text: result.message || 'Aktif randevu kaydı mevcut değil.', confirmButtonText: 'Tamam', confirmButtonColor: '#d33' });
            }
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Hata', text: 'Sunucu bağlantısında bir hata oluştu!', confirmButtonText: 'Tamam', confirmButtonColor: '#d33' });
        }
    }
}