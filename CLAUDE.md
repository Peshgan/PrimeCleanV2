# PrimeClean — CLAUDE.md

## Проект
Сайт клининговой компании PrimeClean (Беларусь). Vanilla JS + CSS3 + Canvas 2D + WebGL2.
Стек намеренно без фреймворков — скорость и полный контроль над анимациями.

## Структура репозитория
```
PrimeCleanV2/
├── frontend/           → деплой на Vercel
│   ├── index.html      — единственная страница (SPA)
│   ├── style.css       — весь CSS (~1500+ строк)
│   ├── app.js          — весь JS (~1500+ строк)
│   ├── serve.json      — SPA rewrite (source: /**, destination: /index.html)
│   ├── vercel.config.json
│   ├── vite.config.js  — Vite build pipeline (compression + legacy)
│   ├── package.json    — dev-зависимости: lighthouse, sharp, vite-plugins
│   └── motion/
│       ├── video/      — start_site.mp4 (preloader), Backgroundscrollanimation.mp4 (scroll)
│       ├── image/      — *.jpg (используются в HTML), *.webp (бабочки в JS), *.png (orphans)
│       ├── audio/      — click1-4.mp3 (UI sound FX), lid1-4.mp3 (form sounds)
│       └── ai_agent/   — WebM (Chrome/FF прозрачность), MP4 dual-plane (Safari fallback)
└── backend/            → деплой на Railway
    └── src/server.js   — Express: /api/chat (DeepSeek), /api/leads (SQLite+Telegram)
```

## ЖЕЛЕЗОБЕТОННЫЕ ПРАВИЛА

### 1. Scroll → Video механика
`Backgroundscrollanimation.mp4` воспроизводится по скроллу:
```js
video.currentTime = smoothProgress × video.duration
```
Spring-физика: `velocity += diff * 0.018; velocity *= 0.78`
**Никогда не ломать эту механику** — это сердце сайта.

### 2. HTML-in-Canvas
`ctx.drawElementImage(htmlEl, 0, 0)` рендерит HTML-главы в 2D canvas,
затем WebGL2 шейдер применяет: хроматическая аберрация + bloom + wave + mouse-ripple.
Fallback: `body.no-canvas` — главы показываются напрямую (z-index: 4).

### 3. Safari/iOS: dual-plane MP4
WebM с прозрачностью не работает в Safari. Используем H.264 dual-plane:
- верхняя половина = RGB цвет, нижняя = grayscale альфа-маска
- Canvas пиксельный рендерер читает обе половины
- Порог альфа: `ad[i] < 48 ? 0 : ad[i]` (артефакты H.264 < 48/255)

### 4. Performance tiers
`detectPerf()` возвращает 'low' | 'medium' | 'high':
- low: бабочки выключены, WebGL отключён, анимации минимальны
- medium: 9 бабочек (вместо 18), WebGL включён
- high: всё включено, 18 бабочек
Тир применяется через `document.body.dataset.perf`

### 5. Запуск локально
```bash
npx serve -s frontend -p 3000
```
**Флаг `-s` обязателен** — без него SPA не работает.

## Дизайн-система
- Цвета: `--blue: #1a6cff`, `--cyan: #00eaff`, `--dark: #06080f`
- Шрифты: Bebas Neue (заголовки), Inter (текст)
- Glass morphism: `backdrop-filter: blur()`, `rgba(255,255,255,0.03–0.06)`

## AI-агент «Алиса»
- WebM с прозрачностью для Chrome/Firefox (3 состояния: idle, greeting, talking)
- Dual-plane MP4 canvas рендерер для Safari/iOS
- Машина состояний: idle → greeting → listening → talking → listening
- Backend: `/api/chat` с DeepSeek (API key на сервере — не в фронтенде!)
- Голос: `start_agent_voice.mp3` при первом открытии
- Виджет скрывается когда видна секция `#scroll-exp` (IntersectionObserver threshold 0.15)

## Что сделано
- [x] Preloader с видео + счётчик 0→100
- [x] Scroll experience (600vh, 5 глав)
- [x] WebGL2 шейдер (хроматическая аберрация, bloom, wave, ripple)
- [x] Секция услуг (6 карточек, бабочки-спрайты, stagger reveal)
- [x] AI-агент Алиса (WebM + Safari fallback, DeepSeek, голосовой ввод)
- [x] Форма заявки → backend → SQLite + Telegram уведомление
- [x] Кастомный курсор (dot + ring, lerp 0.11)
- [x] Клик-звуки (pooled, cooldown 80ms)
- [x] Form success overlay с конфетти
- [x] Performance detection (low/medium/high tiers)
- [x] Lite mode CSS ([data-perf="low/medium"])
- [x] prefers-reduced-motion support
- [x] Vite build pipeline (compression + legacy browsers)

## Что нужно сделать
- [ ] Заполнить Railway env: DEEPSEEK_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
- [ ] Заменить G-XXXXXXXXXX на реальный GA4 ID
- [ ] Заменить 0 на реальный Yandex Metrika ID
- [ ] Слайдер до/после (brainstorm pending — ждём Higgsfield фото)
- [ ] Секция отзывов с аватарами (Higgsfield генерация)
- [ ] Lighthouse audit после деплоя

## Известные баги (исправлены)
- `<video id="sv">` — пропущен `>` перед `<source>` (исправлено 2026-05-20)
- Safari чёрный фон агента — H.264 артефакты, порог 48 (исправлено)
- `hideGreetBubble is not defined` ReferenceError (исправлено)
- agent-character не кликался — из-за ReferenceError выше (исправлено)

## Медиа-файлы: что используется
| Файл | Используется | Размер |
|------|-------------|--------|
| motion/video/Backgroundscrollanimation.mp4 | ДА | 5.5MB |
| motion/video/start_site.mp4 | ДА (preloader) | 1MB |
| motion/image/*.jpg | ДА (HTML) | 120–330KB |
| motion/image/*.webp | ДА (butterflies JS) | 580–770KB |
| motion/image/*.png | НЕТ (orphans, кроме ai_agent/) | 1.9–14MB |
| motion/ai_agent/*.webm | ДА (Chrome/FF) | 2.5–7.5MB |
| motion/ai_agent/*_combined.mp4 | ДА (Safari) | 128–236KB |

## Backend API
- `POST /api/chat` — DeepSeek AI, тело: `{ messages: [...] }`
- `POST /api/leads` — сохраняет лид + Telegram уведомление
- `GET /health` — healthcheck
- База URL: `window.PC_API` из index.html (Railway URL)

## Higgsfield CLI
```bash
higgsfield generate create gpt_image_2 --prompt "..." --aspect_ratio "4:3" --wait
```
Авторизован как `pablonewsgm@gmail.com`, план plus, ~228 кредитов.

## Деплой
- Frontend: Vercel (автодеплой из master)
- Backend: Railway (автодеплой из master, папка backend/)
- Команда сборки: `npm run build` (Vite, из папки frontend/)
