### Profile Module (`src/profile`)

Модуль `profile` відповідає за публічний профіль користувача і підписки (`follow`/`unfollow`).

---

## Структура

- `profile.controller.ts` – `/profiles/:username`, `/profiles/:username/follow`
- `profile.service.ts` – логіка профілю і підписок
- `follow.entity.ts` – таблиця `follows`
- `profile.module.ts` – підключення репозиторіїв `UserEntity` + `FollowEntity`
- `types/profile.type.ts` – внутрішній тип профілю
- `types/profileResponse.interface.ts` – тип відповіді API

---

## Ендпоінти

- `GET /profiles/:username`
  - публічний endpoint;
  - якщо є JWT, поле `following` рахується відносно поточного юзера;
  - якщо JWT нема, `following = false`.

- `POST /profiles/:username/follow` (auth)
  - підписує поточного юзера на `:username`.

- `DELETE /profiles/:username/follow` (auth)
  - відписує поточного юзера від `:username`.

---

## `follow.entity.ts` і гарантії БД

`follows` містить:

- `id`
- `followerId`
- `followingId`

Також налаштовано:

- `@Index(['followerId', 'followingId'], { unique: true })` – заборона дублікатів підписок;
- `ManyToOne` звʼязки на `users` з `onDelete: 'CASCADE'`.

Це дублюється на рівні міграції `1774269000000-AddFollowConstraints.ts` (FK + unique index).

---

## Ключова логіка сервісу

### `getProfile(currentUserId | undefined, profileUsername)`

- шукає користувача по `username`;
- якщо не знайдено → `BackendException.notFound('Profile not found')`;
- якщо `currentUserId` відсутній → повертає профіль з `following: false`;
- якщо `currentUserId` є → перевіряє існування запису в `follows` і ставить `following: true/false`.

### `followProfile(currentUserId, profileUsername)`

- перевіряє, що цільовий профіль існує;
- забороняє self-follow (`BackendException.badRequest('You cannot follow yourself')`);
- створює запис у `follows`, якщо його ще немає;
- повертає профіль з `following: true`.

### `unfollowProfile(currentUserId, profileUsername)`

- перевіряє існування профілю;
- забороняє self-unfollow;
- видаляє запис із `follows`;
- повертає профіль з `following: false`.

### `buildProfileResponse(profile)`

- прибирає `email` з публічної відповіді;
- повертає:

```json
{
  "profile": {
    "id": 1,
    "username": "john",
    "bio": "",
    "image": "",
    "age": null,
    "following": false
  }
}
```

---

## Формат помилок

Модуль використовує `BackendException`, тому помилки повертаються у єдиному форматі:

```json
{
  "errors": {
    "body": ["Profile not found"]
  }
}
```

