#!/bin/bash
# Send test traces to populate service graph

for i in {1..10}; do
  TRACE_ID=$(python3 -c "import random; print(''.join([format(random.randint(0,255),'02x') for _ in range(16)]))")
  SPAN1=$(python3 -c "import random; print(''.join([format(random.randint(0,255),'02x') for _ in range(8)]))")
  SPAN2=$(python3 -c "import random; print(''.join([format(random.randint(0,255),'02x') for _ in range(8)]))")
  NOW=$(python3 -c "import time; print(int(time.time() * 1e9))")
  LATER=$(python3 -c "import time; print(int((time.time() + 0.03) * 1e9))")
  
  curl -s -X POST "http://localhost:4318/v1/traces" \
    -H "Content-Type: application/json" \
    -d '{
      "resourceSpans": [
        {
          "resource": {
            "attributes": [{"key": "service.name", "value": {"stringValue": "ucm-browser"}}]
          },
          "scopeSpans": [{
            "scope": {"name": "test"},
            "spans": [{
              "traceId": "'"$TRACE_ID"'",
              "spanId": "'"$SPAN1"'",
              "parentSpanId": "",
              "name": "user.action",
              "kind": 3,
              "startTimeUnixNano": "'"$NOW"'",
              "endTimeUnixNano": "'"$LATER"'",
              "status": {"code": 1}
            }]
          }]
        },
        {
          "resource": {
            "attributes": [{"key": "service.name", "value": {"stringValue": "ucm-editor"}}]
          },
          "scopeSpans": [{
            "scope": {"name": "test"},
            "spans": [{
              "traceId": "'"$TRACE_ID"'",
              "spanId": "'"$SPAN2"'",
              "parentSpanId": "'"$SPAN1"'",
              "name": "editor.operation",
              "kind": 2,
              "startTimeUnixNano": "'"$NOW"'",
              "endTimeUnixNano": "'"$LATER"'",
              "status": {"code": 1}
            }]
          }]
        }
      ]
    }' > /dev/null

  echo "Sent trace $i"
  sleep 0.3
done

echo "Done - check Jaeger at http://localhost:16686"
