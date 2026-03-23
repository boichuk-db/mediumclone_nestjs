### User Module (`src/user`)

Модуль `user` відповідає за реєстрацію, логін, поточного користувача і JWT-аутентифікацію.

---

## Структура

- `user.entity.ts` – модель `users` у БД
- `user.service.ts` – логіка реєстрації/логіну/оновлення профілю
- `user.controller.ts` – `/users`, `/users/login`, `/user` (GET/PUT)
- `middleware/auth.middleware.ts` – витягує JWT і кладе `req.user`
- `guards/auth.guard.ts` – блокує неавторизовані запити
- `decorators/user.decorator.ts` – доступ до `@User()` / `@User('id')`
- `dto/*.dto.ts` – вхідні DTO
- `types/userResponse.interface.ts` – тип відповіді

---

## Ендпоінти

- `POST /users` – реєстрація
- `POST /users/login` – логін
- `GET /user` – поточний користувач (auth)
- `PUT /user` – оновлення поточного користувача (auth)

---

## Валідація й формат помилок

- Контролер використовує `BackendValidationPipe`.
- Бізнес-помилки кидаються через `BackendException`.
- Формат помилки по всьому API:

```json
{
  "errors": {
    "body": ["..."]
  }
}
```

або для field-level:

```json
{
  "errors": {
    "email": ["is already in use"]
  }
}
```

---

## `user.service.ts` (головне)

### `createUser`

- перевіряє унікальність `email` і `username`;
- при конфлікті повертає 422 через:
  - `BackendException.validation('email', 'is already in use')`
  - `BackendException.validation('username', 'is already in use')`;
- зберігає `UserEntity` (пароль хешується через `@BeforeInsert`).

### `login`

- шукає користувача по email з явним вибором `password`;
- перевіряє пароль через `bcrypt.compare`;
- при помилці повертає `BackendException.unauthorized('Invalid credentials')`.

### `updateUser`

- дозволяє часткове оновлення;
- перевіряє унікальність `email`/`username` при зміні;
- хешує новий пароль перед збереженням.

### `buildUserResponse`

Повертає:

```json
{
  "user": {
    "...public fields": "...",
    "token": "jwt"
  }
}
```

---

## Auth flow

### `AuthMiddleware`

- читає `Authorization: Bearer <token>`;
- верифікує токен через `JwtService`;
- завантажує користувача з БД і ставить `req.user`;
- якщо токен невалідний/відсутній — `req.user = undefined`.

### `AuthGuard`

- пропускає тільки якщо `request.user` присутній;
- інакше кидає `BackendException.unauthorized('Unauthorized')`.

### `@User()` decorator

- дістає користувача з `request.user`;
- може повернути все тіло користувача або конкретне поле (`@User('id')`);
- якщо `request.user` відсутній — також `BackendException.unauthorized('Unauthorized')`.

---

## Потік запиту `GET /user`

1. Middleware пробує дістати юзера з JWT.
2. Guard перевіряє, що юзер є.
3. Декоратор `@User()` передає юзера в контролер.
4. Контролер повертає `buildUserResponse(user)`.
