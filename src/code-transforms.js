import Babel from '@babel/standalone';
import generate from '@babel/generator';

export function prepare(code) {
    return `
async function main() {
    ${
        Babel.transform(code, {
            parserOpts: {
                allowAwaitOutsideFunction: true
            },
            plugins: [stepInjector]
        }).code
    }
}

main;
`;
}

function stepInjector(babel) {
    const t = babel.types;

    return {
        visitor: {
            Function(path) {
                path.node.async = true;
            },
            ArrowFunctionExpression(path) {
                implicitToExplicitReturnFunction(babel, path);
            },
            ReturnStatement(path) {
                prependContextCall(babel, path);
            },
            Loop(path) {
                prependContextCall(babel, path);
            },
            VariableDeclaration(path) {
                prependContextCall(babel, path);
            },
            ExpressionStatement(path) {
                if (
                    t.isAwaitExpression(path.node.expression) &&
                    t.isCallExpression(path.node.expression.argument) &&
                    path.node.expression.argument.callee.name === 'step'
                ) {
                    path.skip();
                    return;
                }
                prependContextCall(babel, path);
            }
        }
    };
}

function createContextCall(babel, fnName, expr) {
    const { types: t } = babel;

    const stepperName = t.identifier(fnName);
    const stepperArgs = [
        t.templateLiteral([t.templateElement({ raw: expr })], [])
    ];

    return t.expressionStatement(
        t.awaitExpression(t.callExpression(stepperName, stepperArgs))
    );
}

function prependContextCall(babel, path) {
    return path.insertBefore(
        createContextCall(babel, 'step', generate.default(path.node).code)
    );
}

function implicitToExplicitReturnFunction(babel, path) {
    const { types: t } = babel;

    if (!t.isArrowFunctionExpression(path.node)) {
        return;
    }

    if (t.isBlockStatement(path.node.body)) {
        return;
    }

    const { params } = path.node;
    const body = t.blockStatement([t.returnStatement(path.node.body)]);
    const { async: isAsync } = path.node;

    return path.replaceWith(t.arrowFunctionExpression(params, body, isAsync));
}
