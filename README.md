# PrimeClean — Клининговый сервис Беларуси

<div align="center">

![PrimeClean Hero](docs/screenshots/hero.png)

**Чистота без компромиссов**

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![DeepSeek](https://img.shields.io/badge/DeepSeek_AI-4D6BFE?style=for-the-badge&logo=openai&logoColor=white)](https://www.deepseek.com/)

</div>

---

## О проекте

PrimeClean — это лендинг клининговой компании из Беларуси с продающим дизайном, WOW‑анимациями и встроенным AI‑ассистентом. Сайт построен на ванильном стеке (HTML/CSS/JS) без фреймворков, что обеспечивает максимальную скорость загрузки.

### Ключевые особенности

- **AI-ассистент «Алиса»** — LEGO-персонаж в правом нижнем углу, общается с клиентами через DeepSeek API, знает актуальные цены и может сразу заполнить форму заявки
- **Cinematic hero-секция** — полноэкранное видео с параллакс-эффектом и анимированным логотипом
- **Бабочки на Canvas** — анимированные PNG-спрайты (Higgsfield) равномерно распределяются по секции услуг и прячутся под карточки
- **Scroll-кинематика** — покадровая анимация Higgsfield синхронизирована с прокруткой страницы
- **Glassmorphism UI** — чат-панель ассистента с glass-blur эффектом
- **Голосовой ввод** — Web Speech API для диктовки сообщений ассистенту
- **Telegram + SQLite** — backend сохраняет заявки и отправляет уведомления в Telegram

---

## Скриншоты

<table>
  <tr>
    <td><img src="docs/screenshots/hero.png" alt="Hero-секция" /></td>
    <td><img src="docs/screenshots/services.png" alt="Секция услуг" /></td>
  </tr>
  <tr>
    <td align="center"><em>Hero-секция с Higgsfield-видео</em></td>
    <td align="center"><em>Услуги с Canvas-бабочками и AI-ассистентом</em></td>
  </tr>
  <tr>
    <td colspan="2"><img src="docs/screenshots/contact.png" alt="Форма заявки" /></td>
  </tr>
  <tr>
    <td colspan="2" align="center"><em>Форма заявки + AI-ассистент «Алиса»</em></td>
  </tr>
</table>

---

## Стек технологий

### Frontend
| Технология | Применение |
|---|---|
| Vanilla JS (ES2022) | Вся логика без фреймворков |
| CSS3 + Custom Properties | Анимации, glassmorphism, адаптив |
| Canvas 2D API | Система бабочек (dual-layer) |
| Web Speech API | Голосовой ввод в чат |
| WebM + прозрачность | Анимации AI-ассистента |
| IntersectionObserver | Scroll-триггеры и видимость виджета |
| Vercel | Деплой фронтенда |

### Backend
| Технология | Применение |
|---|---|
| Node.js + Express | REST API сервер |
| SQLite (better-sqlite3) | Хранение заявок |
| DeepSeek API | AI-ответы ассистента |
| Telegram Bot API | Уведомления о новых заявках |
| Railway | Деплой бэкенда |
| Docker | Контейнеризация |

### AI & Media
| Инструмент | Применение |
|---|---|
| DeepSeek `deepseek-chat` | Языковая модель ассистента |
| Higgsfield AI | Cinematic видео и спрайты бабочек |
| WebM с alpha-каналом | Прозрачные анимации персонажа |

---

## Структура проекта

```
PrimeCleanV2/
├── frontend/
│   ├── index.html          # Единая страница (SPA-like)
│   ├── style.css           # Все стили (~1400+ строк)
│   ├── app.js              # Вся логика (~900+ строк)
│   ├── serve.json          # Конфиг для локального сервера
│   ├── vercel.config.json  # Деплой на Vercel
│   └── motion/
│       ├── image/          # Изображения карточек услуг
│       └── ai_agent/       # WebM-анимации и PNG персонажа
├── backend/
│   ├── src/
│   │   └── server.js       # Express API: /api/lead, /api/chat
│   ├── .env.example        # Шаблон переменных окружения
│   ├── package.json
│   └── railway.toml        # Конфиг Railway деплоя
├── docker-compose.yml
└── docs/
    └── screenshots/        # Скриншоты для README
```

---

## Локальный запуск

### Frontend
```bash
# Любой статический сервер, например:
npx serve frontend
# Откройте http://localhost:3000
```

### Backend
```bash
cd backend
cp .env.example .env
# Заполните .env своими ключами

npm install
npm run dev
# API доступен на http://localhost:3001
```

### Переменные окружения (backend/.env)
```env
PORT=3001
DEEPSEEK_API_KEY=sk-...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

---

## AI-ассистент «Алиса»

LEGO-девочка в правом нижнем углу — полноценный AI-консультант:

- Знает актуальные цены на все услуги (BYN)
- Проверяет реалистичность введённых данных (площадь vs количество окон)
- Может голосом принять заказ и сразу заполнить форму
- Анимации: idle (покачивание) → greeting (приветствие) → talking (ответ)
- Голосовой ввод через Web Speech API (Chrome/Edge)

---

## Услуги

| Услуга | Цена от |
|---|---|
| Уборка квартир | 80 BYN (2 BYN/м²) |
| Клининг офисов | 180 BYN (1.8 BYN/м²) |
| Генеральная уборка | 240 BYN (6 BYN/м²) |
| Уборка после ремонта | 360 BYN (9 BYN/м²) |
| Уборка домов | 180 BYN |
| Химчистка мебели | 18 BYN/м² |

---

## Контакты

- Телефон: **+375 (44) 478-93-60**
- Email: **info@primeclean.by**
- Telegram: **@primeclean_by**
- Режим работы: Пн–Пт 08:00–20:00, Сб–Вс 09:00–18:00

---

<div align="center">
  <sub>© 2026 PrimeClean. Все права защищены.</sub>
</div>
