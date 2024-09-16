module.exports = function (fileInfo, api, options) {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);
    const flagName = options.flagName || 'my-flag-to-remove'; // Use the provided flag name or default to 'archiveProjects'

    const containsFlagName = root.find(j.Literal, { value: flagName }).size() > 0;
    const skipNoFlag = options.skipNoFlag ?? true;

    // If the flag name is not found, return the original source
    if (!containsFlagName && skipNoFlag) {
        return fileInfo.source;
    }

    // Helper to check if a node is a literal true/false
    const isLiteral = (node, value) => node && (node.type === 'Literal' || node.type === 'BooleanLiteral') && node.value === value;
    const isBooleanCallExpression = (node, value) => {
        return node && node.type === 'CallExpression' &&
            node.callee.name === 'Boolean' &&
            node.arguments.length === 1 &&
            isLiteral(node.arguments[0], value);
    };
    const isLiteralTrue = node => isLiteral(node, true) || isBooleanCallExpression(node, true);
    const isLiteralFalse = node => isLiteral(node, false) || isBooleanCallExpression(node, false);

    // Helper to safely remove a variable declarator
    const removeVariableDeclarator = path => {
        const parent = path.parentPath.node;
        if (parent.declarations.length === 1) {
            j(path.parentPath.parentPath).remove(); // Remove entire VariableDeclaration if it's the only declarator
        } else {
            j(path).remove(); // Remove only the declarator
        }
    };

    // Pass 1: Replace `this.flagResolver.isEnabled(flagName)` with `true`
    root.find(j.CallExpression, {
        callee: {
            type: 'MemberExpression',
            object: {
                type: 'MemberExpression',
                object: { type: 'ThisExpression' },
                property: { name: 'flagResolver' }
            },
            property: { name: 'isEnabled' }
        },
        arguments: [{ value: flagName }]
    }).replaceWith(() => j.literal(true));

    // Pass 1: Replace useUiFlag(flagName) with `true`
    root.find(j.CallExpression, {
        callee: { type: 'Identifier', name: 'useUiFlag' },
        arguments: [{ value: flagName }]
    }).replaceWith(() => j.literal(true));

    // Pass 2: Simplify boolean expressions
    root.find(j.LogicalExpression).replaceWith(path => {
        const { left, right, operator } = path.node;

        if (operator === '&&') {
            return isLiteralTrue(left) ? right : isLiteralFalse(left) ? left : isLiteralTrue(right) ? left : isLiteralFalse(right) ? right : path.node;
        }

        if (operator === '||') {
            return isLiteralTrue(left) ? left : isLiteralFalse(left) ? right : path.node;
        }

        return path.node;
    });

    // Pass 3: Inline variables if they are true or false, and remove their declarations
    root.find(j.VariableDeclarator)
        .filter(path => isLiteralTrue(path.node.init) || isLiteralFalse(path.node.init))
        .forEach(path => {
            const varName = path.node.id.name;
            const literalValue = path.node.init;

            // Replace all **usages** of this variable with its literal value (skip declaration)
            root.find(j.Identifier)
                .filter(identifierPath => identifierPath.name !== 'id' && identifierPath.node.name === varName)
                .replaceWith(() => literalValue);

            // Remove the variable declaration safely
            removeVariableDeclarator(path);
        });

    // Pass 4: Remove `if (true)` or `if (false)`
    root.find(j.IfStatement).forEach(path => {
        const test = path.node.test;

        if (isLiteralTrue(test)) {
            const consequent = path.node.consequent;
            j(path).replaceWith(consequent.type === 'BlockStatement' ? consequent.body : consequent);
        }

        if (isLiteralFalse(test)) {
            j(path).remove();
        }
    });

    // Pass 5: Simplify `ConditionallyRender` components
    root.find(j.JSXElement, {
        openingElement: {
            name: { name: 'ConditionallyRender' },
            attributes: [{ name: { name: 'condition' } }]
        }
    }).forEach(path => {
        const conditionAttr = path.node.openingElement.attributes.find(attr => attr.name.name === 'condition');
        const showAttr = path.node.openingElement.attributes.find(attr => attr.name.name === 'show');

        if (conditionAttr && conditionAttr.value && conditionAttr.value.expression) {
            const condition = conditionAttr.value.expression;

            if (isLiteralTrue(condition)) {
                // Replace with the content of the `show` prop
                if (showAttr && showAttr.value) {
                    j(path).replaceWith(showAttr.value.expression);
                }
            } else if (isLiteralFalse(condition)) {
                // Remove the element if the condition is false
                j(path).remove();
            }
        }
    });

    return root.toSource();
};
