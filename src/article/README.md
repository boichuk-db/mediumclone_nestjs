### Article Module (`src/article`)

Модуль `article` відповідає за:

- CRUD статей
- favorites (`favorite`/`unfavorite`)
- персоналізований `feed`
- коментарі до статей

---

## Структура

- `article.entity.ts` – модель `articles` (включно з `slug` як `unique`)
- `comment.entity.ts` – модель `comments`
- `article.service.ts` – бізнес-логіка статей/favorites/feed/comments
- `article.controller.ts` – REST API для статей і коментарів
- `article.module.ts` – реєстрація `ArticleEntity`, `CommentEntity`, `UserEntity`, `FollowEntity`
- `dto/createArticle.dto.ts` – DTO створення статті
- `dto/updateArticle.dto.ts` – DTO часткового оновлення статті
- `dto/createComment.dto.ts` – DTO створення коментаря
- `types/article.type.ts` – публічний тип статті (`favorited` + нормалізований `author`)
- `types/article.response.ts`, `types/articles.response.ts` – контракти відповіді для статей
- `types/comment.type.ts`, `types/comment.response.ts`, `types/comments.response.ts` – контракти відповіді для коментарів
- `types/articlesQuery.interface.ts` – query-параметри списку/фіду

---

## Ендпоінти

### Статті

- `GET /articles` – список з фільтрами (`author`, `tag`, `favorited`, `limit`, `offset`)
- `GET /articles/feed` – фід статей авторів, на яких підписаний поточний користувач (auth)
- `GET /articles/:slug` – одна стаття
- `POST /articles` – створити статтю (auth)
- `PUT /articles/:slug` – оновити статтю (auth, тільки автор)
- `DELETE /articles/:slug` – видалити статтю (auth, тільки автор)
- `POST /articles/:slug/favorite` – лайкнути статтю (auth)
- `DELETE /articles/:slug/favorite` – прибрати лайк (auth)

### Коментарі

- `GET /articles/:slug/comments` – список коментарів (auth optional)
- `POST /articles/:slug/comments` – створити коментар (auth)
- `DELETE /articles/:slug/comments/:id` – видалити свій коментар (auth)

---

## Контракт відповіді

### `article.author`

Автор статті повертається в публічному форматі:

- `username`
- `bio`
- `image`
- `following` (чи фоловить поточний юзер автора)

### `article.favorited`

`favorited` обчислюється відносно поточного користувача:

- для anonymous користувача завжди `false`
- для authenticated — за зв'язком `users_favorites_articles`

---

## Ключова логіка сервісу

### `getArticles(query, currentUserId?)`

- `QueryBuilder` + `ORDER BY createdAt DESC`
- фільтрація по `author`, `tag`, `favorited`
- пагінація через `limit/offset`
- для кожної статті розраховуються `favorited` та `author.following`

### `getFeed(query, currentUserId)`

- бере `followingId` з таблиці `follows`
- повертає статті тільки цих авторів
- додає `favorited` та `author.following`

### `getArticleBySlug(slug, currentUserId?)`

- повертає одну статтю
- розраховує персоналізовані `favorited` і `author.following`

### `comments`

- коментарі зберігаються в таблиці `comments`
- в `GET`/`POST` коментарі повертаються з автором у форматі profile (`following` теж рахується)
- `DELETE` дозволено тільки автору коментаря

### Обробка помилок

Використовується `BackendException` з єдиним форматом:

```json
{
  "errors": {
    "body": ["..."]
  }
}
```

---

## Валідація

- `POST /articles`, `PUT /articles/:slug`, `POST /articles/:slug/comments` використовують `BackendValidationPipe`
- пайп повертає помилки у форматі `errors`

---

## Міграції, що стосуються article

- `1773405657029-CreateArticles.ts` – створення `articles`
- `1773406131158-AddRelationsBetweenArticleAndUser.ts` – `authorId` + FK на `users`
- `1773671999790-AddFavouritesRelationsBetweenArticleAndUser.ts` – таблиця `users_favorites_articles`
- `1774265418400-CreateFollows.ts`
- `1774269000000-AddFollowConstraints.ts` – constraints для `follows` (потрібно для `feed` і `following`)
- `1774280000000-CreateComments.ts` – створення `comments` + FK
- `1774295000000-AddUniqueSlugToArticles.ts` – унікальний індекс на `articles.slug`
