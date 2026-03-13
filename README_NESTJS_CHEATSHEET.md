### NestJS шпаргалка для початківця

Цей файл — короткий конспект по NestJS: основні поняття, специфічні терміни, як файли звʼязуються між собою, і типові патерни.

---

## 1. Загальна ідея NestJS

NestJS — це фреймворк поверх Node.js (Express/Fastify), який:

- організовує код навколо **модулів**;
- використовує **декоратори** (`@Controller`, `@Injectable`, `@Get`, `@Post`, `@Body`, `@Module`, …);
- побудований на **dependency injection (DI)** — залежності “вколюються” через конструктор.

Типова структура проєкту:

- `*.module.ts` — модулі (групи функціональності, напр. `UserModule`);
- `*.controller.ts` — контролери (HTTP‑ендпоінти);
- `*.service.ts` — сервіси (бізнес‑логіка);
- `*.entity.ts` — моделі БД (якщо використовуємо TypeORM);
- `*.dto.ts` — DTO (форми запитів/відповідей, валідація);
- інфраструктура: guard’и, middleware, декоратори, інтерсептори, фільтри.

---

## 2. Модуль (`@Module`) — “папка” для функціоналу

```ts
import { Module } from '@nestjs/common';

@Module({
  imports: [],       // що ми "втягуємо" в цей модуль
  controllers: [],   // контролери цього модуля
  providers: [],     // сервіси, guard-и, інші провайдери
  exports: [],       // що модуль віддає іншим (звичайно сервіси)
})
export class UserModule {}
```

- **imports** — інші модулі (`AuthModule`, `TypeOrmModule`, `ConfigModule`, …).
- **controllers** — класи з `@Controller()`.
- **providers** — класи з `@Injectable()` + guard’и, стратегії, кастомні сервіси.
- **exports** — провайдери, доступні іншим модулям.

Глобальний модуль (`AppModule`) зазвичай імпортує всі доменні модулі:

```ts
@Module({
  imports: [UserModule, ArticleModule, TypeOrmModule.forRoot(...)]
})
export class AppModule {}
```

---

## 3. Контролер (`@Controller`) — HTTP шар

```ts
import { Controller, Get, Post, Body, Param } from '@nestjs/common';

@Controller('users') // префікс для маршрутів
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.userService.findById(+id);
  }
}
```

- `@Controller('users')` → усі маршрути цього контролера починаються з `/users`.
- HTTP‑декоратори:
  - `@Get()`, `@Post()`, `@Put()`, `@Patch()`, `@Delete()`;
  - `@Body()`, `@Param()`, `@Query()`, `@Headers()`, `@Req()`, `@Res()`.
- Контролер **тільки приймає запит → викликає сервіс → повертає відповідь**.

---

## 4. Сервіс (`@Injectable`) — бізнес‑логіка

```ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  constructor(private readonly repo: Repository<UserEntity>) {}

  async create(dto: CreateUserDto) {
    // валідація / логіка / запис у БД
  }

  async findById(id: number) {
    return this.repo.findOne({ where: { id } });
  }
}
```

- `@Injectable()` каже Nest, що цей клас можна інжектити.
- В сервісі зосереджена **логіка домену**:
  - звернення до БД;
  - бізнес‑правила;
  - виклик зовнішніх API.
- Сервіси підключаються в контролерах через **конструктор**:

```ts
constructor(private readonly userService: UserService) {}
```

---

## 5. DTO (Data Transfer Object) + валідація

```ts
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  readonly username: string;

  @IsEmail()
  readonly email: string;

  @IsNotEmpty()
  @MinLength(8)
  readonly password: string;
}
```

- DTO — це **клас**, що описує форму очікуваного запиту/відповіді.
- Декоратори з `class-validator` додають **валідацію**.

Підключення в контролері:

```ts
@Post('users')
@UsePipes(new ValidationPipe())
async createUser(@Body('user') dto: CreateUserDto) {
  return this.userService.create(dto);
}
```

Або глобально в `main.ts`:

```ts
app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
```

Це дає:

- автоматичну валідацію;
- авто‑конвертацію `body` → екземпляр DTO;
- `whitelist: true` — видаляє зайві поля, яких нема в DTO.

---

## 6. Entity (TypeORM) — модель БД

```ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  email: string;

  @Column({ select: false })
  password: string;
}
```

Підключення в модулі:

```ts
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [UserService],
})
export class UserModule {}
```

В сервісі:

```ts
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

constructor(
  @InjectRepository(UserEntity)
  private readonly userRepository: Repository<UserEntity>,
) {}
```

---

## 7. Middleware — код до контролера (Express‑рівень)

```ts
import { Injectable, NestMiddleware } from '@nestjs/common';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    // наприклад: дістати токен, покласти user в req
    next();
  }
}
```

Реєстрація:

```ts
import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';

export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
```

- Middleware працює **на рівні Express**, до Nest‑контексту.
- Часто використовується для:
  - логів;
  - парсингу токену й виставлення `req.user`;
  - CORS, cookies, тощо.

---

## 8. Guard (`CanActivate`) — контроль доступу

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<any>();
    if (request.user) {
      return true;
    }
    throw new UnauthorizedException();
  }
}
```

Використання:

```ts
@UseGuards(AuthGuard)
@Get('user')
async currentUser() { ... }
```

**Різниця з middleware:**

- middleware → Express‑рівень, не знає про Nest‑декоратори;
- guard → Nest‑рівень, виконується **перед методом контролера**, має доступ до `ExecutionContext`.

---

## 9. Кастомні декоратори (`createParamDecorator`)

```ts
import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export const User = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<any>();
    if (!request.user) {
      throw new UnauthorizedException();
    }
    if (data) {
      return request.user[data]; // @User('email')
    }
    return request.user;         // @User()
  },
);
```

Використання в контролері:

```ts
@Get('user')
@UseGuards(AuthGuard)
async currentUser(@User() user: UserEntity) { ... }

@Get('profile')
@UseGuards(AuthGuard)
async profile(@User('email') email: string) { ... }
```

Ідея: **замість того, щоб у кожному методі діставати `req.user` вручну, ми виносимо це в декоратор.**

---

## 10. Pipes, Interceptors, Filters (дуже коротко)

### Pipes

- Використовуються для **валідації та трансформації** вхідних даних.
- Приклади:
  - `ValidationPipe` (перевірка DTO);
  - `ParseIntPipe` (перетворює `string` → `number` для `@Param`).

```ts
@Get(':id')
async findOne(@Param('id', ParseIntPipe) id: number) { ... }
```

### Interceptors

- Обгортають виклик методу контролера:
  - логування часу виконання;
  - кешування;
  - трансформація відповіді.

### Exception Filters

- Відповідають за **обробку помилок**.
- За замовчуванням Nest перетворює `HttpException` в HTTP‑відповідь, але можна створити свої фільтри.

---

## 11. Як файли звʼязані один з одним

1. **Модуль** (`UserModule`):
   - імпортує `TypeOrmModule.forFeature([UserEntity])`, `JwtModule`, інші модулі;
   - реєструє `UserService`, `AuthGuard`, `UserController`.

2. **Сервіс** (`UserService`):
   - інжектить репозиторій `UserEntity` (`@InjectRepository`);
   - інжектить `JwtService` (через `JwtModule`).

3. **Контролер** (`UserController`):
   - інжектить `UserService` через конструктор;
   - використовує DTO, guard’и (`@UseGuards`), декоратори (`@User`, `@Body`, `@Param`).

4. **Middleware**:
   - підключається в `AppModule.configure`;
   - працює до контролерів, може виставити `req.user`.

5. **Guard**:
   - дивиться на `request.user` (поставлений middleware);
   - вирішує, пускати чи ні.

6. **Decorators**:
   - читають дані з `ExecutionContext` (наприклад, `request.user`);
   - зручно прокидають їх як параметри в методи контролера.

---

## 12. Як мислити, коли плутаєшся

Коли губишся, став собі такі запитання:

1. **Який домен/фіча?**  
   → це окремий `Module`.

2. **Хто приймає HTTP‑запит?**  
   → `Controller`.

3. **Де має бути логіка?**  
   → `Service`.

4. **Як це зберігається в БД?**  
   → `Entity` (+ репозиторій через TypeORM).

5. **Як виглядає тіло запиту / відповіді?**  
   → `DTO` + інтерфейси/типи.

6. **Як захистити маршрут?**  
   - Middleware: розпарсити токен, покласти `req.user`.
   - Guard: перевірити `request.user` → якщо нема, кинути 401.
   - Decorator: зручно дістати `user` або його поле в контролері.

Якщо тримати цю “драбинку” в голові, стає значно легше орієнтуватись у проєкті NestJS.

