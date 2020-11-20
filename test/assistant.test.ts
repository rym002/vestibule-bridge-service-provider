import 'mocha';
import { providersEmitter, EndpointEmitter, Assistant, startModule } from '../src'
import { createSandbox, SinonSandbox } from 'sinon';
import { assert, expect } from 'chai'
import { RequestMessage, ResponseMessage, AlexaEndpoint } from '@vestibule-link/iot-types';
import { EventEmitter } from 'events';
import { registerModule } from '@vestibule-link/bridge'
class TestEndpointEmitter extends EventEmitter implements EndpointEmitter<'alexa'>{
    endpoint: AlexaEndpoint = {};
    async refresh(deltaId: symbol): Promise<void> {
    }
}

class TestAlexaAssistant implements Assistant<'alexa'>{
    readonly name: "alexa" = 'alexa';
    createEndpointEmitter(endpointId: string): TestEndpointEmitter {
        return new TestEndpointEmitter();
    }
}

describe('assistant', () => {
    let sandbox: SinonSandbox
    const testMessage: RequestMessage<string> = {
        replyTopic: {
            sync: '/testReply'
        },
        payload: 'testPayload'
    }
    before(() => {
        sandbox = createSandbox()
    })
    afterEach(() => {
        sandbox.restore();
    })

    it('should create and endpoint emitter', () => {
        providersEmitter.registerAssistant(new TestAlexaAssistant())
        const endpointEmitter = providersEmitter.getEndpointEmitter('alexa', 'testProvider_testHost1', true)
        expect(endpointEmitter).to.not.be.undefined
    })

    it('should not create an endpoint emitter', () => {
        providersEmitter.registerAssistant(new TestAlexaAssistant())
        const endpointEmitter = providersEmitter.getEndpointEmitter('alexa', 'testProvider_testHost2')
        expect(endpointEmitter).to.be.undefined
    })
    it('should send a delta', () => {
        const providerEmitStub = sandbox.stub(providersEmitter, 'emit');
        providersEmitter.registerAssistant(new TestAlexaAssistant())
        const endpointEmitter = providersEmitter.getEndpointEmitter('alexa', 'testProvider_testHostDelta', true);
        const deltaId = Symbol();
        if (endpointEmitter) {
            endpointEmitter.emit('delta', {}, deltaId)
            assert(providerEmitStub.calledOnce)
        } else {
            expect(endpointEmitter).to.not.be.undefined
        }
    })
    it('should call refresh on the endpoint', () => {
        providersEmitter.registerAssistant(new TestAlexaAssistant())
        const endpointEmitter = providersEmitter.getEndpointEmitter('alexa', 'testProvider_testHostRefresh', true);
        if (endpointEmitter) {
            const endpointRefreshStub = sandbox.stub(endpointEmitter, 'refresh');
            providersEmitter.emit('refresh', 'alexa');
            assert(endpointRefreshStub.calledOnce)
        } else {
            expect(endpointEmitter).to.not.be.undefined
        }
    })
    it('should emit settings', (done) => {
        providersEmitter.registerAssistant(new TestAlexaAssistant())
        const endpointEmitter = providersEmitter.getEndpointEmitter('alexa', 'testProvider_testHostSettings', true);
        if (endpointEmitter) {
            providersEmitter.getEndpointSettingsEmitter('alexa').on('settings', (endpointId, data) => {
                try {
                    expect(endpointId).to.equal('testProvider_testHostSettings')
                    done()
                } catch (err) {
                    done(err)
                }
            })
            endpointEmitter.emit('settings', {})
        } else {
            expect(endpointEmitter).to.not.be.undefined
        }

    })
    it('should register module', (done) => {
        registerModule({
            name: 'testModule',
            init: async () => {
                done()
            },
            depends: [startModule()]
        })
    })
})