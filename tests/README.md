# UCM Editor Test Suite

Comprehensive testing infrastructure for the UCM Editor project.

---

## Directory Structure

```
tests/
├── unit/              # Unit tests for individual modules
├── integration/       # End-to-end integration tests
├── performance/       # Performance benchmarks
├── reports/          # Test execution reports and findings
└── README.md         # This file
```

---

## Running Tests

### Integration Tests (Phase 1 Validation)

**Prerequisites**:
- Server running on `http://localhost:8088`
- Puppeteer installed (`npm install`)

**Run**:
```bash
node tests/integration/phase1-validation.test.js
```

**Coverage**:
- Task 1: DSL Editor Sidebar (5 tests)
- Task 2: Export & Import System (3 tests)
- Task 3: Settings Panel (2 tests)
- Additional: Example diagrams & toolbar (4 tests)

**Total**: 14 tests covering all Phase 1 features

---

### Unit Tests (Planned - P4.1)

**Framework**: Jest or Vitest

**Modules to Test**:
- `js/core/graph.js` - Graph operations
- `js/core/parser.js` - DSL parsing
- `js/core/serializer.js` - DSL serialization
- `js/core/history.js` - Undo/redo functionality

**Run** (when implemented):
```bash
npm test
```

---

### Performance Benchmarks (Planned - P4.3)

**Tool**: Puppeteer + performance.now()

**Metrics**:
- Render time (10, 100, 500, 1000 nodes)
- Parse time (100, 1000 line DSL)
- Serialization time (100, 1000 nodes)
- Memory usage tracking

**Run** (when implemented):
```bash
node tests/performance/benchmark.js
```

---

## Test Reports

All test execution reports are saved in `tests/reports/` with timestamps.

### Current Reports

1. **phase2-findings-2026-01-05.md**
   - Phase 2 implementation verification
   - Priority 1 (Critical) items status
   - Code quality assessment

2. **test-summary-2026-01-05.md**
   - Full test execution summary
   - 14/14 tests passed (100%)
   - Performance observations
   - Recommendations

3. **test-run-2026-01-05.log**
   - Raw test execution log
   - Console output capture

---

## Writing Tests

### Integration Test Example

```javascript
async testNewFeature() {
    console.log('\n🧪 Testing New Feature');

    try {
        // Setup
        await this.page.click('#some-button');
        await this.wait();

        // Assertion
        const result = await this.page.$eval('#result', el => el.textContent);
        if (!result.includes('expected')) {
            throw new Error('Feature not working');
        }

        this.pass('New Feature Test');
    } catch (error) {
        this.fail('New Feature Test', error.message);
    }
}
```

### Best Practices

1. **Descriptive Names**: Use clear test names matching implementation plan
2. **Wait Between Actions**: Allow UI to update (`await this.wait()`)
3. **Error Context**: Provide helpful error messages
4. **Clean State**: Reset state between tests if needed
5. **Report Results**: Use `this.pass()` and `this.fail()`

---

## Test Maintenance

### Before Each Phase
- Run full integration test suite
- Record baseline metrics
- Document any known issues

### After Each Phase
- Update integration tests for new features
- Add unit tests for new modules
- Update test reports
- Compare metrics to baseline

### Regression Testing
- Run full suite before commits
- Keep test logs for historical comparison
- Fix flaky tests immediately

---

## CI/CD Integration (Future)

**Planned GitHub Actions**:
```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm start &
      - run: npm test
```

---

## Test Coverage Goals

| Module | Current | Target |
|--------|---------|--------|
| Integration | 100% | 100% |
| Unit | 0% | 80%+ |
| Performance | 0% | Baseline |

**Phase 1**: ✅ 100% integration coverage
**Phase 2**: Target 80% unit coverage on core modules

---

## Known Issues

### Non-Critical
- **404 Resource Warning**: External resource not loading (doesn't affect tests)

### Critical
- **None** ✅

---

## Test History

| Date | Tests | Pass | Fail | Notes |
|------|-------|------|------|-------|
| 2026-01-05 | 14 | 14 | 0 | Phase 1 validation baseline |

---

## Additional Resources

- **Implementation Plan**: [../IMPLEMENTATION_PLAN_V2.md](../IMPLEMENTATION_PLAN_V2.md)
- **Original Plan**: [../implementation_plan.md](../implementation_plan.md)
- **Puppeteer Docs**: https://pptr.dev/

---

**Last Updated**: 2026-01-05
**Maintainer**: UCM Editor Team
**Status**: Phase 1 Complete ✅
