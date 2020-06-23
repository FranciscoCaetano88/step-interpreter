const VM = require('context-eval');
const EventEmitter = require('./event-emitter');
const { prepare, toES2015 } = require('./code-transforms');
const { adaptError } = require('./error-adapters');
const { createContext } = require('./context');
const { createExecutionController } = require('./execution-controller');
const Stepper = require('./stepper');

const run = (code = '', options = {}) => {
    const {
        stepTime = 15,
        on = {},
        context: userContext = {},
        es2015 = false,
        destroyStepper = true,
        sync = false
    } = options;
    const events = EventEmitter();

    const stepper = new Stepper({ stepTime });
    const context = createContext({ events, userContext, stepper });

    const stepEventPipe = (data) => events.emit('step', data);
    const stepEventPipeDisposer = stepper.on('step', stepEventPipe);

    on.start && events.on('start', on.start);
    on.step && events.on('step', on.step);
    on.exit && events.on('end', on.exit);

    const { activeHandlers } = context._execution;
    activeHandlers.onEmptyPromise
        .then(() => events.emit('end'))
        .catch(() => events.emit('end'))
        .finally(() => {
            if (destroyStepper) {
                stepEventPipeDisposer();
                events.destroy();
                stepper.destroy();
                vm.destroy();
            }
        });

    const preparedCode = `
    __initialize__(this);
    ${es2015 ? toES2015(prepare(code, { sync })) : prepare(code, { sync })}
    `;

    activeHandlers.increment();
    events.emit('start');

    if (sync) {
        const vm = new VM(context);
        vm.evaluate(preparedCode)();
        vm.destroy();
        activeHandlers.decrement();
        return;
    }

    const vm = new VM(context);
    const execution = vm
        .evaluate(preparedCode)()
        .catch((err) => {
            if (err === 'stepper-destroyed') {
                return;
            }

            // makes promises.onExecutionEnd fail aswell
            activeHandlers.reset(adaptError(err));
            throw adaptError(err);
        })
        .finally(() => {
            activeHandlers.decrement();
        });

    return createExecutionController({ execution, events, context });
};

exports.run = run;
