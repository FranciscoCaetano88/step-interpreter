const vm = require('vm');
const {
    injectCalls,
    removeCalls,
    parse,
    generate,
    makeAsync,
    makeSync
} = require('./code-transformer');

class Interpreter {
    constructor(options = {}) {
        this.stepper = stepper(options.interval || 500);

        this.context = vm.createContext({
            step: this.stepper
        });
    }

    /**
     * Exposes a group of named values to the interpreter.
     * Each value on the object will be referenced by it's property name on the interpreter global object
     * @param {Object} anything an object to expose {name: value}
     */
    expose(anything) {
        if (typeof anything !== 'object') {
            throw new Error('Argument needs to be an object');
        }

        Object.keys(anything).forEach(key => {
            this.context[key] = anything[key];
        });
    }

    /**
     * Grabs a value from the interpreter's global object
     * @param {String} name the name in which the value has been stored
     * @returns {Anything} the value
     */
    read(name) {
        return this.context[name];
    }

    /**
     * Enqueues a function in the interpreter stepper. This function will be called on every
     * interpreter step with a stringified version of the code that the will be run next
     * @param {Function} stepFn the function to enqueue
     * @param {Object} context the context in which the function will be called (aka this)
     * @returns {Function} an unsubscribing function. call it, and you won't hear from us again.
     */
    addStepper(stepFn, context) {
        return this.stepper.addExternalStepper(stepFn.bind(context));
    }

    /**
     * Sets the step interval between every instruction
     * @param {Number} ms the step interval in milliseconds
     */
    setStepInterval(ms) {
        this.stepper.setInterval(ms);
    }

    /**
     * Runs a piece of code in a sandboxed (not totally) environment,
     * with access to every value that this interpreter been exposed to
     * @param {String} code the code to run
     * @returns {Promise} a promise that will be fulfilled when the code has finished running
     */
    async run(code) {
        code = generate(makeAsync(injectCalls(parse(code), 'step')));
        return vm.runInContext(code, this.context);
    }
}

module.exports = Interpreter;

function stepper(interval = 1, externalSteppers = []) {
    const stepFn = async nextExpression => {
        externalSteppers.forEach(fn => fn(nextExpression));
        await sleep(interval);
    };

    stepFn.setInterval = seconds => {
        interval = seconds;
    };

    stepFn.addExternalStepper = fn => {
        externalSteppers.push(fn);

        return () => {
            externalSteppers = externalSteppers.filter(cb => cb !== fn);
        };
    };

    return stepFn;
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
