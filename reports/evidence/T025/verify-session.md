# T025 Verify Evidence — live API probes

Server started via `PORT=3025 npm run start:dev` inside `.claude/worktrees/T025/apps/api`.

## 1. Signup response includes `themePreference: "simple"` (AC2, AC4, AC5)

```
POST /auth/signup
{"accessToken":"...","user":{"id":"0c21e809-...","email":"verify-t025b@kitchenos.dev","organizationId":"...","kitchenId":"...","role":"OWNER","themePreference":"simple"}}
```

## 2. Valid theme update (AC3, Success Criterion 1)

```
$ curl -X PATCH localhost:3025/users/me/theme -H "Authorization: Bearer <token>" -d '{"theme":"dark_neon"}'
{"id":"06c43be9-64ba-4228-81d1-176a3add1d6f","email":"verify-t025c@kitchenos.dev","themePreference":"dark_neon"}
HTTP 200
```

## 3. Invalid theme value rejected (AC4, Success Criterion 2)

```
$ curl -X PATCH localhost:3025/users/me/theme -H "Authorization: Bearer <token>" -d '{"theme":"neon-purple"}'
{"message":["theme must be one of the following values: simple, dark_neon"],"error":"Bad Request","statusCode":400}
HTTP 400
```

## 4. Unauthenticated request rejected (AC6, Success Criterion 3)

```
$ curl -X PATCH localhost:3025/users/me/theme -d '{"theme":"dark_neon"}'
{"message":"Missing bearer token","error":"Unauthorized","statusCode":401}
HTTP 401
```

## Automated test run

```
$ cd apps/api && npm test -- theme
PASS src/users/theme.e2e.spec.ts
  Theme preference (e2e)
    ✓ AC4 / AC5: signup response includes themePreference defaulted to simple (152 ms)
    ✓ Success Criterion 1: authenticated caller can update own theme to dark_neon (62 ms)
    ✓ Success Criterion 2: invalid theme value is rejected with 400 and DB unchanged (57 ms)
    ✓ Success Criterion 3: unauthenticated request is rejected with 401 (2 ms)
    ✓ AC6: login response for a pre-existing user reflects their persisted theme, not a caller-supplied id (111 ms)

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
```

## Full regression suite

```
$ npm test
Test Suites: 24 passed, 24 total
Tests:       186 passed, 186 total
Time:        23.92 s
```
