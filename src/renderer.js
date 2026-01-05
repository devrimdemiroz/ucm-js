import { select } from 'd3';

export const renderer = {
    setConf: function (conf) {
        this.conf = conf;
    },
    runSimulation: function (svgId, data) {
        const svg = select('#' + svgId);
        if (svg.empty()) return;

        // Clear existing tokens
        svg.selectAll('.token').remove();

        data.paths.forEach(path => {
            // Find path element
            // We need a reliable way to select the specific path line. 
            // For MVP, we'll just animate on the first matching path line since we don't strictly bind IDs to accessible DOM elements yet.
            // Improvement: Add ID to path line in draw()
            const pathNode = svg.select('.path-line').node();
            if (!pathNode) return;

            const length = pathNode.getTotalLength();

            const token = svg.append('circle')
                .attr('r', 5)
                .attr('fill', 'black')
                .attr('class', 'token');

            token.transition()
                .duration(2000)
                .attrTween('transform', translateAlong(pathNode))
                .on('end', () => token.remove());
        });

        function translateAlong(path) {
            const l = path.getTotalLength();
            return function (d, i, a) {
                return function (t) {
                    const p = path.getPointAtLength(t * l);
                    return `translate(${p.x},${p.y})`;
                };
            };
        }
    },
    draw: function (text, id, version, diagObj, styleConfig = {}) {
        const db = diagObj.db;
        const data = db.getDiagramData();

        // Style configuration with defaults
        const respStyle = styleConfig.respStyle || 'x-mark';
        const pathStyle = styleConfig.pathStyle || 'black';

        const svg = select('#' + id);

        // Clear existing (if any)
        svg.selectAll('*').remove();

        const width = 800;
        const height = 600;

        svg.attr('viewBox', `0 0 ${width} ${height}`);

        const g = svg.append('g').attr('class', 'ucm-diagram');

        // 1. Calculate Layout
        // We need to know where responsibilities are BEFORE drawing components.

        // Path Layout
        const pathLayouts = data.paths.map((path, index) => {
            const y = 150 + (index * 100);
            const startX = 50;
            const endX = width - 50;

            // Distribute responsibilities
            const pathResps = data.responsibilities.filter(r => r.pathId === path.id || (!r.pathId && index === 0));
            const respLayouts = pathResps.map((r, rIndex) => {
                const segmentWidth = (endX - startX) / (pathResps.length + 1);
                const x = startX + segmentWidth * (rIndex + 1);
                return { ...r, x, y };
            });

            return { path, y, startX, endX, respLayouts };
        });

        // Component Layout (Bounding Box)
        // Group responsibilities by componentId
        const componentBounds = {}; // compId -> { minX, maxX, minY, maxY }

        // Initialize from path layouts
        pathLayouts.forEach(pl => {
            pl.respLayouts.forEach(r => {
                if (r.componentId) {
                    if (!componentBounds[r.componentId]) {
                        componentBounds[r.componentId] = { minX: r.x, maxX: r.x, minY: r.y, maxY: r.y };
                    } else {
                        const b = componentBounds[r.componentId];
                        b.minX = Math.min(b.minX, r.x);
                        b.maxX = Math.max(b.maxX, r.x);
                        b.minY = Math.min(b.minY, r.y);
                        b.maxY = Math.max(b.maxY, r.y);
                    }
                }
            });
        });

        // 2. Draw Components (Background)
        data.components.forEach((comp, index) => {
            let x, y, w, h;

            if (componentBounds[comp.name]) { // comp.name is used as ID in this simple DB
                const b = componentBounds[comp.name];
                const padding = 40;
                x = b.minX - padding;
                y = 50; // Keep fixed top Y for now, or use b.minY - padding
                w = (b.maxX - b.minX) + (padding * 2);
                h = 400; // Fixed height for track

                // If single point, give it some width
                if (w < 100) { x -= 50; w += 100; }

            } else {
                // Default Grid Layout for unbound
                x = 50 + (index * 220);
                y = 50;
                w = 200;
                h = 400;
            }

            const gComp = g.append('g').attr('class', 'component');

            gComp.append('rect')
                .attr('x', x).attr('y', y).attr('width', w).attr('height', h)
                .attr('class', 'component-rect')
                .on('click', function () {
                    const el = select(this);
                    el.classed('selected', !el.classed('selected'));
                });

            gComp.append('text')
                .attr('x', x + w / 2).attr('y', y + 30)
                .text(comp.name)
                .attr('class', 'component-text');
        });

        // 3. Draw Paths (Foreground)
        pathLayouts.forEach((pl, index) => {
            const { path, y, startX, endX, respLayouts } = pl;
            const colorClass = `tube-color-${index % 6}`;

            // Line
            const pathStroke = pathStyle === 'colored' ? null : 'black';
            const pathEl = g.append('path')
                .attr('d', `M ${startX} ${y} L ${endX} ${y}`)
                .attr('class', `path-line ${colorClass}`);

            if (pathStyle === 'black') {
                pathEl.style('stroke', 'black');
            }

            // Start
            g.append('circle')
                .attr('cx', startX).attr('cy', y).attr('r', 8)
                .attr('class', `start-node ${colorClass}`)
                .style('fill', pathStyle === 'colored' ? null : 'black');

            // End
            g.append('rect')
                .attr('x', endX - 5).attr('y', y - 10).attr('width', 10).attr('height', 20)
                .attr('class', 'end-node')
                .style('fill', pathStyle === 'colored' ? null : 'black');

            // Responsibilities
            respLayouts.forEach(r => {
                if (respStyle === 'station') {
                    // Station style - filled circles like transit map
                    g.append('circle')
                        .attr('cx', r.x).attr('cy', r.y).attr('r', 10)
                        .attr('class', `responsibility-station ${colorClass}`)
                        .style('fill', 'white')
                        .style('stroke', pathStyle === 'colored' ? null : 'black')
                        .style('stroke-width', '3px');

                    g.append('circle')
                        .attr('cx', r.x).attr('cy', r.y).attr('r', 5)
                        .attr('class', `responsibility-station-inner ${colorClass}`)
                        .style('fill', pathStyle === 'colored' ? null : 'black');
                } else {
                    // X Mark for Classic Style
                    const size = 6;
                    g.append('path')
                        .attr('d', `M ${r.x - size} ${r.y - size} L ${r.x + size} ${r.y + size} M ${r.x + size} ${r.y - size} L ${r.x - size} ${r.y + size}`)
                        .attr('class', 'responsibility-mark')
                        .style('stroke', 'black')
                        .style('stroke-width', '2px')
                        .style('fill', 'none');
                }

                g.append('text')
                    .attr('x', r.x).attr('y', r.y - 15)
                    .text(r.name)
                    .attr('class', 'responsibility-text');
            });
        });

        // Removed global responsibility loop to avoid duplication

    }
};
