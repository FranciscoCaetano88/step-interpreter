import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import { prepare } from '../src/code-transforms';

chai.use(chaiAsPromised);
chai.use(sinonChai);

describe('code-transforms', function() {
    it('should wrap code in async function', function() {
        const input = `const a = 1;`;
        const output = /async function main\(\) {.+}/s;

        expect(prepare(input)).to.match(output);
    });
    it('should transform normal functions into async functions', function() {
        const input = `function test() {}`;
        const output = `async function test() {}`;

        expect(prepare(input)).to.include(output);
    });
    it('should inject steps before declarations', function() {
        const input = `const a = 1;`;
        const output = /await step\(\);\s+const a = 1;/;

        expect(prepare(input)).to.match(output);
    });
    it('should inject steps before declarations inside functions', function() {
        const input = `function test() { const a = 1; }`;
        const output = /await step\(\);\s+const a = 1;/;

        expect(prepare(input)).to.match(output);
    });
    it('should inject steps before declarations inside for loops', function() {
        const input = `for(let i = 0; i < 1; i++) { const a = 1; }`;
        const output = /await step\(\);\s+const a = 1;/;

        expect(prepare(input)).to.match(output);
    });
    it('should inject steps before declarations inside while loops', function() {
        const input = `while(true) { const a = 1; }`;
        const output = /await step\(\);\s+const a = 1;/;

        expect(prepare(input)).to.match(output);
    });
});
