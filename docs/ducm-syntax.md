# DUCM Syntax Specification v2

## Design Principles
1. **No quotes** - Use indentation and line breaks instead
2. **No commas** - Use spaces to separate values  
3. **No parentheses** - Use keywords for structure
4. **Line-oriented** - One element per line
5. **Keyword prefixes** - Every line starts with a keyword
6. **Whitespace tolerant** - Trim all lines

## Grammar

```
ucm <name>

# Components use COMP keyword
COMP <type> <name> at <x> <y> size <w> <h>
  # Nodes inside use 2-space indent
  <nodetype> <name> at <x> <y>
END

# Standalone nodes (no indent)
<nodetype> <name> at <x> <y>

# Connections use arrow syntax
LINK <source> TO <target>
```

## Node Types
- `START` - Path start point
- `END` - Path end point  
- `RESP` - Responsibility (action)
- `FORK` - AND/OR fork point
- `JOIN` - AND/OR join point

## Component Types
- `actor` - Human actor
- `team` - Team/group
- `object` - Data object
- `process` - Process/system
- `agent` - Software agent

## Example

```ducm
ucm ParallelProcessing

COMP process UserInterface at 50 50 size 200 300
  START Request at 120 100
  RESP ValidateInput at 120 200
END

COMP process Backend at 300 50 size 400 300
  FORK ParallelFork at 350 150
  RESP ProcessA at 450 100
  RESP ProcessB at 450 200
  JOIN ParallelJoin at 550 150
  END Complete at 650 150
END

LINK Request TO ValidateInput
LINK ValidateInput TO ParallelFork
LINK ParallelFork TO ProcessA
LINK ParallelFork TO ProcessB
LINK ProcessA TO ParallelJoin
LINK ProcessB TO ParallelJoin
LINK ParallelJoin TO Complete
```

## Regex Patterns

All patterns are simple and robust:

```javascript
// UCM name: "ucm <name>"
/^ucm\s+(\S+)/

// Component start: "COMP <type> <name> at <x> <y> size <w> <h>"
/^COMP\s+(\w+)\s+(\S+)\s+at\s+(\d+)\s+(\d+)\s+size\s+(\d+)\s+(\d+)/

// Component end: "END" (alone on line)
/^END$/

// Node (indented): "  <TYPE> <name> at <x> <y>"
/^\s+(START|END|RESP|FORK|JOIN)\s+(\S+)\s+at\s+(\d+)\s+(\d+)/

// Link: "LINK <source> TO <target>"
/^LINK\s+(\S+)\s+TO\s+(\S+)/
```

## Why This Works
- **No escaping needed** - Names are single tokens (use underscores: `My_Component`)
- **All keywords CAPS** - Clear distinction from user names
- **Positional values** - Numbers separated by whitespace
- **Explicit delimiters** - `at`, `size`, `TO`, `END` keywords
