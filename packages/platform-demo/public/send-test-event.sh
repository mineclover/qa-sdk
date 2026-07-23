#!/bin/bash
# 테스트 이벤트를 ingest-server에 전송하여 monitor.html LIVE 모드 검증
# 사용: bash send-test-event.sh

SERVER="${1:-http://localhost:8787}"

echo "Sending test events to $SERVER/v1/ingest..."

curl -s -X POST "$SERVER/v1/ingest" \
  -H "Content-Type: application/json" \
  -d '{
  "transmission_id": "tx-monitor-test-'$(date +%s)'",
  "sent_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "owner": { "owner_type": "workspace", "owner_id": "test" },
  "source": { "service_name": "shopping-web", "sdk_name": "@qa-sdk/sdk", "sdk_version": "0.1.0" },
  "runtime": { "platform": "node" },
  "build": { "env": "dev" },
  "records": [
    {
      "log_id": "log-'$(date +%s)'-1",
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "record_kind": "log",
      "trace_id": "trc_monitor_test",
      "span_id": "spn_1",
      "event_key": "page.view",
      "event_version": "001",
      "payload_format": "json",
      "payload_encoding": "raw",
      "payload_masking_applied": false,
      "payload_masked_fields": [],
      "payload": {"page": "monitor-test"},
      "address_context": {
        "page_view": "page_view:v2:32",
        "tracking": "tracking:v2:128",
        "endpoint": "endpoint:v1:32",
        "flow_point": "flow_point:v2:0"
      }
    }
  ]
}' | python3 -m json.tool 2>/dev/null || echo "(response)"

echo ""
echo "Event sent. Check monitor.html LIVE mode."
