const transform = require('./transform');

function applyTransform(source, flagName, options = {}) {
    const transformOptions = { parser: 'ts' }; // Use TypeScript parser
    return transform(
        {
            path: 'test.ts', // Just an example path
            source: source,
        },
        {
            jscodeshift: require('jscodeshift'),
            stats: () => {},
        },
        { flagName, skipNoFlag: false,  ...transformOptions }
    );
}

describe('Feature flag transformation', () => {
    const flagName = 'archiveProjects';

    it('should replace inline flag resolver call with true', () => {
        const input = `
            if (this.flagResolver.isEnabled('${flagName}')) {
                projectExists = await this.projectStore.hasActiveProject(projectId);
                doSomethingElse();
            } else {
                projectExists = await this.projectStore.hasProject(projectId);
            }
        `;
        const output = `
            projectExists = await this.projectStore.hasActiveProject(projectId);
            doSomethingElse();
        `;
        expect(applyTransform(input, flagName)).toBe(output);
    });

    it('should resolve Boolean(true)', () => {
        const input = `
            if (Boolean(true)) {
                projectExists = await this.projectStore.hasActiveProject(projectId);
                doSomethingElse();
            } else {
                projectExists = await this.projectStore.hasProject(projectId);
            }
        `;
        const output = `
            projectExists = await this.projectStore.hasActiveProject(projectId);
            doSomethingElse();
        `;
        expect(applyTransform(input, flagName)).toBe(output);
    });

    it('should simplify boolean expression with true && flag resolver', () => {
        const input = `
            if (true && this.flagResolver.isEnabled('${flagName}')) {
                projectExists = await this.projectStore.hasActiveProject(projectId);
                doSomethingElse();
            } else {
                projectExists = await this.projectStore.hasProject(projectId);
            }
        `;
        const output = `
            projectExists = await this.projectStore.hasActiveProject(projectId);
            doSomethingElse();
        `;
        expect(applyTransform(input, flagName)).toBe(output);
    });

    it('should simplify boolean expression with flag resolver && true', () => {
        const input = `
            if (this.flagResolver.isEnabled('${flagName}') && true) {
                projectExists = await this.projectStore.hasActiveProject(projectId);
                doSomethingElse();
            } else {
                projectExists = await this.projectStore.hasProject(projectId);
            }
        `;
        const output = `
            projectExists = await this.projectStore.hasActiveProject(projectId);
            doSomethingElse();
        `;
        expect(applyTransform(input, flagName)).toBe(output);
    });

    it('should remove if true and keep the consequent block', () => {
        const input = `
            if (true) {
                projectExists = await this.projectStore.hasActiveProject(projectId);
                doSomethingElse();
            } else {
                projectExists = await this.projectStore.hasProject(projectId);
            }
        `;
        const output = `
            projectExists = await this.projectStore.hasActiveProject(projectId);
            doSomethingElse();
        `;
        expect(applyTransform(input, flagName)).toBe(output);
    });

    it('should inline true variable and remove if condition', () => {
        const input = `
            const isEnabled = true;
            if (isEnabled) {
                projectExists = await this.projectStore.hasActiveProject(projectId);
                doSomethingElse();
            } else {
                projectExists = await this.projectStore.hasProject(projectId);
            }
        `;
        const output = `
            projectExists = await this.projectStore.hasActiveProject(projectId);
            doSomethingElse();
        `;
        expect(applyTransform(input, flagName)).toBe(output);
    });

    it('should inline flag resolver variable and remove variable declaration', () => {
        const input = `
            const isEnabled = this.flagResolver.isEnabled('${flagName}');
            if (isEnabled) {
                projectExists = await this.projectStore.hasActiveProject(projectId);
                doSomethingElse();
            } else {
                projectExists = await this.projectStore.hasProject(projectId);
            }
        `;
        const output = `
            projectExists = await this.projectStore.hasActiveProject(projectId);
            doSomethingElse();
        `;
        expect(applyTransform(input, flagName)).toBe(output);
    });

    it('should combine flag resolver and true, remove unnecessary variable', () => {
        const input = `
            const isEnabled = this.flagResolver.isEnabled('${flagName}') && true;
            if (isEnabled) {
                projectExists = await this.projectStore.hasActiveProject(projectId);
                doSomethingElse();
            } else {
                projectExists = await this.projectStore.hasProject(projectId);
            }
        `;
        const output = `
            projectExists = await this.projectStore.hasActiveProject(projectId);
            doSomethingElse();
        `;
        expect(applyTransform(input, flagName)).toBe(output);
    });

    it('should remove flag resolver and keep code without else block', () => {
        const input = `
            if (this.flagResolver.isEnabled('${flagName}')) {
                projectExists = await this.projectStore.hasActiveProject(projectId);
            }
        `;
        const output = `
            projectExists = await this.projectStore.hasActiveProject(projectId);
        `;
        expect(applyTransform(input, flagName)).toBe(output);
    });

    it('should handle cases where flag is not found (no transformation)', () => {
        const input = `
            if (someOtherCondition) {
                projectExists = await this.projectStore.hasActiveProject(projectId);
            }
        `;
        const output = input; // No transformation expected
        expect(applyTransform(input, flagName)).toBe(output);
    });

    it('should replace useUiFlag with true and simplify ConditionallyRender', () => {
        const input = `
            const archiveProjectsEnabled = useUiFlag('archiveProjects');
            <ConditionallyRender
                condition={Boolean(archiveProjectsEnabled)}
                show={<ProjectArchiveLink />}
            />;
        `;
        const output = `
            <ProjectArchiveLink />;
        `;
        expect(applyTransform(input, 'archiveProjects')).toBe(output);
    });
});
