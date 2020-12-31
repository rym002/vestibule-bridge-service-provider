import { registerModule } from '@vestibule-link/bridge';
import { expect, use } from 'chai';
import 'mocha';
import { EndpointConnector, ServiceProviderEndpointFactory, serviceProviderManager, startModule } from '../src';
const chaiAsPromised = require('chai-as-promised')

use(chaiAsPromised)

declare module '../src/providers' {
    export interface ServiceProviderConnectors {
        test?: TestEndpointConnector
        testNotRegistered?: TestEndpointConnector
    }
}

class TestEndpointConnector implements EndpointConnector{
    constructor(readonly endpointId: string) {

    }
    async refresh(deltaId:symbol){

    }
}

class TestServiceProvider implements ServiceProviderEndpointFactory<'test'>{
    name: 'test' = 'test';
    async createEndpointConnector(endpointId: string): Promise<TestEndpointConnector> {
        return new TestEndpointConnector(endpointId)
    }
}

describe('Service Provider', () => {
    beforeEach(function () {
        serviceProviderManager.registerServiceProvider(new TestServiceProvider())
    })
    it('should create and endpoint emitter', async () => {
        const endpointId = 'testProvider_testHost1'
        const endpointConnector = await serviceProviderManager.getEndpointConnector('test', endpointId, true)
        expect(endpointConnector)
            .to.have.property('endpointId')
            .to.eql(endpointId)
    })

    it('should throw error if service provider is not registered', async () => {
        const endpointId = 'testProvider_testHost1'
        const endpointConnector = serviceProviderManager.getEndpointConnector('testNotRegistered', endpointId, true)
        await expect(endpointConnector).to.eventually.be.rejectedWith(Error)
    })
    it('should throw error on missing endpoint', async () => {
        const endpointId = 'testProvider_testHost2'
        const endpointConnector = serviceProviderManager.getEndpointConnector('test', endpointId)
        await expect(endpointConnector).to.eventually.be.rejectedWith(Error)
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