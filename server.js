require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); 
const session = require('express-session'); 
const app = express();

const PORT = process.env.PORT || 3000;
const YONETICI_IP = process.env.YONETICI_IP;

app.use(cors());
app.use(express.json());

app.use(session({
    secret: process.env.SECRET_KEY, 
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000 } 
}));

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,        
    database: process.env.DB_NAME,     
    password: process.env.DB_PASSWORD,       
    port: process.env.DB_PORT,
});

let blacklistedIPs = new Set(); 

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

async function updateBlacklist() {
    try {
        const result = await pool.query('SELECT ip_address FROM blacklisted_ips');
        blacklistedIPs = new Set(result.rows.map(row => row.ip_address));
        console.log("Yasaklı IP listesi güncellendi.");
    } catch (err) {
        console.error('Veritabanı bağlantı hatası:', err);
    }
}

updateBlacklist();

app.post('/admin/yasakla', isAdmin, async (req, res) => {
    const { id } = req.body;
    try {
        const randevu = await pool.query("SELECT ip_adresi FROM randevular WHERE id = $1", [id]);
        
        if (randevu.rows.length === 0 || !randevu.rows[0].ip_adresi) {
            return res.status(400).json({ success: false, message: "IP adresi bulunamadı veya randevu zaten silinmiş!" });
        }

        const ipToBan = randevu.rows[0].ip_adresi;

        await pool.query("DELETE FROM randevular WHERE id = $1", [id]);
        await pool.query("INSERT INTO blacklisted_ips (ip_address) VALUES ($1) ON CONFLICT DO NOTHING", [ipToBan]);
        await updateBlacklist();

        res.json({ success: true, message: "Randevu silindi ve IP başarıyla yasaklandı!" });
    } catch (err) {
        console.error("Yasaklama hatası:", err);
        res.status(500).json({ success: false, message: "İşlem başarısız oldu!" });
    }
});

setInterval(updateBlacklist, 5 * 60 * 1000);

// Middleware
function blockMiddleware(req, res, next) {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (blacklistedIPs.has(clientIp)) {
        return res.status(403).send("Erişim engellendi.");
    }
    next();
}

app.use(blockMiddleware);

const ADMIN_CREDENTIALS = {
    username: process.env.ADMIN_USER,
    password: process.env.ADMIN_PASS
};

function isAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.status(401).json({ success: false, message: "Yetkisiz erişim! Lütfen giriş yapın." });
}

function tarihiTurkceyeCevir(tarihStr) {
    if (!tarihStr) return tarihStr;
    if (tarihStr.includes('Ocak') || tarihStr.includes('Şubat') || tarihStr.includes('Mart') || 
        tarihStr.includes('Nisan') || tarihStr.includes('Mayıs') || tarihStr.includes('Haziran') || 
        tarihStr.includes('Temmuz') || tarihStr.includes('Ağustos') || tarihStr.includes('Eylül') || 
        tarihStr.includes('Ekim') || tarihStr.includes('Kasım') || tarihStr.includes('Aralık')) {
        return tarihStr;
    }

    const aylar = {
        "01": "Ocak", "02": "Şubat", "03": "Mart", "04": "Nisan", 
        "05": "Mayıs", "06": "Haziran", "07": "Temmuz", "08": "Ağustos", 
        "09": "Eylül", "10": "Ekim", "11": "Kasım", "12": "Aralık"
    };
    const gunler = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

    try {
        if (tarihStr.includes('-')) {
            const [tarihKismi, saatKismi] = tarihStr.split(' ');
            const [yil, ay, gun] = tarihKismi.split('-');
            
            if (aylar[ay]) {
                const d = new Date(parseInt(yil), parseInt(ay) - 1, parseInt(gun));
                const gunAdi = gunler[d.getDay()];
                
                return `${parseInt(gun)} ${aylar[ay]} ${gunAdi} ${saatKismi || ''}`.trim();
            }
        }
    } catch (e) {
        console.error("Tarih formatlama hatası:", e);
    }
    return tarihStr;
}

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/admin-panel', (req, res) => {
    res.sendFile(__dirname + '/views/admin-panel.html');
});

app.use(express.static(__dirname + '/public'));

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: text, parse_mode: 'Markdown' })
        });
    } catch (err) {
        console.error("Telegram mesajı gönderilemedi:", err);
    }
}

app.post('/api/admin-login', (req, res) => {
    const { username, password } = req.body;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const ipMatch = (clientIp === YONETICI_IP);
    const credentialsMatch = (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password);

    if (ipMatch || credentialsMatch) {
        req.session.isAdmin = true;
        return res.json({ success: true, message: "Giriş başarılı!" });
    }
    
    res.json({ success: false, message: "Kullanıcı adı veya şifre hatalı!" });
});

app.get('/api/admin-check', (req, res) => {
    if (req.session && req.session.isAdmin) {
        res.json({ loggedIn: true });
    } else {
        res.json({ loggedIn: false });
    }
});

app.post('/api/admin-logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: "Çıkış yapıldı." });
});

app.get('/api/dolu-randevular', async (req, res) => {
    try {
        const result = await pool.query("SELECT randevu_tarihi, telefon FROM randevular WHERE durum = 'aktif'");
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("Veritabanından randevular çekilemedi:", err);
        res.status(500).json({ success: false, message: "Sunucu hatası!" });
    }
});

app.post('/api/randevular', async (req, res) => {
    const { ad_soyad, telefon, randevu_tarihi, tras_turu, fiyat, not } = req.body;

    if (!ad_soyad || !telefon || !randevu_tarihi) {
        return res.status(400).json({ success: false, message: "Eksik alan bıraktınız!" });
    }

    let temizTelefon = telefon.toString().replace(/\D/g, '').trim();
    if (temizTelefon.length === 10 && temizTelefon.startsWith('5')) {
        temizTelefon = '0' + temizTelefon;
    }

    const ipAdresi = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    const formatliTarih = tarihiTurkceyeCevir(randevu_tarihi);

    try {
        const checkDuplicateQuery = "SELECT id FROM randevular WHERE randevu_tarihi = $1 AND durum = 'aktif'";
        const duplicateResult = await pool.query(checkDuplicateQuery, [formatliTarih]);

        if (duplicateResult.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Bu randevu saati az önce doldu, lütfen başka bir saat seçiniz!" });
        }

        const parcalar = formatliTarih.split(' ');
        const sadeceGunKismi = `${parcalar[0]} ${parcalar[1]}`; 
        
        const checkDayQuery = "SELECT id FROM randevular WHERE telefon = $1 AND randevu_tarihi LIKE $2 AND durum = 'aktif'";
        const dayResult = await pool.query(checkDayQuery, [temizTelefon, `${sadeceGunKismi}%`]);

        if (dayResult.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Bu telefon numarasıyla o güne ait zaten aktif bir randevunuz var!" });
        }

        const queryText = `
            INSERT INTO randevular (ad_soyad, telefon, randevu_tarihi, tras_turu, fiyat, not_metni, durum, olusturulma_tarihi, ip_adresi)
            VALUES ($1, $2, $3, $4, $5, $6, 'aktif', NOW(), $7) RETURNING *
        `;
        const values = [ad_soyad, temizTelefon, formatliTarih, tras_turu, fiyat, not || null, ipAdresi];
        await pool.query(queryText, values);

        const telegramMesaj = `
✅ **YENİ RANDEVU ALINDI** ✅

👤 **Müşteri:** ${ad_soyad}
📞 **Telefon:** ${temizTelefon}
📅 **Tarih/Saat:** ${formatliTarih}
✂️ **Hizmetler:** ${tras_turu}
💰 **Tutar:** ${fiyat} TL
📝 **Not:** ${not ? not : 'Yok'}
🌐 **IP Adresi:** ${ipAdresi}
`;
        await sendTelegramMessage(telegramMesaj);

        res.json({ success: true, message: "Randevu başarıyla oluşturuldu." });
    } catch (err) {
        console.error("Kayıt esnasında veritabanı hatası:", err);
        res.status(500).json({ success: false, message: "Veritabanına kaydedilemedi!" });
    }
});

app.post('/api/randevu-sorgula', async (req, res) => {
    let { telefon } = req.body;
    if (!telefon) {
        return res.status(400).json({ success: false, message: "Telefon numarası eksik!" });
    }

    try {
        let temizNumara = telefon.toString().replace(/\D/g, '').trim();

        const checkQuery = `
            SELECT ad_soyad, randevu_tarihi, tras_turu, fiyat 
            FROM randevular 
            WHERE telefon = $1 AND durum = 'aktif' 
            ORDER BY id ASC
        `;
        
        const checkResult = await pool.query(checkQuery, [temizNumara]);

        console.log("Sorgulanan Numara:", temizNumara);
        console.log("Bulunan Satır Sayısı:", checkResult.rows.length);
        console.log("Gelen Veriler:", checkResult.rows);

        if (!checkResult.rows || checkResult.rows.length === 0) {
            return res.json({ success: false, message: "Bu telefon numarasına ait aktif bir randevu bulunamadı!" });
        }

        res.json({ 
            success: true, 
            data: checkResult.rows 
        });
    } catch (err) {
        console.error("Sorgulama esnasında veritabanı hatası:", err);
        res.status(500).json({ success: false, message: "Sorgulama yapılırken sunucu hatası oluştu!" });
    }
});

app.post('/api/randevu-iptal', async (req, res) => {
    const { telefon, randevu_tarihi, iptal_nedeni } = req.body;
    
    if (!telefon || !randevu_tarihi) {
        return res.status(400).json({ success: false, message: "Telefon numarası veya randevu tarihi eksik!" });
    }

    try {
        let temizTelefon = telefon.toString().replace(/\D/g, '').trim();
        if (temizTelefon.length === 10 && temizTelefon.startsWith('5')) {
            temizTelefon = '0' + temizTelefon;
        }

        const checkQuery = "SELECT * FROM randevular WHERE telefon = $1 AND randevu_tarihi = $2 AND durum = 'aktif'";
        const checkResult = await pool.query(checkQuery, [temizTelefon, randevu_tarihi]);

        if (checkResult.rows.length === 0) {
            return res.json({ success: false, message: "Seçilen tarihe ait aktif bir randevu bulunamadı." });
        }

        const iptalEdilenRandevu = checkResult.rows[0];

        const updateQuery = `
            UPDATE randevular 
            SET durum = 'iptal', not_metni = $1 
            WHERE telefon = $2 AND randevu_tarihi = $3 AND durum = 'aktif'
        `;
        await pool.query(updateQuery, [iptal_nedeni || 'Belirtilmedi', temizTelefon, randevu_tarihi]);

        const telegramMesaj = `
🚨 **RANDEVU İPTAL EDİLDİ** 🚨

👤 **Müşteri:** ${iptalEdilenRandevu.ad_soyad}
📞 **Telefon:** ${iptalEdilenRandevu.telefon}
📅 **Tarih/Saat:** ${iptalEdilenRandevu.randevu_tarihi}
✂️ **Hizmetler:** ${iptalEdilenRandevu.tras_turu}
💰 **Tutar:** ${iptalEdilenRandevu.fiyat} TL
📝 **İptal Nedeni:** ${iptal_nedeni ? iptal_nedeni : 'Belirtilmedi'}
`;
        await sendTelegramMessage(telegramMesaj);

        res.json({ success: true, message: "Seçtiğiniz randevu başarıyla iptal edildi." });
    } catch (err) {
        console.error("İptal esnasında veritabanı hatası:", err);
        res.status(500).json({ success: false, message: "İptal işlemi başarısız oldu!" });
    }
});

app.get('/admin/veritabani-gor', isAdmin, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM randevular ORDER BY id DESC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/admin/randevu-durum-guncelle', isAdmin, async (req, res) => {
    const { id, yeniDurum } = req.body;
    if (!id || !yeniDurum) {
        return res.status(400).json({ success: false, message: "Eksik parametre!" });
    }
    try {
        const updateQuery = "UPDATE randevular SET durum = $1 WHERE id = $2";
        await pool.query(updateQuery, [yeniDurum, id]);
        res.json({ success: true, message: `Randevu durumu '${yeniDurum}' olarak güncellendi.` });
    } catch (err) {
        console.error("Durum güncelleme hatası:", err);
        res.status(500).json({ success: false, message: "Veritabanı güncelleme hatası!" });
    }
});

// --- RANDEVU HATIRLATMA KONTROLÜ ---
setInterval(async () => {
    try {
        const queryText = `
            SELECT id, ad_soyad, telefon, randevu_tarihi, tras_turu, fiyat, not_metni 
            FROM randevular 
            WHERE durum = 'aktif' AND hatirlatma_gonderildi = FALSE
        `;
        const result = await pool.query(queryText);

        if (result.rows.length === 0) return; 

        const simdi = new Date();

        for (const randevu of result.rows) {
            const parcalar = randevu.randevu_tarihi.split(' '); 
            if (parcalar.length >= 3) {
                const gun = parseInt(parcalar[0]);
                const ayStr = parcalar[1];
                
                const saatKismi = parcalar[parcalar.length - 1];
                if (!saatKismi.includes(':')) continue; 

                const [saat, dakika] = saatKismi.split(':');

                const aylarIndeks = {
                    "Ocak":0, "Şubat":1, "Mart":2, "Nisan":3, "Mayıs":4, "Haziran":5, 
                    "Temmuz":6, "Ağustos":7, "Eylül":8, "Ekim":9, "Kasım":10, "Aralık":11
                };

                if (aylarIndeks[ayStr] === undefined) continue;

                const randevuTarihObj = new Date(simdi.getFullYear(), aylarIndeks[ayStr], gun, parseInt(saat), parseInt(dakika));
                
                const ayniGunMu = randevuTarihObj.getDate() === simdi.getDate() &&
                                  randevuTarihObj.getMonth() === simdi.getMonth() &&
                                  randevuTarihObj.getFullYear() === simdi.getFullYear();

                const farkDakika = (randevuTarihObj - simdi) / (1000 * 60);

                if (ayniGunMu && farkDakika <= 15 && farkDakika >= 0) {
                    const hatirlatmaMesaj = `
⏰ **RANDEVU HATIRLATMASI (Son 15 Dk!)** ⏰

👤 **Müşteri:** ${randevu.ad_soyad}
📞 **Telefon:** ${randevu.telefon}
📅 **Randevu Saati:** ${randevu.randevu_tarihi}
✂️ **Hizmetler:** ${randevu.tras_turu}
💰 **Tutar:** ${randevu.fiyat} TL
📝 **Not:** ${randevu.not_metni ? randevu.not_metni : 'Yok'}
`;
                    await sendTelegramMessage(hatirlatmaMesaj);

                    await pool.query("UPDATE randevular SET hatirlatma_gonderildi = TRUE WHERE id = $1", [randevu.id]);
                    console.log(`[Hatırlatıcı] ${randevu.ad_soyad} için hatırlatma bildirimi gönderildi.`);
                }
            }
        }
    } catch (err) {
        console.error("Hatırlatma kontrol mekanizmasında hata oluştu:", err);
    }
}, 1 * 60 * 1000);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sunucu 0.0.0.0:${PORT} adresinde tıkır tıkır çalışıyor.`);
});