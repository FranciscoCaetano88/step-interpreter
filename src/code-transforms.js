import { transform as babelTransform } from '@babel/standalone';
import asyncToGenerator from './async-to-generator-polyfill';

const asyncWrapper = code => {
    return `
    async function main() {
        ${code}
    }

    main;
    `;
};

export function prepare(code, noStep) {
    if (noStep) {
        return babelTransform(asyncWrapper(code), {
            presets: ['es2015'],
            plugins: [asyncToGenerator]
        }).code;
    }

    const withSteps = babelTransform(asyncWrapper(code), {
        plugins: [stepInjector]
    }).code;

    return babelTransform(withSteps, {}).code;
}

const syncWrapper = code => {
    return `
    function main() {
        ${code}
    }

    main;
    `;
};

export function prepareSync(code, noStep) {
    if (noStep) {
        return babelTransform(syncWrapper(code), {
            presets: ['es2015']
        }).code;
    }

    const withSteps = babelTransform(syncWrapper(code), {
        plugins: [stepInjector]
    }).code;

    return babelTransform(withSteps, {
        presets: ['es2015']
    }).code;
}

function stepInjector(babel) {
    const t = babel.types;
    const createContextCall = fnName =>
        t.awaitExpression(t.callExpression(t.identifier(fnName), []));

    const MainVisitor = {
        FunctionDeclaration: {
            enter(path) {
                path.node.async = true;
            }
        },
        Statement: {
            exit(path) {
                if (path.node.type === 'BlockStatement') {
                    return;
                }
                path.replaceWithMultiple([
                    createContextCall('step'),
                    path.node
                ]);
            }
        }
    };

    return {
        visitor: {
            FunctionDeclaration(path) {
                if (path.node.id.name === 'main') {
                    path.traverse(MainVisitor);
                }

                path.stop();
            }
        }
    };
}
