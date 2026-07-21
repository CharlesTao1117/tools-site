/**
 * 易考通 Service Worker v1.0
 * Daily question push notification + offline fallback
 */
const CACHE = 'bekao-v1';
const DAILY_QUESTION_CACHE = 'bekao-daily-v1';

// Pre-cache essential assets on install
const PRECACHE = [
  '/nursing/index.html',
  '/nursing/quiz.html',
  '/nursing/style.css',
  '/nursing/data/subjects.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Helper: pick a random question from the dataset
async function pickDailyQuestion() {
  try {
    const resp = await caches.match('/nursing/data/daily_question.json');
    if (resp) {
      const data = await resp.json();
      return data;
    }
    // Fallback: fetch from network
    const fetchResp = await fetch('/nursing/data/daily_question.json');
    if (fetchResp.ok) return await fetchResp.json();
  } catch (e) {
    // Return offline fallback
  }
  return null;
}

// Show daily question notification
async function showDailyQuestion() {
  const q = await pickDailyQuestion();
  if (!q) return;

  const title = '📝 每日一題 — 護理國考';
  const body = q.text.length > 100 ? q.text.slice(0, 100) + '…' : q.text;
  const tag = 'bekao-daily-' + new Date().toISOString().slice(0, 10);

  self.registration.showNotification(title, {
    body: body + '\n\n' + q.options.A + ' | ' + q.options.B + ' | ' + q.options.C + ' | ' + q.options.D,
    icon: '/nursing/icons/icon-192.png',
    badge: '/nursing/icons/icon-192.png',
    tag: tag,
    data: {
      url: '/nursing/quiz.html?daily=' + q.id,
      questionId: q.id,
      answer: q.correct_answer
    },
    requireInteraction: true,
    vibrate: [200, 100, 200]
  });
}

// Schedule daily question at configurable time via periodic sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'bekao-daily-question') {
    event.waitUntil(showDailyQuestion());
  }
});

// Handle notification click → navigate to quiz with daily question
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/nursing/quiz.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('/nursing/') && 'focus' in client) {
            return client.focus().then(() => client.navigate(url));
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Fetch strategy: network-first, cache fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET, API calls, and data files (too large)
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.includes('/nursing/data/questions.json')) return; // too large
  if (url.pathname.includes('/nursing/data/concept_clusters.json')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
