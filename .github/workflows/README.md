# GitHub Actions для Docker

Этот workflow автоматически собирает и публикует Docker образы в GitHub Container Registry (GHCR).

## Когда запускается:

1. **При push в main/master** - собирает и публикует образы с тегом `latest`
2. **При создании тега `v*`** (например `v1.0.0`) - создает версионные образы
3. **При pull request** - собирает образы для тестирования (не публикует)
4. **Вручную** - через кнопку "Run workflow" в GitHub Actions

## Что делает:

- Собирает образы на **нативном Linux x86-64** (без эмуляции!)
- Публикует в `ghcr.io/mikeozornin/side-by-side`
- Использует GitHub Actions cache для ускорения сборки
- Создает теги:
  - `latest` - для последнего коммита в main/master
  - `v1.0.0`, `v1.0`, `v1` - для версионных тегов
  - `pr-123` - для pull request'ов

## Первый запуск:

### 1. Включите GitHub Actions (если не включены)
   - Зайдите в Settings → Actions → General
   - Разрешите "Read and write permissions" для GITHUB_TOKEN

### 2. Включите GitHub Container Registry
   - Зайдите в Settings → Packages
   - Убедитесь, что пакеты публичные или настройте доступ

### 3. Запустите workflow вручную
   - Зайдите в Actions → Build and Push Docker Images
   - Нажмите "Run workflow"
   - Выберите ветку (master/main)
   - Нажмите "Run workflow"

### 4. Дождитесь завершения
   - Сборка займет 5-10 минут
   - Образы появятся в `ghcr.io/mikeozornin/side-by-side`

## Использование собранных образов:

После успешной сборки образы доступны по адресам:
- `ghcr.io/mikeozornin/side-by-side-server:latest`
- `ghcr.io/mikeozornin/side-by-side-client:latest`

На VPS просто запустите:
```bash
docker compose pull
docker compose up -d
```

## Версионирование:

Для создания новой версии:
```bash
git tag v1.0.0
git push origin v1.0.0
```

Это создаст образы:
- `ghcr.io/mikeozornin/side-by-side-server:v1.0.0`
- `ghcr.io/mikeozornin/side-by-side-server:v1.0`
- `ghcr.io/mikeozornin/side-by-side-server:v1`
- `ghcr.io/mikeozornin/side-by-side-server:latest`

## Troubleshooting:

### Ошибка доступа к GHCR
Проверьте права токена в Settings → Actions → General → Workflow permissions

### Образы не видны
Проверьте видимость пакетов в Settings → Packages

### Сборка падает
Посмотрите логи в Actions → Build and Push Docker Images → последний run

