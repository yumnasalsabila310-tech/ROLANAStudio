const fs = require('fs');
const https = require('https');

const API_KEY = process.env.YOUTUBE_API_KEY;
const DATA_FILE = 'data.json';

if (!API_KEY) {
    console.error("API Key tidak ditemukan di environment variables!");
    process.exit(1);
}

function getChannelData(channelId) {
    return new Promise((resolve, reject) => {
        const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${API_KEY}`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.items && json.items.length > 0) {
                        const info = json.items[0];
                        resolve({
                            subs: parseInt(info.statistics.subscriberCount || 0),
                            views: parseInt(info.statistics.viewCount || 0),
                            videos: parseInt(info.statistics.videoCount || 0)
                        });
                    } else {
                        reject("Channel tidak ditemukan");
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', err => reject(err));
    });
}

async function updateAll() {
    if (!fs.existsSync(DATA_FILE)) {
        console.log("File data.json tidak ditemukan.");
        return;
    }

    let rawData = fs.readFileSync(DATA_FILE);
    let db = JSON.parse(rawData);
    const today = new Date().toISOString().split('T')[0];

    for (let channel of db.channels) {
        try {
            console.log(`Memperbarui data untuk: ${channel.name || channel.id}`);
            const stats = await getChannelData(channel.id);
            
            if (!channel.history) channel.history = [];
            
            // Cek apakah tanggal hari ini sudah ada, jika ya update, jika belum masukkan baru
            let todayRecord = channel.history.find(h => h.date === today);
            if (todayRecord) {
                todayRecord.subs = stats.subs;
                todayRecord.views = stats.views;
            } else {
                channel.history.push({
                    date: today,
                    subs: stats.subs,
                    views: stats.views
                });
            }

            // Update data saat ini
            channel.subs = stats.subs;
            channel.views = stats.views;
            channel.videos = stats.videos;
        } catch (err) {
            console.error(`Gagal memperbarui ${channel.id}:`, err);
        }
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    console.log("Pembaruan data harian selesai!");
}

updateAll();
