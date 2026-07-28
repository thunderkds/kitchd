#!/bin/bash
set -u
API=http://localhost:3000
STAMP=$(cat stamp.txt)
ITOK=$(cat invitee_token.txt)
OKITCHEN=913ca19e-b1cd-42a7-aca2-a33b90dbeaed

echo "=== AC5 PROOF: the invitee landed in the INVITING kitchen ==="
echo "-- inviting Owner's kitchenId: $OKITCHEN"
echo
echo "-- invitee logs in fresh (proves the account really exists):"
curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"t043-chef-$STAMP@example.com\",\"password\":\"Password123!\"}" | python3 -m json.tool
echo
echo "-- GET /tasks with the session the accept page issued:"
curl -s $API/tasks -H "Authorization: Bearer $ITOK" | python3 -c '
import sys,json
d=json.load(sys.stdin)
print("task count:",len(d))
print("distinct kitchenIds in the response:",sorted({t["kitchenId"] for t in d}))
print("sample titles:",[t["title"] for t in d[:3]])
'
echo
echo "=== CONTRAST: the silent failure this task removes ==="
echo "-- same person instead 'signs up' at /login:"
curl -s -X POST $API/auth/signup -H 'Content-Type: application/json' \
  -d "{\"email\":\"t043-signup-$STAMP@example.com\",\"password\":\"Password123!\",\"organizationName\":\"Contrast Org\",\"kitchenName\":\"Contrast Kitchen\"}" \
  | python3 -c 'import sys,json;print(json.dumps(json.load(sys.stdin)["user"],indent=2))'
