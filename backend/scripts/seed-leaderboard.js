/**
 * Seed script: inserts ~100 dummy users into Firestore `users` collection
 * for the leaderboard page at /leaderboard.
 *
 * Usage (from backend/ directory):
 *   node scripts/seed-leaderboard.js
 *
 * Reads FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY from backend/.env
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing Firebase credentials in .env');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

const db = getFirestore();

const firstNames = [
  'MinJun', 'SeoYeon', 'JiHo', 'YuNa', 'DongHyun', 'SoYeon', 'JaeWon', 'HaEun',
  'SungMin', 'JiEun', 'HyunWoo', 'EunJi', 'TaeYoung', 'MiRae', 'KangMin', 'JiYeon',
  'SeokJin', 'YunJi', 'ChaeWon', 'JinHo', 'SuBin', 'MinSeo', 'HyunJin', 'SoHee',
  'WooJin', 'AhReum', 'DaHyun', 'SangHoon', 'YeJin', 'JunSeo', 'HaRin', 'MinKyu',
  'SunYoung', 'JiSoo', 'TaeJun', 'EunSeo', 'ChanYoung', 'NaYeon', 'YeRim', 'HyunSeok',
  'SoWon', 'JiMin', 'DaEun', 'KyungMin', 'AraNa', 'BomKyu', 'SeHun', 'JiYoo',
  'HanNa', 'MinHo', 'SeoJun', 'YeWon', 'ChulSoo', 'HeeYeon', 'TaeHyun', 'NaRi',
  'DongWoo', 'SoMin', 'GiHoon', 'JuHee', 'SangWook', 'MiYoung', 'YuSeok', 'JiSun',
  'HyunSoo', 'BomYi', 'JaeHyun', 'SunHee', 'MinYoung', 'ChaeYeon', 'SeungJun', 'HaYoon',
  'DaWon', 'JiHwan', 'YuRi', 'SangYeon', 'EunJoo', 'KiYoung', 'HeeJin', 'TaeMin',
  'SoRa', 'JeongWoo', 'MinAh', 'SungHo', 'JiYun', 'HaYoung', 'WonBin', 'SeoYun',
  'DongJun', 'MiSun', 'JaeYoung', 'NaYoung', 'SeokHoon', 'YuJin', 'ChaeIn', 'BoRam',
  'HyunKi', 'SunMi', 'JungMin', 'SoJin',
];

const usernames = [
  'minjun_aim', 'seoyeon99', 'jiho_kr', 'yuna_star', 'donghyun_7', 'soyeon_ai', 'jaewon21', 'haeun_pro',
  'sungmin_x', 'jieun_aim', 'hyunwoo_kr', 'eunji_top', 'taeyoung1', 'mirae_ai', 'kangmin_k', 'jiyeon88',
  'seokjin_s', 'yunji_aim', 'chaewon_c', 'jinho99', 'subin_ai', 'minseo_kr', 'hyunjin_hj', 'sohee_s',
  'woojin_w', 'ahreum_ar', 'dahyun_d', 'sanghoon9', 'yejin_ye', 'junseo_j', 'harin_h', 'minkyu_m',
  'sunyoung_s', 'jisoo_js', 'taejun_t', 'eunseo_es', 'chanyoung', 'nayeon_ny', 'yerim_yr', 'hyunseok',
  'sowon_sw', 'jimin_aim', 'daeun_de', 'kyungmin_k', 'arana_ar', 'bomkyu_bk', 'sehun_sh', 'jiyoo_jy',
  'hanna_hn', 'minho_mh', 'seojun_sj', 'yewon_yw', 'chulsoo_cs', 'heeyeon_hy', 'taehyun_th', 'nari_nr',
  'dongwoo_dw', 'somin_sm', 'gihoon_gh', 'juhee_jh', 'sangwook_sw', 'miyoung_my', 'yuseok_ys', 'jisun_js',
  'hyunsoo_hs', 'bomyi_by', 'jaehyun_jh', 'sunhee_sh', 'minyoung_m', 'chaeyeon_c', 'seungjun_s', 'hayoon_hy',
  'dawon_dw', 'jihwan_jh', 'yuri_yr', 'sangyeon_sy', 'eunjoo_ej', 'kiyoung_ky', 'heejin_hj', 'taemin_tm',
  'sora_sr', 'jeongwoo_j', 'minah_ma', 'sungho_sh', 'jiyun_jy', 'hayoung_hy', 'wonbin_wb', 'seoyun_sy',
  'dongjun_dj', 'misun_ms', 'jaeyoung_j', 'nayoung_ny', 'seokhoon_s', 'yujin_yj', 'chaein_ci', 'boram_br',
  'hyunki_hk', 'sunmi_sm', 'jungmin_jm', 'sojin_sj',
];

// Avatars from DiceBear — deterministic, no external API needed
function avatarUrl(seed) {
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}`;
}

async function seed() {
  const col = db.collection('users');

  // Check for existing seed users to avoid duplication
  const existing = await col.where('_seeded', '==', true).get();
  if (!existing.empty) {
    console.log(`Found ${existing.size} existing seed users. Deleting them first...`);
    const batch = db.batch();
    existing.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    console.log('Deleted existing seed users.');
  }

  const count = firstNames.length; // 100
  const now = new Date();

  for (let i = 0; i < count; i++) {
    // Spread missions: top users have many, tail users have fewer
    // Rank 1 ≈ 250 missions, rank 100 ≈ 1 mission
    const rank = i + 1;
    const missionsCompleted = Math.max(1, Math.round(260 - (rank * 2.6) + Math.floor(Math.random() * 15)));
    // Points ≈ missions * 500 AP with some variance
    const points = missionsCompleted * 500 + Math.floor(Math.random() * 5000);

    const createdAt = new Date(now.getTime() - (count - i) * 24 * 60 * 60 * 1000);

    const doc = {
      _seeded: true,
      username: usernames[i],
      firstName: firstNames[i],
      photoUrl: avatarUrl(usernames[i]),
      points,
      missionsCompleted,
      isAdmin: false,
      createdAt: createdAt.toISOString(),
    };

    await col.add(doc);
    process.stdout.write(`\rSeeded ${i + 1}/${count}: ${firstNames[i]} (missions: ${missionsCompleted}, points: ${points})`);
  }

  console.log('\nDone! Seeded 100 dummy leaderboard entries.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
