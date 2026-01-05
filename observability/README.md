# UCM Editor - Observability Stack

CNCF observability stack with Prometheus, Jaeger, and OpenTelemetry Collector for tracing and metrics.

## Architecture

```
┌─────────────────┐     OTLP/HTTP      ┌──────────────────────┐
│   UCM Editor    │ ───────────────────▶│  OTel Collector     │
│   (Browser)     │     :4318           │  ┌────────────────┐ │
└─────────────────┘                     │  │ spanmetrics    │ │
                                        │  │ processor      │ │
                                        │  └────────────────┘ │
                                        └──────────┬──────────┘
                                                   │
                           ┌───────────────────────┼───────────────────────┐
                           │                       │                       │
                           ▼                       ▼                       ▼
                    ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
                    │   Jaeger    │         │ Prometheus  │         │   Debug     │
                    │   :16686    │         │   :9090     │         │   Logs      │
                    └─────────────┘         └─────────────┘         └─────────────┘
                    Distributed Tracing     Span Metrics            Console Output
```

## Quick Start

```bash
# Start the observability stack
cd observability
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f otel-collector
```

## Endpoints

| Service        | URL                    | Description                 |
| -------------- | ---------------------- | --------------------------- |
| **Jaeger UI**  | http://localhost:16686 | Distributed tracing UI      |
| **Prometheus** | http://localhost:9090  | Metrics & queries           |
| OTel Collector | http://localhost:4318  | OTLP HTTP receiver (traces) |
| OTel Collector | http://localhost:4317  | OTLP gRPC receiver          |
| Span Metrics   | http://localhost:8889  | Prometheus scrape endpoint  |

## Span Metrics

The spanmetrics processor generates Prometheus metrics from traces:

- `ucm_calls_total` - Total span count by service, operation, status
- `ucm_latency_bucket` - Latency histogram buckets
- `ucm_latency_count` - Latency count
- `ucm_latency_sum` - Latency sum

### Example Prometheus Queries

```promql
# Request rate by operation
rate(ucm_calls_total[5m])

# 95th percentile latency
histogram_quantile(0.95, rate(ucm_latency_bucket[5m]))

# Error rate
sum(rate(ucm_calls_total{status_code="2"}[5m])) / sum(rate(ucm_calls_total[5m]))
```

## Traced Operations

The UCM Editor traces the following operations:

| Span Name              | Description                      |
| ---------------------- | -------------------------------- |
| `ucm.node.create`      | Node creation (start, end, etc.) |
| `ucm.edge.create`      | Edge/path creation               |
| `ucm.component.create` | Component creation               |
| `ucm.canvas.render`    | Canvas re-render                 |
| `ucm.user.*`           | User interactions                |

## Development

### Enable Verbose Logging

Edit `otel-collector-config.yaml`:

```yaml
exporters:
  debug:
    verbosity: detailed
```

### Stop Stack

```bash
docker-compose down

# Remove volumes too
docker-compose down -v
```

## Troubleshooting

### Check OTel Collector Health

```bash
curl http://localhost:13133/health
```

### View Collector zpages

http://localhost:55679/debug/tracez

### Verify Prometheus Targets

Navigate to http://localhost:9090/targets to verify the OTel Collector is being scraped.
