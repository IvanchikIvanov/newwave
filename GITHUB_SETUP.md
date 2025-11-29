# Инструкция по загрузке на GitHub

## Шаги:

1. **Создай репозиторий на GitHub:**
   - Зайди на [github.com](https://github.com)
   - Нажми "+" → "New repository"
   - Название: `gungeon-lite-boss-rush` (или любое другое)
   - Выбери Public или Private
   - **НЕ** добавляй README, .gitignore или лицензию (у нас уже есть)
   - Нажми "Create repository"

2. **Подключи локальный репозиторий к GitHub:**

   Скопируй URL твоего репозитория (например: `https://github.com/твой-username/gungeon-lite-boss-rush.git`)

   Затем выполни команды:

   ```bash
   git branch -M main
   git remote add origin https://github.com/твой-username/gungeon-lite-boss-rush.git
   git push -u origin main
   ```

3. **Готово!** Код загружен на GitHub.

## После загрузки:

### Для деплоя на Vercel:
- Зайди на vercel.com
- Подключи GitHub репозиторий
- Vercel автоматически задеплоит проект

### Для деплоя на Netlify:
- Зайди на netlify.com
- Подключи GitHub репозиторий
- Netlify автоматически задеплоит проект

### Для деплоя на GitHub Pages:
- В репозитории перейди в Settings → Pages
- Source: GitHub Actions
- Workflow запустится автоматически при следующем push

**Важно:** Если название репозитория отличается от `gungeon-lite-boss-rush`, измени `base` в `vite.config.ts` на `/твое-название-репозитория/`

