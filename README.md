# sinirAI (Local) Chat

**Интерактивный чат-интерфейс для работы с локальными AI-моделями через LM Studio**

[![Python](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.0+-green.svg)](https://flask.palletsprojects.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 📖 Описание

Веб-интерфейс для взаимодействия с локальными LLM моделями через [LM Studio](https://lmstudio.ai/). Поддерживает:

- **Стриминговый режим** (SSE) для отображения ответов в реальном времени
- **Reasoning-модели** (Qwen 3.5, охотник и др.) с отображением "мыслей модели"
- **Мультичат** - несколько диалогов одновременно
- **Автодополнение кода** с подсветкой синтаксиса
- **Адаптивный дизайн** для десктопа и мобильных устройств

---

## Возможности

### Основные функции

| Функция | Описание |
|---------|----------|
|  **Стриминг ответов** | Отображение текста модели по мере генерации (SSE) |
|  **Reasoning-панель** | Визуализация "мыслей" reasoning-моделей в реальном времени |
|  **Мультичат** | Создание нескольких диалогов без перезагрузки страницы |
|  **Подсветка кода** | Поддержка Python, JavaScript, SQL и других языков |
|  **Статистика** | Отслеживание числа сообщений и использованных токенов |
|  **Копирование кода** | Кнопка копирования с анимацией "Скопировано!" |

### Интерфейс

- Современный дизайн в стиле Glassmorphism
- Анимации переходов и микро-взаимодействия
- Тёмная тема по умолчанию (eye-friendly)
- Адаптивная верстка для мобильных устройств

---

## Технологии

### Backend
- **Python 3.8+** - основной язык разработки
- **Flask** - веб-фреймворк для HTTP-запросов
- **Requests** - работа с API LM Studio
- **python-dotenv** - управление переменными окружения

### Frontend
- **Vanilla JavaScript** (ES6+) - чистый JS без фреймворков
- **CSS3** - Flexbox, Grid, CSS Variables, Animations
- **Font Awesome 6.5** - иконки интерфейса
- **Highlight.js** - подсветка синтаксиса кода

### AI Stack
- **LM Studio API** - OpenAI-compatible endpoint
- **Reasoning models** (Qwen 3.5, o1 и др.)
- **SSE Stream** - Server-Sent Events для стриминга

---

## Структура проекта

```
├── app.py                 # Основной Flask-сервер
├── templates/
│   └── index.html         # HTML-шаблон чата
├── static/
│   ├── style.css          # CSS-стили (Glassmorphism + анимации)
│   ├── script.js          # Frontend JS (Websocket клиент)
│   └── logo.svg           # Логотип приложения
├── .env                   # Переменные окружения
├── README.md              # Документация
└── .gitignore             # Исключения для Git
```

---

## Быстрый старт

### 1. Установка зависимостей

```bash
# Создание виртуального окружения
python -m venv venv

# Активация окружения
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Установка пакетов
pip install flask python-dotenv requests
```

### 2. Настройка LM Studio

1. Скачайте [LM Studio](https://lmstudio.ai/)
2. Загрузите модель (рекомендуется Qwen 3.5 для reasoning)
3. Запустите сервер LM Studio на порт **1234**

### 3. Конфигурация

Файл `.env` в корне проекта:

```env
LM_STUDIO_URL=http://localhost:1234/v1/chat/completions
```

Для доступа с других устройств:

```env
LM_STUDIO_URL=http://<ВАШ_ЛОКАЛЬНЫЙ_IP>:1234/v1/chat/completions
```

### 4. Запуск сервера

```bash
# Windows PowerShell
python app.py

# Linux/Mac
./venv/bin/python app.py
```

**Ожидайте вывод:**
```
Запуск Flask-сервера для LM Studio...
LM Studio: http://localhost:1234/v1/chat/completions
Доступно по:
   • Локально: http://localhost:5000
   • С телефона: http://<ВАШ_IP>:5000

Убедитесь, что LM Studio запущен и модель загружена!
```

---

## 📡 API-эндпоинты

### GET запросы

| Эндпоинт | Метод | Описание |
|----------|-------|----------|
| `/` | GET | Главная страница с выбором моделей |
| `/api/models` | GET | Получение списка загруженных моделей в LM Studio |
| `/api/health` | GET | Проверка состояния подключения к LM Studio |

### POST запросы

| Эндпоинт | Метод | Описание |
|----------|-------|----------|
| `/api/chat` | POST | Обычный чат (полный ответ) |
| `/api/chat/stream` | POST | Стриминговый чат с SSE |

**Пример запроса:**

```json
POST /api/chat
{
  "model": "local-model",
  "messages": [
    {
      "role": "user",
      "content": "Напиши код для вычисления факториала"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 2048
}
```

---

## Примеры использования

### Простой вопрос-ответ

```javascript
// Введите в поле ввода:
"Объясни что такое квантовая механика простыми словами"

// Или используйте быстрые действия:
• Приветствие
• Что такое AI?
• Код на Python
• Идея стартапа
```

### Генерация кода

```javascript
// Введите:
"Напиши функцию для сортировки массива пузырьковой сортировкой на Python"

// Получите ответ с подсветкой синтаксиса и кнопкой "Копировать"
```

### Reasoning-модели (Qwen 3.5)

Для демонстрации режимов размышления используйте модели:
- **Qwen 3.5**
- **o1-preview** 
- **o1-mini**

```javascript
// Пример с reasoning:
"Подумай шаг за шагом и реши задачу о движении двух тел навстречу друг другу"

// Модель покажет "Ход мыслей" в отдельной панели сверху от ответа! 
```

---

## 🔧 Настройки

### Переменные окружения (`.env`)

```env
# Адрес LM Studio API
LM_STUDIO_URL=http://localhost:1234/v1/chat/completions

# Для доступа из сети/с телефона замените на IP-адрес вашего ПК
# Например: http://192.168.1.100:1234/v1/chat/completions
```

### В настройках интерфейса

- **Модель** - выберите модель в выпадающем списке
- **Стриминг** - включите/выключите потоковую передачу ответа

---

## Отладка

### Проверка подключения к LM Studio

Откройте консоль браузера (F12) и выполните:

```javascript
fetch('/api/health')
  .then(r => r.json())
  .then(console.log);
// Ожидаем: { "status": "ok", "lm_studio": "ok", "models_count": X }
```

### Проверка списка моделей

```javascript
fetch('/api/models')
  .then(r => r.json())
  .then(models => console.log(models));
// Пример: [{ "id": "Qwen/Qwen3-...", "name": "..." }]
```

---

## Доступ с мобильных устройств

1. Узнайте локальный IP компьютера, с которого запускаете сервер:
   ```powershell
   # Windows PowerShell
   ipconfig | Select-String "IPv4"
   ```

2. Замените в `.env`:
   ```env
   LM_STUDIO_URL=http://192.168.1.100:1234/v1/chat/completions
   ```

3. С мобильного устройства откройте: `http://<IP_КОМПЬЮТЕРА>:5000`

---

## Лицензия

MIT License - свободное использование для личных и коммерческих проектов.

---

## Благодарности

- [LM Studio](https://lmstudio.ai/) - за OpenAI-compatible API
- [Flask](https://flask.palletsprojects.com/) - за мощный веб-фреймворк
- [Font Awesome](https://fontawesome.com/) - за красивые иконки
- [Highlight.js](https://highlightjs.org/) - за подсветку кода

---

## Поддержка

Если нашли ошибку или хотите улучшить проект:

1. Создайте issue в репозитории GitHub
2. Опишите проблему + шаги для воспроизведения
3. Приложите скриншот (если визуальный баг)

---

**Сделано с ❤️ для сообщества AI-разработчиков!** 
