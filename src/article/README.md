### Article Module (`src/article`)

Модуль `article` відповідає за CRUD статей, favorites і персоналізований стрічковий `feed`.

---

## Структура

- `article.entity.ts` – модель `articles`
- `article.service.ts` – бізнес-логіка списку/фіду/CRUD/favorites
- `article.controller.ts` – ендпоінти `/articles`, `/articles/feed`, `/articles/:slug`
- `article.module.ts` – підключення `ArticleEntity`, `UserEntity`, `FollowEntity`
- `dto/createArticle.dto.ts` – DTO створення
- `dto/updateArticle.dto.ts` – DTO часткового оновлення
- `types/article.type.ts` – публічна модель статті (`favorited`)
- `types/article.response.ts` – відповідь з однією статтею
- `types/articles.response.ts` – відповідь зі списком
- `types/articlesQuery.interface.ts` – query-параметри списку/фіду

---

## Ендпоінти

- `GET /articles` – загальний список з фільтрами (`author`, `tag`, `favorited`, `limit`, `offset`)
- `GET /articles/feed` – стрічка статей авторів, на яких підписаний поточний користувач
- `GET /articles/:slug` – одна стаття
- `POST /articles` – створити статтю (auth)
- `PUT /articles/:slug` – оновити статтю (auth + тільки автор)
- `DELETE /articles/:slug` – видалити статтю (auth + тільки автор)
- `POST /articles/:slug/favorite` – лайкнути статтю (auth)
- `DELETE /articles/:slug/favorite` – прибрати лайк (auth)

---

## Ключова логіка сервісу

### `getArticles(query, currentUserId?)`

- Працює через `QueryBuilder` з сортуванням по `createdAt DESC`.
- Підтримує пагінацію (`limit`, `offset`) і фільтри:
  - `author` (по username автора),
  - `tag`,
  - `favorited` (по username користувача, який лайкнув статті).
- Повертає масив `ArticleType[]`, де для кожної статті є `favorited`.

### `getFeed(query, currentUserId)`

- Дістає з `follows` список `followingId` поточного юзера.
- Повертає тільки статті цих авторів.
- Також додає `favorited` для поточного користувача.

### `getArticleBySlug(slug, currentUserId?)`

- Повертає одну статтю + коректний `favorited` (якщо юзер відомий).

### `add/remove favorites`

- Працює через `users_favorites_articles` (ManyToMany у `UserEntity.favorites`).
- Синхронізує `favoritesCount` в `articles`.

### Обробка помилок

- Для 404/403 використовується `BackendException` у форматі:

```json
{
  "errors": {
    "body": ["..."]
  }
}
```

---

## Валідація

- `POST /articles` і `PUT /articles/:slug` використовують `BackendValidationPipe`.
- Помилки DTO також повертаються у форматі `errors`.

---

## Міграції, які стосуються статей

- `1773405657029-CreateArticles.ts` – таблиця `articles`
- `1773406131158-AddRelationsBetweenArticleAndUser.ts` – `authorId` + FK на `users`
- `1773671999790-AddFavouritesRelationsBetweenArticleAndUser.ts` – `users_favorites_articles`
- `1774265418400-CreateFollows.ts` + `1774269000000-AddFollowConstraints.ts` – потрібні для `GET /articles/feed`
