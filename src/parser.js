export const parser = {
    db: null,
    parse: function (text) {
        if (!text) return;

        const lines = text.split('\n');

        let currentPath = null;

        let currentContext = null; // { type: 'path'|'component', id: '...' }
        // currentPath is already declared above

        lines.forEach(line => {
            line = line.trim();
            if (!line) return;
            if (line.startsWith('ucm')) return;

            // 1. Component (Block or One-line)
            const compMatch = line.match(/^component\s+"([^"]+)"(?:\s*(\{))?/);
            if (compMatch) {
                const name = compMatch[1];
                this.db.addComponent(name);
                if (compMatch[2]) { // Has open brace
                    currentContext = { type: 'component', id: name };
                }
                return;
            }

            // 2. Path (Block or One-line) - Enhanced
            // Check for path "Name" {
            const pathBlockMatch = line.match(/^path\s+"([^"]+)"\s*\{/);
            if (pathBlockMatch) {
                const name = pathBlockMatch[1];
                this.db.addPath(name);
                currentContext = { type: 'path', id: name };
                return;
            }

            // Legacy Path (One-line with attributes)
            const oneLinePath = line.match(/^path\s+"([^"]+)"\s+start\s+"([^"]+)"\s+end\s+"([^"]+)"/);
            if (oneLinePath) {
                this.db.addPath(oneLinePath[1], oneLinePath[2], oneLinePath[3]);
                return;
            }

            // 3. Close Block
            if (line === '}') {
                currentContext = null;
                return;
            }

            // 4. Responsibility
            const respMatch = line.match(/^responsibility\s+"([^"]+)"/);
            if (respMatch) {
                const name = respMatch[1];
                let pid = null;
                let cid = null;

                if (currentContext && currentContext.type === 'path') pid = currentContext.id;
                if (currentContext && currentContext.type === 'component') cid = currentContext.id;

                // Fallback to legacy structure if needed (currentPath logic mostly replaced by currentContext)

                this.db.addResponsibility(name, pid, cid);
                return;
            }

            // 5. Path Attributes (start/end) inside block
            if (currentContext && currentContext.type === 'path') {
                const startMatch = line.match(/^start\s+"([^"]+)"/);
                if (startMatch) {
                    // Find the path object in DB and update it? 
                    // DB doesn't have updatePath.
                    // For MVP, we might need to handle this better.
                    // But legacy parser handled multi-line path differently.
                    // Let's assume user uses one-line path mostly, or we add update logic.
                }
            }
        });
    }
};
