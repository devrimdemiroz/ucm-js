export class UcmDb {
    constructor() {
        this.components = [];
        this.paths = [];
        this.responsibilities = [];
        this.actors = [];
        this.config = {};
    }

    getConfig() {
        return this.config;
    }

    addComponent(name) {
        this.components.push({ id: `comp_${this.components.length}`, name });
    }

    addPath(id, start, end) {
        this.paths.push({ id, start, end });
    }

    addResponsibility(name, pathId = null, componentId = null) {
        this.responsibilities.push({ id: `resp_${this.responsibilities.length}`, name, pathId, componentId });
    }

    getDiagramData() {
        return {
            components: this.components,
            paths: this.paths,
            responsibilities: this.responsibilities
        };
    }

    clear() {
        this.components = [];
        this.paths = [];
        this.responsibilities = [];
        this.actors = [];
    }
}
