import 'mocha';
import { providersEmitter, topicHandler, responseRouter, EndpointEmitter, Assistant } from '../src'
import { createSandbox, SinonSandbox } from 'sinon';
import { assert, expect } from 'chai'
import { RequestMessage, ResponseMessage, AlexaEndpoint, LocalEndpoint } from '@vestibule-link/iot-types';
import { EventEmitter } from 'events';
import { listenInit } from '@vestibule-link/bridge'
class TestEndpointEmitter extends EventEmitter implements EndpointEmitter<'alexa'>{
    endpoint: AlexaEndpoint = {};
    async refresh(deltaId: symbol): Promise<void> {
    }
}

class TestAlexaAssistant implements Assistant<'alexa'>{
    readonly name: "alexa" = 'alexa';
    missingEndpointError(le: LocalEndpoint, messageId: symbol): void {

    }
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
    it('should emit to a provider and listen for response', () => {
        const providerEmitStub = sandbox.stub(providersEmitter, 'emit');
        const responseListenerStub = sandbox.stub(responseRouter, 'once');
        topicHandler('vestibule/testClient/alexa/directive/testProvider/testEndpoint/arg1/arg2', JSON.stringify(testMessage));
        assert(providerEmitStub.called)
        assert(responseListenerStub.called)
    })

    it('should emit to assistant', (done) => {
        const respMessage: ResponseMessage<any> = {
            error: false,
            payload: {}
        }
        const providerEmitStub = sandbox.stub(providersEmitter, 'emit');
        const responseListenerSpy = sandbox.spy(responseRouter, 'once');
        topicHandler('vestibule/testClient/alexa/directive/testProvider/testEndpoint/arg1/arg2', JSON.stringify(testMessage));
        assert(providerEmitStub.called)
        const messageId = responseListenerSpy.args[0][0];
        responseRouter.on('alexa', (replyTopic, payload) => {
            expect(replyTopic).eql(testMessage.replyTopic.sync);
            done();
        })
        responseRouter.emit(messageId, respMessage);
    })

    it('should create and endpoint emitter', () => {
        providersEmitter.registerAssistant(new TestAlexaAssistant())
        const endpointEmitter = providersEmitter.getEndpointEmitter('alexa', {
            host: 'testHost1',
            provider: 'testProvider'
        }, true)
        expect(endpointEmitter).to.not.be.undefined
    })

    it('should not create an endpoint emitter', () => {
        providersEmitter.registerAssistant(new TestAlexaAssistant())
        const endpointEmitter = providersEmitter.getEndpointEmitter('alexa', {
            host: 'testHost2',
            provider: 'testProvider'
        })
        expect(endpointEmitter).to.be.undefined
    })
    it('should send a delta', () => {
        const providerEmitStub = sandbox.stub(providersEmitter, 'emit');
        providersEmitter.registerAssistant(new TestAlexaAssistant())
        const endpointEmitter = providersEmitter.getEndpointEmitter('alexa', {
            host: 'testHostDelta',
            provider: 'testProvider'
        }, true);
        const deltaId = Symbol();
        if (endpointEmitter) {
            endpointEmitter.emit('delta', {}, deltaId)
            assert(providerEmitStub.calledOnce)
        } else {
            expect(endpointEmitter).to.not.be.undefined
        }
    })
    it('should delegate directive to endpoint', () => {
        providersEmitter.registerAssistant(new TestAlexaAssistant())
        const endpointEmitter = providersEmitter.getEndpointEmitter('alexa', {
            host: 'testHostEmit',
            provider: 'testProvider'
        }, true);
        if (endpointEmitter) {
            const endpointEmitStub = sandbox.stub(endpointEmitter, 'emit');
            providersEmitter.emit('directive', 'alexa', ['testProvider', 'testHostEmit'], {}, Symbol())
            assert(endpointEmitStub.calledOnce)
        } else {
            expect(endpointEmitter).to.not.be.undefined
        }
    })
    it('should call refresh on the endpoint', () => {
        providersEmitter.registerAssistant(new TestAlexaAssistant())
        const endpointEmitter = providersEmitter.getEndpointEmitter('alexa', {
            host: 'testHostRefresh',
            provider: 'testProvider'
        }, true);
        if (endpointEmitter) {
            const endpointRefreshStub = sandbox.stub(endpointEmitter, 'refresh');
            providersEmitter.emit('refresh', 'alexa');
            assert(endpointRefreshStub.calledOnce)
        } else {
            expect(endpointEmitter).to.not.be.undefined
        }

    })

    it('should register module',(done)=>{
        listenInit('assistant',()=>{
            done()
            return Promise.resolve()
        })
    })
})