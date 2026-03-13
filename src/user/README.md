### User Module (`src/user`)

Модуль `user` відповідає за роботу з користувачами: реєстрація, логін, поточний користувач і аутентифікація через JWT.

---

## Структура

- `user.entity.ts` – модель користувача в БД (TypeORM entity)
- `user.service.ts` – бізнес-логіка (створення, логін, оновлення, пошук, JWT, формат відповіді)
- `user.controller.ts` – HTTP-ендпоінти (`/users`, `/users/login`, `/user` GET/PUT)
- `middleware/auth.middleware.ts` – читає JWT з заголовка і ставить `req.user`
- `guards/auth.guard.ts` – перевіряє, що `req.user` існує, інакше 401
- `decorators/user.decorator.ts` – дає зручний `@User()` параметр у контролері
- `user.module.ts` – збирає все разом, підключає TypeORM + JWT
- `types/userResponse.interface.ts` – тип відповіді `user + token`
- `dto/createUser.dto.ts` – DTO для реєстрації
- `dto/loginUser.dto.ts` – DTO для логіну
- `dto/updateUser.dto.ts` – DTO для часткового оновлення поточного користувача

---

## `user.entity.ts` – модель користувача

```ts
@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  username: string;

  @Column()
  email: string;

  @Column({ default: '' })
  bio: string;

  @Column({ default: '' })
  image: string;

  @Column({ nullable: true, default: null })
  age: number;

  @Column({ select: false })
  password: string;

  @BeforeInsert()
  async hashPassword() {
    this.password = await hash(this.password, 10);
  }
}
```

**Що важливо:**

- Це опис таблиці `users` у PostgreSQL.
- `password` має `select: false`, тому **не приходить з БД за замовчуванням**.
- `@BeforeInsert` автоматично хешує пароль перед збереженням.

---

## `user.service.ts` – бізнес-логіка

```ts
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly jwtService: JwtService,
  ) {}
```

### `createUser(createUserDto)`

- Перевіряє унікальність:
  - `email` (якщо вже є → 422 `Email is already in use`)
  - `username` (якщо вже є → 422 `Username is already in use`)
- Створює `UserEntity`, копіює туди дані, зберігає в БД.
- Пароль хешується через `@BeforeInsert`.

### `login(loginUserDto)`

- Шукає користувача по email і явно витягує `password`:
  - `select: ['id', 'email', 'username', 'bio', 'image', 'password']`.
- Якщо не знайдено або пароль не збігається → 401 `Invalid credentials`.
- Видаляє пароль з обʼєкта й повертає користувача без нього.

### `updateUser(id, updateUserDto)`

- Приймає `id` користувача і `UpdateUserDto` з полями, які можна змінювати:
  - `username?`, `email?`, `password?`, `bio?`, `image?`.
- Якщо змінюється `email`:
  - перевіряє, що такого email ще немає в інших користувачів;
  - якщо є → 422 `Email is already in use`.
- Якщо змінюється `username`:
  - перевіряє унікальність username;
  - якщо зайнятий → 422 `Username is already in use`.
- Через `Object.assign(user, updateUserDto)` оновлює тільки передані поля.
- Зберігає зміненого користувача в БД і повертає його.

### `findById(id)`

- Шукає користувача по `id`.
- Якщо нема – кидає 404 `User not found`.
- Використовується там, де з токена дістається `id` і треба отримати юзера з БД.

### `generateJwt(user)` і `buildUserResponse(user)`

- `generateJwt` створює токен із `id`, `username`, `email`.
- `buildUserResponse` повертає відповідь формату:

```ts
{
  user: {
    ...user,      // дані користувача без пароля
    token: '...', // JWT
  }
}
```

---

## `types/userResponse.interface.ts` – тип відповіді

```ts
export interface UserResponseInterface {
  user: UserType & { token: string };
}
```

- Визначає, що контролер повертає `user` з public-полями + `token`.

---

## `user.module.ts` – модуль користувача

```ts
@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'dev-secret-change-in-production'),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN', '7d'),
        },
      }),
    }),
  ],
  controllers: [UserController],
  providers: [UserService, AuthGuard],
  exports: [UserService],
})
export class UserModule {}
```

**Що робить:**

- Підключає репозиторій `UserEntity` (`InjectRepository(UserEntity)`).
- Налаштовує `JwtModule` на основі змінних середовища.
- Реєструє контролер, сервіс і guard.
- Експортує `UserService` для інших модулів.

---

## `user.controller.ts` – HTTP-ендпоінти

```ts
@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}
```

### `POST /users` – реєстрація

```ts
@Post('users')
@UsePipes(new ValidationPipe())
async createUser(
  @Body('user') createUserDto: CreateUserDto,
): Promise<UserResponseInterface> {
  const users = await this.userService.createUser(createUserDto);
  return this.userService.buildUserResponse(users);
}
```

- Приймає `{ user: { username, email, password, ... } }`.
- DTO + валідація перевіряють дані.
- Створює користувача, повертає `user + token`.

### `POST /users/login` – логін

```ts
@Post('users/login')
@UsePipes(new ValidationPipe())
async login(
  @Body('user') loginUserDto: LoginUserDto,
): Promise<UserResponseInterface> {
  const users = await this.userService.login(loginUserDto);
  return this.userService.buildUserResponse(users);
}
```

- Приймає `{ user: { email, password } }`.
- Якщо логін успішний – повертає `user + token`.

### `GET /user` – поточний користувач

```ts
@Get('user')
@UseGuards(AuthGuard)
async currentUser(@User() user: UserEntity): Promise<UserResponseInterface> {
  return this.userService.buildUserResponse(user);
}
```

- Захищений `AuthGuard` – потрібно мати валідний токен.
- `@User()` декоратор дістає користувача з `request.user`.
- Повертає поточного користувача з токеном.

### `PUT /user` – оновлення поточного користувача

```ts
@Put('user')
@UseGuards(AuthGuard)
async updateCurrentUser(
  @User() user: UserEntity,
  @Body('user') updateUserDto: UpdateUserDto,
): Promise<UserResponseInterface> {
  const updatedUser = await this.userService.updateUser(
    user.id,
    updateUserDto,
  );
  return this.userService.buildUserResponse(updatedUser);
}
```

- Захищений `AuthGuard` – доступ лише для авторизованих.
- Очікує тіло виду:

```json
{
  "user": {
    "email": "new@mail.com",
    "password": "NewPass123",
    "bio": "About me"
  }
}
```

- `UpdateUserDto` робить усі поля **опційними**, тому можна змінювати тільки частину профілю.
- У сервісі перевіряється унікальність `email` і `username`, після чого повертається оновлений користувач з новим токеном.

---

## `middleware/auth.middleware.ts` – чіпляє користувача до request

```ts
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly userService: UserService) {}

  async use(req: ExpressRequestInterface, res: Response, next: NextFunction) {
    if (!req.headers.authorization) {
      req.user = undefined;
      next();
      return;
    }
    const token = req.headers.authorization.split(' ')[1];

    try {
      const jwtService = new JwtService();
      const decoded = jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });
      const user = await this.userService.findById(decoded.id);
      req.user = user;
      return next();
    } catch (error) {
      req.user = undefined;
      return next();
    }
  }
}
```

**Роль:**

- Читає `Authorization: Bearer <token>`.
- Перевіряє токен.
- Дістає `id` з payload, завантажує юзера з БД.
- Кладе юзера в `req.user`.
- Якщо щось не так → `req.user = undefined`, але запит продовжується як “анонімний”.

---

## `guards/auth.guard.ts` – пропускає лише авторизованих

```ts
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<ExpressRequestInterface>();
    if (request.user) {
      return true;
    }
    throw new UnauthorizedException();
  }
}
```

- Використовується як `@UseGuards(AuthGuard)`.
- Якщо `request.user` є → OK.
- Якщо ні → 401 Unauthorized.

---

## `decorators/user.decorator.ts` – зручний `@User()`

```ts
export const User = createParamDecorator(
  (data: any, ctx: ExecutionContext): UserEntity => {
    const request = ctx.switchToHttp().getRequest<ExpressRequestInterface>();
    if (!request.user) {
      throw new UnauthorizedException();
    }
    if (data) {
      return request.user[data];
    }
    return request.user;
  },
);
```

- Дозволяє писати:

```ts
@Get('user')
@UseGuards(AuthGuard)
async currentUser(@User() user: UserEntity) { ... }

@Get('profile')
@UseGuards(AuthGuard)
async profile(@User('email') email: string) { ... }
```

- Якщо немає `request.user` – кидає 401.

---

## Потік запиту (приклад `GET /user`)

1. **Запит**: `GET /user` з `Authorization: Bearer <token>`.
2. **AuthMiddleware**:
   - читає токен, верифікує, завантажує користувача з БД, ставить `req.user`.
3. **AuthGuard**:
   - перевіряє `request.user`;
   - якщо є – пускає до контролера, якщо ні – 401.
4. **Декоратор `@User()`**:
   - дістає `request.user` і передає в метод контролера.
5. **UserController.currentUser**:
   - через `UserService.buildUserResponse` повертає `user + token` клієнту.

