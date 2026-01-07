---
description: Code review checklist for UCM Editor changes
---

## Code Review Workflow

### Before Submitting for Review

1. **Run Tests**
```bash
npm test
```

2. **Check for Linting Issues**
```bash
# Check for obvious issues
grep -r "console.log" js/ --include="*.js" | grep -v "// DEBUG"
```

3. **Verify UI Manually**
- Start dev server and test the changed functionality
- Check both light theme and dark mode (if applicable)

### Code Quality Checklist

#### JavaScript
- [ ] Functions have JSDoc comments (especially public APIs)
- [ ] No unused variables or imports
- [ ] Event listeners are properly cleaned up
- [ ] Error handling with user-friendly messages (not silent fails)
- [ ] Consistent naming convention (camelCase for functions/variables)

#### CSS
- [ ] Uses CSS custom properties from :root (--color-*, --spacing-*, etc.)
- [ ] Follows B&W aesthetic (no random colors)
- [ ] Responsive considerations for panel widths

#### Architecture
- [ ] Changes follow existing patterns (EventEmitter, graph.on/emit)
- [ ] No circular dependencies between modules
- [ ] Large functions (>50 lines) are split into smaller helpers

### Review Focus Areas by File Type

| File Pattern | Focus On |
|--------------|----------|
| `js/core/*.js` | State management, event emissions, validation |
| `js/editor/*.js` | User interactions, performance, DOM updates |
| `js/ui/*.js` | Accessibility, responsiveness, event handling |
| `css/*.css` | Variable usage, specificity, mobile styles |

### Common Issues to Watch For

1. **Memory Leaks**: Event listeners not removed on cleanup
2. **Race Conditions**: Async operations without proper sequencing
3. **DOM Thrashing**: Multiple reads/writes in loops (batch them!)
4. **Silent Failures**: catch blocks that swallow errors
