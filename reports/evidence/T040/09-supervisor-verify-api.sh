#!/usr/bin/env bash
# T040 Stage 5 verify — Supervisor-run API contract checks against the live stack.
# An EMPTY actual value is an automatic FAIL (T039 learning: empty-vs-empty
# comparisons produced three false passes in a hand-written verify script).
set -u
API=http://localhost:3000
PASS=0; FAIL=0

check() { # check <label> <expected> <actual>
  local label="$1" expected="$2" actual="$3"
  if [ -z "$actual" ]; then
    echo "FAIL  $label — actual is EMPTY (expected '$expected')"; FAIL=$((FAIL+1)); return
  fi
  if [ "$expected" = "$actual" ]; then
    echo "pass  $label — $actual"; PASS=$((PASS+1))
  else
    echo "FAIL  $label — expected '$expected', got '$actual'"; FAIL=$((FAIL+1))
  fi
}

login() {
  curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1@demo.kitchenos.dev\",\"password\":\"Password123!\"}" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["accessToken"])'
}

OWNER=$(login owner); CHEF=$(login chef); STAFF=$(login staff); VIEWER=$(login viewer)

status() { curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $2" "$API$1"; }

echo "--- AC3: role matrix on GET /users/assignable"
check "OWNER  200" 200 "$(status /users/assignable "$OWNER")"
check "CHEF   200" 200 "$(status /users/assignable "$CHEF")"
check "STAFF  403" 403 "$(status /users/assignable "$STAFF")"
check "VIEWER 403" 403 "$(status /users/assignable "$VIEWER")"
check "no token 401" 401 "$(curl -s -o /dev/null -w '%{http_code}' "$API/users/assignable")"

echo "--- AC3 negative direction: the wide team route stays Owner/Admin only"
check "CHEF on GET /users        403" 403 "$(status /users "$CHEF")"
check "CHEF on GET /users/invites 403" 403 "$(status /users/invites "$CHEF")"

echo "--- AC2: payload shape is exactly {id, email}"
KEYS=$(curl -s -H "Authorization: Bearer $CHEF" "$API/users/assignable" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print(",".join(sorted(d[0].keys())) if d else "")')
check "keys" "email,id" "$KEYS"

echo "--- AC1: CHEF sees every active member by email, ordered ascending"
EMAILS=$(curl -s -H "Authorization: Bearer $CHEF" "$API/users/assignable" \
  | python3 -c 'import sys,json; print(",".join(u["email"] for u in json.load(sys.stdin)))')
check "emails asc" "$(printf '%s' "$EMAILS" | tr ',' '\n' | sort | paste -sd,)" "$EMAILS"
echo "      list: $EMAILS"

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] && echo "OVERALL: pass" || echo "OVERALL: fail"
