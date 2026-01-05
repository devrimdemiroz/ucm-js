import { UcmDb } from './db.js';
import { parser } from './parser.js';
import { renderer } from './renderer.js';
import getStyles from './styles.js';

const ucmDiagram = {
    id: 'ucm',
    detector: (text) => {
        return text.match(/^\s*ucm/);
    },
    loader: () => {
        const db = new UcmDb();
        parser.db = db;
        parser.parser = { yy: db };
        return {
            id: 'ucm',
            db,
            parser,
            renderer,
            // Inline styles to be safe
            styles: (options) => {
                return getStyles(options);
            },
            init: (config) => {
                renderer.setConf(config);
                db.config = config;
            }
        };
    }
};

export default ucmDiagram;
