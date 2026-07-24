#!/usr/bin/env bash
# T039 Stage 5 verify — Edit Task UI contract, exercised end-to-end against the
# running API. Proves the exact PATCH /tasks/:id behaviours EditTaskDialog relies on.
set -u
API=http://localhost:3000
S=$RANDOM$RANDOM
pass=0; fail=0
chk() { # chk <label> <actual> <expected>
  if [ -z "$2" ]; then echo "  FAIL  $1 (EMPTY value - request failed, expected $3)"; fail=$((fail+1));
  elif [ "$2" = "$3" ]; then echo "  PASS  $1 (got $2)"; pass=$((pass+1));
  else echo "  FAIL  $1 (got $2, expected $3)"; fail=$((fail+1)); fi
}

echo "=== T039 verify: setup ==="
OWNER=$(curl -s -X POST $API/auth/signup -H 'Content-Type: application/json' \
  -d "{\"email\":\"t039owner$S@example.com\",\"password\":\"Passw0rd!23\",\"organizationName\":\"T039 Org $S\",\"kitchenName\":\"Main Kitchen\"}")
OTOK=$(echo "$OWNER" | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
OID=$(echo "$OWNER" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
echo "  owner id: $OID"

# Invite a STAFF and a VIEWER, accept both.
mkuser() { # mkuser <role> <tag>
  local inv tok
  inv=$(curl -s -X POST $API/users/invite -H "Authorization: Bearer $OTOK" \
    -H 'Content-Type: application/json' -d "{\"email\":\"t039$2$S@example.com\",\"role\":\"$1\"}")
  tok=$(echo "$inv" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("token",""))')
  curl -s -X POST $API/users/invite/accept -H 'Content-Type: application/json' \
    -d "{\"token\":\"$tok\",\"password\":\"Passw0rd!23\"}"
}
STAFF=$(mkuser STAFF staff); STOK=$(echo "$STAFF" | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
SID=$(echo "$STAFF" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
VIEWER=$(mkuser VIEWER viewer); VTOK=$(echo "$VIEWER" | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
echo "  staff id: $SID"

TASK=$(curl -s -X POST $API/tasks -H "Authorization: Bearer $OTOK" -H 'Content-Type: application/json' \
  -d '{"title":"Prep onions","checklistItems":[{"text":"Wash veg"},{"text":"Dice onions"}]}')
TID=$(echo "$TASK" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
I1=$(echo "$TASK" | python3 -c 'import sys,json;print(json.load(sys.stdin)["checklistItems"][0]["id"])')
echo "  task id: $TID"

echo
echo "=== AC1: Owner/Chef edits title + dueAt (ISO instant, as the dialog sends) ==="
R=$(curl -s -X PATCH $API/tasks/$TID -H "Authorization: Bearer $OTOK" -H 'Content-Type: application/json' \
  -d '{"title":"Prep mise en place","dueAt":"2026-08-01T00:00:00.000Z"}')
chk "title updated" "$(echo "$R" | python3 -c 'import sys,json;print(json.load(sys.stdin)["title"])')" "Prep mise en place"
chk "dueAt persisted" "$(echo "$R" | python3 -c 'import sys,json;print(json.load(sys.stdin)["dueAt"][:10])')" "2026-08-01"

echo
echo "=== AC1: reassign to a kitchen member ==="
R=$(curl -s -X PATCH $API/tasks/$TID -H "Authorization: Bearer $OTOK" -H 'Content-Type: application/json' \
  -d "{\"assigneeId\":\"$SID\"}")
chk "assigneeId set to staff" "$(echo "$R" | python3 -c 'import sys,json;print(json.load(sys.stdin)["assigneeId"])')" "$SID"

echo
echo "=== Edge: checklist edit preserves ids + done state; new item gets a server id ==="
R=$(curl -s -X PATCH $API/tasks/$TID -H "Authorization: Bearer $OTOK" -H 'Content-Type: application/json' \
  -d "{\"checklistItems\":[{\"id\":\"$I1\",\"text\":\"Wash and peel veg\",\"done\":true},{\"text\":\"New step\",\"done\":false}]}")
chk "existing item id preserved" "$(echo "$R" | python3 -c 'import sys,json;print(json.load(sys.stdin)["checklistItems"][0]["id"])')" "$I1"
chk "existing item done preserved" "$(echo "$R" | python3 -c 'import sys,json;print(json.load(sys.stdin)["checklistItems"][0]["done"])')" "True"
NEWID=$(echo "$R" | python3 -c 'import sys,json;print(json.load(sys.stdin)["checklistItems"][1]["id"])')
chk "new item got a server-minted id" "$([ -n "$NEWID" ] && [ ${#NEWID} -gt 10 ] && echo yes || echo no)" "yes"

echo
echo "=== AC3: STAFF on OWN task may change checklist, NOT title/assignee ==="
C=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH $API/tasks/$TID -H "Authorization: Bearer $STOK" \
  -H 'Content-Type: application/json' -d '{"checklistItems":[{"text":"Staff edited"}]}')
chk "staff checklist edit allowed" "$C" "200"
C=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH $API/tasks/$TID -H "Authorization: Bearer $STOK" \
  -H 'Content-Type: application/json' -d '{"title":"Staff tries to rename"}')
chk "staff title edit REJECTED" "$C" "403"

echo
echo "=== AC4/AC5: VIEWER is always read-only ==="
C=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH $API/tasks/$TID -H "Authorization: Bearer $VTOK" \
  -H 'Content-Type: application/json' -d '{"checklistItems":[{"text":"Viewer tries"}]}')
chk "viewer PATCH REJECTED" "$C" "403"

echo
echo "=== AC6-adjacent: empty title rejected server-side (dialog blocks it client-side too) ==="
C=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH $API/tasks/$TID -H "Authorization: Bearer $OTOK" \
  -H 'Content-Type: application/json' -d '{"title":""}')
chk "empty title REJECTED (400)" "$C" "400"

echo
echo "=== Edge: explicit unassign via assigneeId:null (the dialog's Unassigned option) ==="
R=$(curl -s -X PATCH $API/tasks/$TID -H "Authorization: Bearer $OTOK" -H 'Content-Type: application/json' \
  -d '{"assigneeId":null}')
chk "assigneeId cleared to null" "$(echo "$R" | python3 -c 'import sys,json;v=json.load(sys.stdin)["assigneeId"];print("null" if v is None else v)')" "null"

echo
echo "=== Edge: cross-kitchen assignee rejected (assertAssigneeInKitchen) ==="
OTHER=$(curl -s -X POST $API/auth/signup -H 'Content-Type: application/json' \
  -d "{\"email\":\"t039other$S@example.com\",\"password\":\"Passw0rd!23\",\"organizationName\":\"Other Org $S\",\"kitchenName\":\"Other Kitchen\"}")
XID=$(echo "$OTHER" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["id"])')
C=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH $API/tasks/$TID -H "Authorization: Bearer $OTOK" \
  -H 'Content-Type: application/json' -d "{\"assigneeId\":\"$XID\"}")
chk "cross-kitchen assignee REJECTED" "$([ "$C" = "404" ] || [ "$C" = "400" ] || [ "$C" = "403" ] && echo rejected || echo "allowed($C)")" "rejected"

echo
echo "======================================"
echo "T039 verify result: $pass passed, $fail failed"
[ $fail -eq 0 ] && echo "OVERALL: pass" || echo "OVERALL: fail"
exit $fail
