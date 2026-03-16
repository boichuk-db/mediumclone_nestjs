### Article Module (`src/article`)

Модуль `article` відповідає за роботу зі статтями: створення, отримання списку з фільтрами та пагінацією, перегляд однієї статті, оновлення, видалення й додавання/видалення з обраного (favorites).

---

## Структура

- `article.entity.ts` – модель статті в БД (TypeORM entity)
- `article.service.ts` – бізнес-логіка (CRUD для статей, favorites, побудова відповіді)
- `article.controller.ts` – HTTP-ендпоінти (`/articles`, `/articles/:slug`, `/articles/:slug/favorite`)
- `article.module.ts` – модуль, який збирає контролер, сервіс і підключає репозиторії
- `dto/createArticle.dto.ts` – DTO для створення статті
- `dto/updateArticle.dto.ts` – DTO для часткового оновлення статті
- `types/article.response.ts` – тип відповіді з однією статтею
- `types/articles.response.ts` – тип відповіді зі списком статей
- `types/articlesQuery.interface.ts` – типізація query-параметрів для списку статей

---

## `article.entity.ts` – модель статті

```ts
@Entity({ name: 'articles' })
export class ArticleEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  slug: string;

  @Column()
  title: string;

  @Column({ default: '' })
  description: string;

  @Column({ default: '' })
  body: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @Column('simple-array')
  tagList: string[];

  @Column({ default: 0 })
  favoritesCount: number;

  @BeforeUpdate()
  updateTimestamp() {
    this.updatedAt = new Date();
  }

  @ManyToOne(() => UserEntity, (user) => user.articles, { eager: true })
  author: UserEntity;
}
```

**Що важливо:**

- Таблиця `articles` містить базові поля статті + `favoritesCount`.
- `tagList` зберігається як `simple-array` (рядок з переліком тегів, який TypeORM перетворює в масив).
- Через `ManyToOne` + `eager: true` до кожної статті автоматично підвантажується автор.

---

## `article.service.ts` – бізнес-логіка

```ts
@Injectable()
export class ArticleService {
  constructor(
    @InjectRepository(ArticleEntity)
    private readonly articleRepository: Repository<ArticleEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}
```

### `getArticles(query: ArticlesQueryInterface, currentUserId?)`

- Працює через `QueryBuilder`:
  - `orderBy('articles.createdAt', 'DESC')` – новіші статті першими.
  - `leftJoinAndSelect('articles.author', 'author')` – підтягує автора.
- Підтримує query-параметри:
  - `limit?: string | number` – кількість записів (з `@Query()` зазвичай приходить як рядок).
  - `offset?: string | number` – зсув для пагінації (з `@Query()` зазвичай приходить як рядок).
  - `author?: string` – фільтр за `username` автора.
  - `tag?: string` – фільтр по тегу (`tagList LIKE %tag%`).
  - `favorited?: string` – фільтр по username користувача, який лайкнув статтю.
- Повертає `{ articles, articlesCount }`.
- Поле `favorited` в кожній статті:
  - якщо в запиті є валідний JWT (middleware поставить `req.user`) – рахується відносно поточного користувача;
  - якщо токена нема – буде `false`.

### `createArticle(currentUser, createArticleDto)`

- Створює новий `ArticleEntity` та копіює туди поля з `createArticleDto`.
- Якщо `tagList` не переданий – ставить порожній масив.
- Генерує `slug` через `slugify(title)` + випадковий суфікс.
- Привʼязує автора: `article.author = currentUser`.
- Зберігає статтю і повертає її.

### `findBySlug(slug)`

- Шукає статтю по `slug`.
- Якщо не знайдено – кидає `NotFoundException('Article not found')`.
- Використовується в інших методах сервісу як базова операція пошуку.

### `deleteArticle(slug, currentUserId)`

- Завантажує статтю через `findBySlug`.
- Перевіряє, що `article.author.id === currentUserId`, інакше кидає `ForbiddenException`.
- Видаляє статтю по `slug` та повертає `DeleteResult`.

### `updateArticle(slug, updateArticleDto, currentUserId)`

- Шукає статтю по `slug` (`findBySlug`).
- Перевіряє, що поточний користувач є автором.
- Через `Object.assign(article, updateArticleDto)` оновлює тільки передані поля (DTO робить їх опційними).
- Зберігає та повертає оновлену статтю.

### Favorites (`addArticleToFavorites`, `removeArticleFromFavorites`)

- Взаємодіє з `UserEntity.favorites` (звʼязок ManyToMany):
  - `addArticleToFavorites`:
    - завантажує статтю і користувача з відношенням `favorites`;
    - якщо статті ще немає в favorites – додає її й інкрементує `favoritesCount`;
    - зберігає користувача і статтю.
  - `removeArticleFromFavorites`:
    - завантажує статтю і користувача з favorites;
    - якщо стаття є в масиві – видаляє її й декрементує `favoritesCount`;
    - зберігає зміни.

### `buildArticleResponse(article, favorited?)`

- Приводить відповідь до єдиного формату:

```ts
{
  article: ArticleType;
}
```

Цей метод використовується контролером, щоб усі відповіді по статтям були послідовними.

---

## `article.controller.ts` – HTTP-ендпоінти

```ts
@Controller('articles')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}
```

### `GET /articles`

- Повертає список статей з урахуванням пагінації та фільтрів:

```ts
@Get()
async getArticles(
  @Query() query: ArticlesQueryInterface,
  @Req() request: ExpressRequestInterface,
): Promise<ArticlesResponseInterface> {
  return await this.articleService.getArticles(query, request.user?.id);
}
```

- Приклади запитів:
  - `/articles?limit=10&offset=0`
  - `/articles?author=john`
  - `/articles?tag=nestjs`

### `POST /articles` – створення статті

```ts
@Post()
@UseGuards(AuthGuard)
@UsePipes(new ValidationPipe())
async createArticle(
  @User() currentUser: UserEntity,
  @Body('article') createArticleDto: CreateArticleDto,
): Promise<ArticleResponseInterface> {
  const article = await this.articleService.createArticle(
    currentUser,
    createArticleDto,
  );
  return this.articleService.buildArticleResponse(article);
}
```

- Захищений `AuthGuard` – лише авторизовані користувачі можуть створювати статті.
- Тіло запиту очікується у форматі:

```json
{
  "article": {
    "title": "My article",
    "description": "Short desc",
    "body": "Full text",
    "tagList": ["nestjs", "backend"]
  }
}
```

### `GET /articles/:slug` – одна стаття

- Шукає статтю по `slug` і повертає її в обгортці `ArticleResponseInterface`.
- Поле `favorited` працює так само, як і в списку: якщо є токен – відносно поточного користувача, якщо нема – `false`.

### `DELETE /articles/:slug` – видалення статті

- Захищений `AuthGuard`.
- Дозволяє видалити статтю тільки автору; інакше – `ForbiddenException`.

### `PUT /articles/:slug` – оновлення статті

```ts
@Put(':slug')
@UseGuards(AuthGuard)
@UsePipes(new ValidationPipe())
async updateArticle(
  @Param('slug') slug: string,
  @Body('article') updateArticleDto: UpdateArticleDto,
  @User('id') currentUserId: number,
): Promise<ArticleResponseInterface> { ... }
```

- Працює як часткове оновлення:
  - `UpdateArticleDto` робить поля опційними (`title?`, `description?`, `body?`, `tagList?`).
  - Можна оновити лише частину полів (наприклад, тільки `description`).

### Favorites

- `POST /articles/:slug/favorite` – додати статтю в обране.
- `DELETE /articles/:slug/favorite` – забрати статтю з обраного.
- В обох випадках повертається актуальний стан статті (`ArticleResponseInterface`).

---

## Модель даних і міграції

За збереженням структури БД стоять три міграції:

- `1773405657029-CreateArticles.ts` – створює таблицю `articles`.
- `1773406131158-AddRelationsBetweenArticleAndUser.ts` – додає поле `authorId` і звʼязок з таблицею `users`.
- `1773671999790-AddFavouritesRelationsBetweenArticleAndUser.ts` – створює звʼязкову таблицю `users_favorites_articles` для ManyToMany між користувачами та статтями.

Разом із `UserEntity` (`articles: OneToMany`, `favorites: ManyToMany`) це дає повний набір звʼязків для:

- зберігання списку статей користувача;
- списку улюблених статей;
- швидкого підрахунку `favoritesCount`.
